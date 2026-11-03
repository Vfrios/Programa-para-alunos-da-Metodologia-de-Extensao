const path = require('path'), http = require('http'), crypto = require('crypto'), os = require('os');
const express = require('express');
const PDFDocument = require('pdfkit');
const { Server } = require('socket.io');
const db = require('./database');
const { configurarAdmin, confere, hash } = require('./engine/admin');
const { aproveitamentoResposta } = require('./engine/relatorios');
const { detalharAtividadeImportada } = require('./imported-activity-report');
const { excluirAtividade } = require('./activity-deletion');
const { normalizarNomeProfessor } = require('./database-migrations');
const { ATIVIDADES, ATIVIDADES_POR_ANO, gerarPergunta, criarSorteadorDeAtividades, criarSorteadorDeModelos, limparSorteadoresNumericos } = require('./engine/gerador');
const { criarDesafio } = require('./engine/desafios');
const { calcularPontos, ajustarNivel, mensagemErro, premio, nota } = require('./engine/regras');
const {
  agora, paraMin, horaFim, sobrepoe, horarioOcorre, horariosSeSobrepoem,
  diaDaData, limiteInicioAutomatico, deveIniciarAutomaticamente,
  LIMITE_ALUNOS_INICIO_AUTOMATICO, DURACAO_MIN,
} = require('./agendamento');

const TOTAL = Number(process.env.TOTAL_PERGUNTAS || 0);
const intervaloDesafio = () => 7 + Math.floor(Math.random() * 6);
const app = express(), server = http.createServer(app), io = new Server(server);
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/admin', (q, r) => r.redirect('/admin.html'));

const get = (s, ...p) => db.prepare(s).get(...p);
const all = (s, ...p) => db.prepare(s).all(...p);
const run = (s, ...p) => db.prepare(s).run(...p);
const ok = (fn) => (req, res) => { try { fn(req, res); } catch (e) { res.status(400).json({ erro: e.message }); } };

// ---------- Admin: senha criptografada (scrypt) + token de sessão ----------
const tinhaAdmin = Boolean(get('SELECT 1 x FROM admins'));
const usuarioAdministrador = process.env.ADMIN_USER || 'admin';
const senhaAdministrador = process.env.ADMIN_PASS || 'admin123';
configurarAdmin(db, usuarioAdministrador, senhaAdministrador, process.env.NODE_ENV === 'production');
if (!tinhaAdmin && process.env.NODE_ENV !== 'production') {
  console.log('Admin criado. Usuário padrão: admin / admin123 (troque com ADMIN_USER e ADMIN_PASS).');
}
const tokens = new Map();
const auth = (req, res, next) => (tokens.has(req.get('x-token')) ? next() : res.status(401).json({ erro: 'Faça login.' }));
const authAdmin = (req, res, next) => {
  if (!tokens.has(req.get('x-token'))) return res.status(401).json({ erro: 'Faça login.' });
  if (tokens.get(req.get('x-token')).papel !== 'admin') {
    return res.status(403).json({ erro: 'Apenas usuários Administradores podem executar esta ação.' });
  }
  next();
};

// ---------- Estado em memória ----------
const pendentes = new Map();   // alunoId -> pergunta em andamento (resposta certa nunca vai ao navegador)
const online = new Map();      // sessaoId -> Set(socket.id)
const comboPorAluno = new Map();
const sorteadoresAtividade = new Map();
const sorteadoresModelo = new Map();
const desafiosPendentes = new Map();
const proximoDesafioPorAluno = new Map();
let sujo = false;

const abertas = () => all(`SELECT se.*, sa.nome AS sala, sa.ano FROM sessoes se JOIN salas sa ON sa.id=se.sala_id WHERE se.status IN ('aguardando','iniciada') ORDER BY se.id`);
const ranking = (sessaoId) => all(`SELECT a.id, a.nome,
    COALESCE(SUM(r.pontos),0) + COALESCE((SELECT SUM(d.pontos) FROM desafios d WHERE d.aluno_id=a.id AND d.sessao_id=a.sessao_id),0) AS pontos,
    COUNT(r.id) AS respostas
  FROM alunos a LEFT JOIN respostas r ON r.aluno_id=a.id WHERE a.sessao_id=? GROUP BY a.id ORDER BY pontos DESC, a.id`, sessaoId);
const rankingGeral = () => all(`SELECT id, nome, sala, pontos FROM (
    SELECT a.id, a.nome, sa.nome AS sala,
      COALESCE(SUM(r.pontos),0) + COALESCE((SELECT SUM(d.pontos) FROM desafios d WHERE d.aluno_id=a.id),0) AS pontos
    FROM alunos a JOIN salas sa ON sa.id=a.sala_id LEFT JOIN respostas r ON r.aluno_id=a.id GROUP BY a.id
    UNION ALL
    SELECT NULL, ai.nome, sa.nome, ai.pontos_total
    FROM alunos_importados ai JOIN importacoes_sala i ON i.id=ai.importacao_id
    JOIN salas sa ON sa.id=i.sala_id
    WHERE NOT EXISTS (SELECT 1 FROM exclusoes_alunos_importados e
      WHERE e.sala_id=i.sala_id AND e.arquivo=i.arquivo
        AND e.linha_origem=ai.linha_origem AND e.nome IS NULL)
  ) ORDER BY pontos DESC, nome`);
const terminaram = (sid) => get('SELECT COUNT(DISTINCT aluno_id) n FROM respostas WHERE sessao_id=?', sid).n;
const primeira = () => abertas().sort((x, y) => (x.status === 'aguardando' ? -1 : 1) - (y.status === 'aguardando' ? -1 : 1))[0];

function resumo(alunoId) {
  const r = get(`SELECT COALESCE((SELECT SUM(pontos) FROM respostas WHERE aluno_id=?),0) +
      COALESCE((SELECT SUM(pontos) FROM desafios WHERE aluno_id=?),0) p`, alunoId, alunoId);
  const totalResp = get('SELECT COUNT(*) n FROM respostas WHERE aluno_id=?', alunoId).n;
  const totalDesafios = get('SELECT COUNT(*) n FROM desafios WHERE aluno_id=?', alunoId).n;
  const media = totalResp + totalDesafios ? Math.round(r.p / (totalResp + totalDesafios)) : 0;
  const a = get('SELECT sessao_id FROM alunos WHERE id=?', alunoId);
  return { pontos: r.p, media, premio: premio(media), nota: nota(media), posicao: ranking(a.sessao_id).findIndex((x) => x.id === alunoId) + 1 };
}

// Atividade = sessão. Cada sessão tem um nome (rótulo) e data/hora de início.
function rotuloAtividade(sessao) {
  if (!sessao) return 'Atividade';
  if (sessao.rotulo) return sessao.rotulo;
  const inicio = sessao.iniciada_em || sessao.aberta_em;
  const data = inicio ? new Date(inicio) : null;
  const dataFmt = data ? data.toLocaleDateString('pt-BR') : '';
  return dataFmt ? `Atividade ${dataFmt}` : 'Atividade';
}

const painel = () => abertas().map((s) => ({
  id: s.id, sala_id: s.sala_id, sala: s.sala, status: s.status, rotulo: s.rotulo || rotuloAtividade(s),
  conectados: online.get(s.id)?.size || 0, alunos: get('SELECT COUNT(*) n FROM alunos WHERE sessao_id=?', s.id).n,
  limite_alunos_inicio: LIMITE_ALUNOS_INICIO_AUTOMATICO,
  iniciar_ate_em: s.iniciar_ate_em, fim_previsto_em: s.fim_previsto_em,
  aberta_em: s.aberta_em, iniciada_em: s.iniciada_em, encerrada_em: s.encerrada_em,
  terminaram: terminaram(s.id), ranking: ranking(s.id)
}));
function emitirPainel() { const p = painel(); io.to('admin').emit('painel', p); p.forEach((s) => io.to('s' + s.id).emit('conectados', s.conectados)); }
function emitirRanking() {
  abertas().forEach((s) => io.to('s' + s.id).emit('ranking', ranking(s.id)));
  emitirPainel();
}

function fimPrevistoApos(minutos, alinharMinuto = false) {
  const agoraReal = new Date();
  const ajuste = alinharMinuto ? agoraReal.getSeconds() * 1000 + agoraReal.getMilliseconds() : 0;
  return new Date(agoraReal.getTime() + minutos * 60000 - ajuste).toISOString();
}
function fimPrevistoDoHorario(hora, minutoAtual = agora().min) {
  const minutosRestantes = paraMin(horaFim(hora.hora, hora.fim)) - minutoAtual;
  return fimPrevistoApos(minutosRestantes, true);
}
function rotuloPadraoAtividade(salaId, data = new Date()) {
  const numero = get("SELECT COUNT(*) AS n FROM sessoes WHERE sala_id=? AND status NOT IN ('cancelada','excluida')", salaId).n + 1;
  const dataFmt = `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
  return `Atividade ${numero} - ${dataFmt}`;
}
function abrirSessao(salaId, fimPrevistoEm, rotulo = null, iniciarAteEm = null) {
  let id;
  db.exec('BEGIN IMMEDIATE');
  try {
    const existente = get("SELECT * FROM sessoes WHERE sala_id=? AND status IN ('aguardando','iniciada')", salaId);
    if (existente) {
      db.exec('COMMIT');
      return existente;
    }

    if (!fimPrevistoEm) {
      const t = agora();
      const horarioAtivo = all('SELECT * FROM horarios WHERE sala_id=? AND dia=?', salaId, t.dia)
        .find((h) => horarioOcorre(h, t) && t.min >= paraMin(h.hora) && t.min < paraMin(horaFim(h.hora, h.fim)));
      if (horarioAtivo) {
        fimPrevistoEm = fimPrevistoDoHorario(horarioAtivo, t.min);
        iniciarAteEm = limiteInicioAutomatico(horarioAtivo, t);
      } else {
        fimPrevistoEm = fimPrevistoApos(DURACAO_MIN);
      }
    }
    const agoraData = new Date();
    const agoraISO = agoraData.toISOString();
    const rotuloPersonalizado = rotulo && !/^Atividade \d+\s+-\s+\d{2}\/\d{2}\/\d{4}$/.test(rotulo)
      ? rotulo : null;
    const rotuloFinal = rotuloPersonalizado || rotuloPadraoAtividade(salaId, agoraData);
    id = Number(run('INSERT INTO sessoes(sala_id,aberta_em,fim_previsto_em,iniciar_ate_em,rotulo) VALUES(?,?,?,?,?)',
      salaId, agoraISO, fimPrevistoEm, iniciarAteEm, rotuloFinal).lastInsertRowid);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  io.emit('estado'); emitirPainel();
  return get('SELECT * FROM sessoes WHERE id=?', id);
}
function iniciarSessao(id) {
  if (!run("UPDATE sessoes SET status='iniciada', iniciada_em=? WHERE id=? AND status='aguardando'",
    new Date().toISOString(), id).changes) return false;
  io.to('s' + id).emit('iniciada');
  emitirPainel();
  return true;
}
function avaliarInicioAutomatico(id) {
  const sessao = get("SELECT iniciar_ate_em,status FROM sessoes WHERE id=?", id);
  if (!sessao || sessao.status !== 'aguardando' || !sessao.iniciar_ate_em) return false;
  const prontos = get('SELECT COUNT(*) AS n FROM alunos WHERE sessao_id=?', id).n;
  if (!deveIniciarAutomaticamente(prontos, sessao.iniciar_ate_em)) return false;
  return iniciarSessao(id);
}
function encerrarSessao(id) {
  const s = get('SELECT * FROM sessoes WHERE id=?', id);
  if (!s || s.status === 'encerrada') return;
  run("UPDATE sessoes SET status='encerrada', encerrada_em=? WHERE id=?", new Date().toISOString(), id);
  const rk = ranking(id);
  rk.forEach((r, i) => {
    run('INSERT INTO historico_ranking(sessao_id,aluno_id,posicao,aluno,pontos) VALUES(?,?,?,?,?)', id, r.id, i + 1, r.nome, r.pontos);
    const m = resumo(r.id); pendentes.delete(r.id); desafiosPendentes.delete(r.id); proximoDesafioPorAluno.delete(r.id); sorteadoresModelo.delete(r.id);
    limparSorteadoresNumericos(r.id);
    run('INSERT INTO premiacoes(aluno_id,sessao_id,premio,nota,media) VALUES(?,?,?,?,?)', r.id, id, m.premio, m.nota, m.media);
  });
  io.to('s' + id).emit('encerrada', rk);
  online.delete(id); io.emit('estado'); emitirPainel();
}
function cancelarSessao(id) {
  const sessao = get('SELECT id FROM sessoes WHERE id=? AND status=?', id, 'aguardando');
  if (!sessao) throw new Error('Só é possível cancelar uma atividade que ainda aguarda início.');
  const canceladaEm = new Date().toISOString();
  run("UPDATE sessoes SET status='cancelada', encerrada_em=? WHERE id=? AND status='aguardando'", canceladaEm, id);
  for (const aluno of all('SELECT id FROM alunos WHERE sessao_id=?', id)) {
    pendentes.delete(aluno.id);
    desafiosPendentes.delete(aluno.id);
    proximoDesafioPorAluno.delete(aluno.id);
    sorteadoresModelo.delete(aluno.id);
    limparSorteadoresNumericos(aluno.id);
  }
  io.to('s' + id).emit('cancelada');
  online.delete(id);
  io.emit('estado');
  emitirPainel();
}

// ---------- Agendamento automático ----------
function tick() {
  const t = agora();
  for (const h of all('SELECT * FROM horarios')) {
    const ini = paraMin(h.hora);
    const fim = paraMin(horaFim(h.hora, h.fim));
    if (horarioOcorre(h, t) && t.min >= ini && t.min < fim) {
      const desde = new Date(Date.now() - (t.min - ini + 1) * 60000).toISOString();
      if (!get('SELECT 1 x FROM sessoes WHERE sala_id=? AND aberta_em>=?', h.sala_id, desde) && get('SELECT 1 x FROM salas WHERE id=?', h.sala_id)) {
        const iniciarAteEm = limiteInicioAutomatico(h, t);
        const sessao = abrirSessao(h.sala_id, fimPrevistoDoHorario(h, t.min), null, iniciarAteEm);
        avaliarInicioAutomatico(sessao.id);
      }
    }
  }
  all("SELECT id FROM sessoes WHERE status='aguardando' AND iniciar_ate_em IS NOT NULL")
    .forEach((sessao) => avaliarInicioAutomatico(sessao.id));
  const limite = new Date(Date.now() - DURACAO_MIN * 60000).toISOString();
  all("SELECT id FROM sessoes WHERE status IN ('aguardando','iniciada') AND ((fim_previsto_em IS NOT NULL AND fim_previsto_em<=?) OR (fim_previsto_em IS NULL AND aberta_em<?))", new Date().toISOString(), limite)
    .forEach((s) => encerrarSessao(s.id));
}
setInterval(tick, 1000); tick();
setInterval(() => { if (sujo) { sujo = false; emitirRanking(); } }, 5000); // ranking a cada 5 s

// ---------- API do aluno ----------
app.get('/api/estado', (req, res) => {
  const id = +req.query.alunoId;
  if (id) {
    const a = get("SELECT a.id, a.nome, se.status FROM alunos a JOIN sessoes se ON se.id=a.sessao_id WHERE a.id=? AND se.status IN ('aguardando','iniciada')", id);
    if (a) return res.json({ aluno: { id: a.id, nome: a.nome }, status: a.status });
  }
  const s = primeira();
  const nomesSugeridos = s ? all(`SELECT DISTINCT ai.nome FROM alunos_importados ai
    JOIN importacoes_sala i ON i.id=ai.importacao_id WHERE i.sala_id=?
      AND NOT EXISTS (SELECT 1 FROM exclusoes_alunos_importados e
        WHERE e.sala_id=i.sala_id AND e.arquivo=i.arquivo
          AND e.linha_origem=ai.linha_origem AND e.nome IS NULL)
    ORDER BY ai.nome`, s.sala_id).map((x) => x.nome) : [];
  res.json(s ? { sessao: s.id, status: s.status, nomesSugeridos } : { sessao: null });
});

app.post('/api/alunos', ok((req, res) => {
  const s = primeira();
  if (!s) throw new Error('Nenhuma aula acontecendo agora.');
  const nome = String(req.body.nome || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!nome) throw new Error('Digite seu nome.');
  const partes = nome.split(' ').filter(Boolean);
  if (partes.length < 2) throw new Error('Digite seu nome e sobrenome.');
  const id = Number(run('INSERT INTO alunos(sessao_id,sala_id,nome) VALUES(?,?,?)', s.id, s.sala_id, nome).lastInsertRowid);
  avaliarInicioAutomatico(s.id);
  emitirPainel();
  res.json({ alunoId: id, nome, status: get('SELECT status FROM sessoes WHERE id=?', s.id).status });
}));

app.post('/api/pergunta', ok((req, res) => {
  const id = +req.body.alunoId;
  const a = get('SELECT a.*, sa.ano FROM alunos a JOIN salas sa ON sa.id=a.sala_id WHERE a.id=?', id);
  if (!a) throw new Error('Aluno não encontrado.');
  const se = get('SELECT status FROM sessoes WHERE id=?', a.sessao_id);
  if (se.status === 'encerrada') return res.json({ encerrada: true });
  if (se.status !== 'iniciada') return res.status(409).json({ erro: 'Aguarde o professor.' });
  const feitas = get('SELECT COUNT(*) n FROM respostas WHERE aluno_id=?', id).n;
  if (TOTAL > 0 && feitas >= TOTAL) return res.json({ fim: true, resumo: resumo(id) });
  if (!proximoDesafioPorAluno.has(id)) proximoDesafioPorAluno.set(id, feitas + intervaloDesafio());
  if (feitas >= proximoDesafioPorAluno.get(id) &&
      !get('SELECT 1 x FROM desafios WHERE aluno_id=? AND sessao_id=? AND rodada=?', id, a.sessao_id,
        get('SELECT COUNT(*) n FROM desafios WHERE aluno_id=? AND sessao_id=?', id, a.sessao_id).n + 1)) {
    return res.json({ pausa: true });
  }
  let q = pendentes.get(id);
  if (!q) {
    const ativ = all('SELECT atividade FROM conteudos WHERE sala_id=?', a.sala_id).map((x) => x.atividade).filter((x) => ATIVIDADES.includes(x));
    if (!ativ.length) {
      const padrao = ATIVIDADES_POR_ANO[a.ano] || ATIVIDADES;
      padrao.forEach((atividade) => run('INSERT OR IGNORE INTO conteudos(sala_id,atividade) VALUES(?,?)', a.sala_id, atividade));
      ativ.push(...ATIVIDADES_POR_ANO[a.ano] || ATIVIDADES);
    }
    if (!sorteadoresAtividade.has(id)) sorteadoresAtividade.set(id, criarSorteadorDeAtividades());
    const at = sorteadoresAtividade.get(id)(ativ);
    const turma = get('SELECT conteudo_maior_dificuldade FROM salas WHERE id=?', a.sala_id);
    const nivelBase = get('SELECT nivel FROM perfis WHERE aluno_id=? AND atividade=?', id, at)?.nivel ?? 1;
    const nivel = Math.min(a.ano === 2 ? 3 : 4,
      nivelBase + (conteudosReforco(turma?.conteudo_maior_dificuldade).includes(at) ? 1 : 0));
    if (!sorteadoresModelo.has(id)) sorteadoresModelo.set(id, new Map());
    const modelosDoAluno = sorteadoresModelo.get(id);
    if (!modelosDoAluno.has(at)) modelosDoAluno.set(at, criarSorteadorDeModelos());
    const pergunta = gerarPergunta(at, nivel, modelosDoAluno.get(at), a.ano, id);
    q = { p: pergunta, nivelReal: nivel, nivelMaximo: a.ano === 2 ? 3 : 4, t0: Date.now(), erros: 0, dica: 0, sessaoId: a.sessao_id, combo: comboPorAluno.get(id) || 0 };
    pendentes.set(id, q);
  }
  const { resposta, dica, ...pub } = q.p;
  res.json({ ...pub, numero: feitas + 1, total: TOTAL || null, maxDigitos: a.ano === 2 ? 2 : 3 });
}));

function processarResposta(id, resposta) {
  const q = pendentes.get(id);
  if (!q) throw new Error('Sem pergunta em andamento.');
  if (get('SELECT status FROM sessoes WHERE id=?', q.sessaoId).status !== 'iniciada') {
    return { status: 409, resultado: { erro: 'Sessão não está ativa.' } };
  }
  const seg = (Date.now() - q.t0) / 1000;
  const respondeuCorreto = String(resposta).trim() === q.p.resposta;
  if (!respondeuCorreto) q.erros++;
  // Regra: 2 erros na mesma pergunta = errada (mesmo que acerte depois).
  const correta = respondeuCorreto && q.erros <= 1;
  const comboAtual = comboPorAluno.get(id) || 0;
  const comboNovo = correta && q.erros === 0 && q.dica === 0 ? comboAtual + 1 : 0;
  const out = { correta, erros: q.erros, terminou: respondeuCorreto || q.erros >= 5 };
  if (!correta) {
    out.mensagem = q.erros >= 2 ? 'Vamos tentar com calma na próxima!' : mensagemErro(q.erros);
    if (q.erros >= 3) { out.dica = q.p.dica; q.dica = 1; }
    if (q.erros >= 5) out.respostaCerta = q.p.resposta;
    if (out.terminou && respondeuCorreto && q.erros > 1) out.respostaCerta = q.p.resposta;
  }
  if (out.terminou) {
    const tentativas = q.erros + 1; // inclui a tentativa final
    const pontos = correta ? calcularPontos({ nivel: q.nivelReal, tempoSegundos: seg, tentativas, dica: q.dica, correta: true, combo: comboNovo }) : 0;
    const nivel = Math.min(q.nivelMaximo, ajustarNivel(q.nivelReal, correta, seg, tentativas));
    run('INSERT INTO respostas(aluno_id,sessao_id,atividade,nivel,pergunta,resposta,correta,tentativas,dica,pontos,tempo) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      id, q.sessaoId, q.p.atividade, q.nivelReal, q.p.texto, String(resposta), correta ? 1 : 0, tentativas, q.dica, pontos, seg);
    run(`INSERT INTO perfis(aluno_id,atividade,nivel,acertos,erros,tempo_medio) VALUES(?,?,?,?,?,?)
         ON CONFLICT(aluno_id,atividade) DO UPDATE SET nivel=excluded.nivel,
         tempo_medio=(tempo_medio*(acertos+erros)+excluded.tempo_medio)/(acertos+erros+1),
         acertos=acertos+excluded.acertos, erros=erros+excluded.erros`, id, q.p.atividade, nivel, correta ? 1 : 0, correta ? 0 : 1, seg);
    comboPorAluno.set(id, correta && q.erros === 0 && q.dica === 0 ? comboNovo : 0);
    pendentes.delete(id); sujo = true; out.pontos = pontos;
    if (TOTAL > 0 && get('SELECT COUNT(*) n FROM respostas WHERE aluno_id=?', id).n >= TOTAL) {
      out.fim = true; out.resumo = resumo(id); sorteadoresModelo.delete(id); emitirRanking();
    }
  }
  return { status: 200, resultado: out };
}
app.post('/api/resposta', ok((req, res) => {
  const resultado = processarResposta(+req.body.alunoId, req.body.resposta);
  res.status(resultado.status).json(resultado.resultado);
}));
app.post('/api/resposta/teclado', ok((req, res) => {
  const id = +req.body.alunoId, q = pendentes.get(id);
  if (!q) throw new Error('Sem pergunta em andamento.');
  if (q.p.tipo !== 'digitar') throw new Error('A pergunta atual não aceita resposta pelo teclado.');
  if (get('SELECT status FROM sessoes WHERE id=?', q.sessaoId).status !== 'iniciada') {
    return res.status(409).json({ erro: 'Sessão não está ativa.' });
  }
  if (String(req.body.resposta).trim() !== q.p.resposta) return res.json({ correta: false });
  const resultado = processarResposta(id, req.body.resposta);
  res.status(resultado.status).json(resultado.resultado);
}));

app.post('/api/desafio', ok((req, res) => {
  const id = +req.body.alunoId;
  const a = get('SELECT a.sessao_id, sa.ano FROM alunos a JOIN salas sa ON sa.id=a.sala_id WHERE a.id=?', id);
  if (!a) throw new Error('Aluno não encontrado.');
  if (get('SELECT status FROM sessoes WHERE id=?', a.sessao_id)?.status !== 'iniciada') {
    return res.status(409).json({ erro: 'Sessão não está ativa.' });
  }
  const feitas = get('SELECT COUNT(*) n FROM respostas WHERE aluno_id=?', id).n;
  if (!proximoDesafioPorAluno.has(id)) proximoDesafioPorAluno.set(id, feitas + intervaloDesafio());
  if (feitas < proximoDesafioPorAluno.get(id)) {
    return res.status(409).json({ erro: 'O desafio ainda não está disponível.' });
  }
  const rodada = get('SELECT COUNT(*) n FROM desafios WHERE aluno_id=? AND sessao_id=?', id, a.sessao_id).n + 1;
  const concluido = get('SELECT pontos FROM desafios WHERE aluno_id=? AND sessao_id=? AND rodada=?', id, a.sessao_id, rodada);
  if (concluido) return res.json({ concluido: true, pontos: concluido.pontos });

  let pendente = desafiosPendentes.get(id);
  if (!pendente || pendente.sessaoId !== a.sessao_id || pendente.rodada !== rodada) {
    const perfil = get('SELECT COALESCE(AVG(nivel),1) nivel FROM perfis WHERE aluno_id=?', id);
    const p = criarDesafio(rodada, perfil.nivel, a.ano);
    const tempoLimite = 15;
    pendente = { p, iniciadoEm: Date.now(), rodada, sessaoId: a.sessao_id, tempoLimite, concluido: false };
    desafiosPendentes.set(id, pendente);
  }
  const { resposta, ...publico } = pendente.p;
  res.json({ ...publico, tempoLimite: pendente.tempoLimite,
    tempoRestante: Math.max(0, pendente.tempoLimite - Math.ceil((Date.now() - pendente.iniciadoEm) / 1000)) });
}));

app.post('/api/desafio/resposta', ok((req, res) => {
  const id = +req.body.alunoId, pendente = desafiosPendentes.get(id);
  if (!pendente) throw new Error('Não há desafio em andamento.');
  if (get('SELECT status FROM sessoes WHERE id=?', pendente.sessaoId)?.status !== 'iniciada') {
    return res.status(409).json({ erro: 'Sessão não está ativa.' });
  }
  if (pendente.concluido) return res.json({
    correta: pendente.pontos === 50, expirou: pendente.pontos === 0, pontos: pendente.pontos, concluido: true
  });

  const expirou = Date.now() - pendente.iniciadoEm >= pendente.tempoLimite * 1000 || String(req.body.resposta) === '__timeout__';
  const correta = !expirou && String(req.body.resposta || '').trim().toLocaleLowerCase('pt-BR') ===
    String(pendente.p.resposta).trim().toLocaleLowerCase('pt-BR');
  if (!correta && !expirou) return res.json({ correta: false, expirou: false });

  const pontos = correta ? 50 : 0;
  run('INSERT OR IGNORE INTO desafios(aluno_id,sessao_id,rodada,tipo,pontos) VALUES(?,?,?,?,?)',
    id, pendente.sessaoId, pendente.rodada, pendente.p.tipo, pontos);
  pendente.concluido = true; pendente.pontos = pontos;
  proximoDesafioPorAluno.set(id, get('SELECT COUNT(*) n FROM respostas WHERE aluno_id=?', id).n + intervaloDesafio());
  if (correta) emitirRanking();
  res.json({ correta, expirou, pontos });
}));

app.get('/api/resumo/:id', ok((req, res) => res.json(resumo(+req.params.id))));

// ---------- API do admin ----------
app.post('/api/admin/login', ok((req, res) => {
  const a = get('SELECT * FROM admins WHERE usuario=?', String(req.body.usuario || ''));
  if (!a || !confere(String(req.body.senha || ''), a.senha_hash)) return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  const t = crypto.randomBytes(24).toString('hex');
  tokens.set(t, { usuario: a.usuario, papel: a.tipo_acesso });
  res.json({ token: t, papel: a.tipo_acesso });
}));
app.get('/api/admin/sessao', auth, ok((req, res) => {
  const sessao = tokens.get(req.get('x-token'));
  res.json({ papel: sessao.papel, usuario: sessao.usuario });
}));
app.get('/api/admin/usuarios', authAdmin, ok((q, res) => {
  res.json(all('SELECT id,usuario,tipo_acesso FROM admins ORDER BY usuario COLLATE NOCASE'));
}));
app.post('/api/admin/usuarios', authAdmin, ok((req, res) => {
  const usuario = String(req.body.usuario || '').trim();
  const senha = String(req.body.senha || '');
  const tipoAcesso = String(req.body.tipo_acesso || '');
  if (usuario.length < 1 || usuario.length > 50) {
    throw new Error('O usuário deve ter entre 1 e 50 caracteres.');
  }
  if (senha.length < 8 || senha.length > 128) {
    throw new Error('A senha deve ter entre 8 e 128 caracteres.');
  }
  if (!['professor', 'admin'].includes(tipoAcesso)) {
    throw new Error('Escolha Professor ou Administrador para o novo usuário.');
  }
  if (get('SELECT 1 FROM admins WHERE usuario=?', usuario)) {
    throw new Error('Este usuário já existe.');
  }
  run("INSERT INTO admins(usuario,senha_hash,papel,tipo_acesso) VALUES(?,?,'admin',?)", usuario, hash(senha), tipoAcesso);
  res.status(201).json({ ok: true });
}));
app.put('/api/admin/usuarios/:id/senha', authAdmin, ok((req, res) => {
  const id = Number(req.params.id);
  const senha = String(req.body.senha || '');
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Usuário inválido.');
  if (senha.length < 8 || senha.length > 128) {
    throw new Error('A senha deve ter entre 8 e 128 caracteres.');
  }
  const usuario = get('SELECT id,usuario FROM admins WHERE id=?', id);
  if (!usuario) throw new Error('Usuário não encontrado.');
  run('UPDATE admins SET senha_hash=? WHERE id=?', hash(senha), id);
  const tokenAtual = req.get('x-token');
  for (const [token, sessao] of tokens) {
    if (sessao.usuario === usuario.usuario && token !== tokenAtual) tokens.delete(token);
  }
  res.json({ ok: true });
}));
app.delete('/api/admin/usuarios/:id', authAdmin, ok((req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Usuário inválido.');
  const usuario = get('SELECT id,usuario,tipo_acesso FROM admins WHERE id=?', id);
  if (!usuario) throw new Error('Usuário não encontrado.');
  const tokenAtual = tokens.get(req.get('x-token'));
  if (usuario.tipo_acesso === 'admin' &&
      get("SELECT COUNT(*) AS n FROM admins WHERE tipo_acesso='admin'").n <= 1) {
    throw new Error('Não é possível excluir o último Administrador.');
  }
  run('DELETE FROM admins WHERE id=?', id);
  for (const [token, sessao] of tokens) {
    if (sessao.usuario === usuario.usuario) tokens.delete(token);
  }
  res.json({ ok: true, sessaoEncerrada: usuario.usuario === tokenAtual.usuario });
}));
function conteudosReforco(valor) {
  if (Array.isArray(valor)) return [...new Set(valor.filter((atividade) => ATIVIDADES.includes(atividade)))];
  if (!valor || typeof valor !== 'string') return [];
  try {
    const lista = JSON.parse(valor);
    if (Array.isArray(lista)) return [...new Set(lista.filter((atividade) => ATIVIDADES.includes(atividade)))];
  } catch {}
  return ATIVIDADES.includes(valor) ? [valor] : [];
}
const salasCompletas = () => all('SELECT * FROM salas ORDER BY nome').map(({ periodo, dificuldade, ...s }) => ({ ...s,
  _contadorAtividades: get("SELECT COUNT(*) AS n FROM sessoes WHERE sala_id=? AND status NOT IN ('cancelada','excluida')", s.id).n,
  conteudo_maior_dificuldade: conteudosReforco(s.conteudo_maior_dificuldade),
  horarios: all('SELECT dia,data,hora,fim,inicio_espera_min FROM horarios WHERE sala_id=? ORDER BY dia,hora', s.id),
  atividades: all('SELECT atividade FROM conteudos WHERE sala_id=?', s.id).map((x) => x.atividade).filter((x) => ATIVIDADES.includes(x)) }));
function salvarSala(id, b) {
  const { nome, ano, professor, conteudo_maior_dificuldade = null, horarios = [], atividades = [] } = b;
  const nomeProfessor = normalizarNomeProfessor(professor);
  if (!String(nome || '').trim() || ![2, 3].includes(+ano)) throw new Error('Preencha nome e ano.');
  const conteudosReforcar = Array.isArray(conteudo_maior_dificuldade)
    ? [...new Set(conteudo_maior_dificuldade)] : conteudo_maior_dificuldade ? [conteudo_maior_dificuldade] : [];
  if (conteudosReforcar.some((atividade) => !ATIVIDADES.includes(atividade))) {
    throw new Error('Selecione somente conteúdos válidos para reforçar.');
  }
  const conteudosReforcarSalvos = conteudosReforcar.length ? JSON.stringify(conteudosReforcar) : null;
  const horariosValidos = horarios.filter((h) => h.hora).map((h) => {
    const fim = h.fim || horaFim(h.hora);
    const data = h.data || null;
    const inicioEspera = h.inicio_espera_min == null ? 8 : Number(h.inicio_espera_min);
    if (!Number.isInteger(+h.dia) || +h.dia < 0 || +h.dia > 6 ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(h.hora) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(fim) ||
        !Number.isInteger(inicioEspera) || inicioEspera < 0 || inicioEspera > 60 ||
        paraMin(fim) <= paraMin(h.hora) ||
        (data !== null && (diaDaData(data) === null || diaDaData(data) !== +h.dia))) {
      throw new Error('Confira o dia, a data, os horários e configure a espera do início automático entre 0 e 60 minutos.');
    }
    return { dia: +h.dia, data, hora: h.hora, fim, inicio_espera_min: inicioEspera };
  });
  for (let i = 0; i < horariosValidos.length; i++) {
    for (let j = i + 1; j < horariosValidos.length; j++) {
      const a = horariosValidos[i], b = horariosValidos[j];
      if (horariosSeSobrepoem(a, b)) {
        throw new Error('Os horários da mesma sala não podem se sobrepor.');
      }
    }
  }
  if (id) { run('UPDATE salas SET nome=?,ano=?,professor=?,conteudo_maior_dificuldade=? WHERE id=?', nome.trim(), +ano, nomeProfessor, conteudosReforcarSalvos, id);
    ['horarios', 'conteudos'].forEach((t) => run(`DELETE FROM ${t} WHERE sala_id=?`, id)); }
  else id = Number(run('INSERT INTO salas(nome,ano,professor,conteudo_maior_dificuldade) VALUES(?,?,?,?)', nome.trim(), +ano, nomeProfessor, conteudosReforcarSalvos).lastInsertRowid);
  horariosValidos.forEach((h) => run('INSERT INTO horarios(sala_id,dia,data,hora,fim,inicio_espera_min) VALUES(?,?,?,?,?,?)',
    id, h.dia, h.data, h.hora, h.fim, h.inicio_espera_min));
  const listaAtividades = (atividades.length ? atividades : (ATIVIDADES_POR_ANO[+ano] || ATIVIDADES)).filter((a) => ATIVIDADES.includes(a));
  listaAtividades.forEach((a) => run('INSERT INTO conteudos(sala_id,atividade) VALUES(?,?)', id, a));
  return id;
}
app.get('/api/admin/salas', auth, ok((q, res) => res.json(salasCompletas())));
app.post('/api/admin/salas', auth, ok((req, res) => res.json({ id: salvarSala(null, req.body) })));
app.put('/api/admin/salas/:id', auth, ok((req, res) => res.json({ id: salvarSala(+req.params.id, req.body) })));
function excluirSala(id) {
  all("SELECT id FROM sessoes WHERE sala_id=? AND status IN ('aguardando','iniciada')", id).forEach((s) => encerrarSessao(s.id));
  ['horarios', 'conteudos'].forEach((t) => run(`DELETE FROM ${t} WHERE sala_id=?`, id)); run('DELETE FROM salas WHERE id=?', id);
}
app.delete('/api/admin/salas', auth, ok((req, res) => {
  const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) throw new Error('Selecione pelo menos uma sala.');
  if (ids.some((id) => !get('SELECT 1 x FROM salas WHERE id=?', id))) throw new Error('Uma ou mais salas não foram encontradas. Atualize a lista e tente novamente.');
  ids.forEach((id) => excluirSala(id));
  res.json({ ok: true, removidas: ids.length });
}));
app.delete('/api/admin/salas/:id', auth, ok((req, res) => {
  excluirSala(+req.params.id);
  res.json({ ok: true });
}));

app.get('/api/admin/painel', auth, ok((q, res) => res.json(painel())));
app.post('/api/admin/sessoes', auth, ok((req, res) => {
  if (!get('SELECT 1 x FROM salas WHERE id=?', +req.body.sala_id)) throw new Error('Sala inválida.');
  const rotulo = req.body.rotulo ? String(req.body.rotulo).trim().slice(0, 80) : null;
  res.json(abrirSessao(+req.body.sala_id, null, rotulo));
}));
app.post('/api/admin/sessoes/:id/iniciar', auth, ok((req, res) => {
  const id = +req.params.id;
  res.json({ ok: true, iniciada: iniciarSessao(id) });
}));
app.post('/api/admin/sessoes/:id/cancelar', auth, ok((req, res) => {
  cancelarSessao(+req.params.id);
  res.json({ ok: true, cancelada: true });
}));
app.post('/api/admin/sessoes/:id/encerrar', auth, ok((req, res) => { encerrarSessao(+req.params.id); res.json({ ok: true }); }));
app.delete('/api/admin/sessoes/:id', authAdmin, ok((req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Atividade inválida.');
  const alunoIds = excluirAtividade(db, id);
  for (const alunoId of alunoIds) {
    pendentes.delete(alunoId);
    desafiosPendentes.delete(alunoId);
    proximoDesafioPorAluno.delete(alunoId);
    sorteadoresModelo.delete(alunoId);
    comboPorAluno.delete(alunoId);
    limparSorteadoresNumericos(alunoId);
  }
  online.delete(id);
  io.emit('estado');
  emitirPainel();
  res.json({ ok: true });
}));

// Histórico de atividades (sessões encerradas) por sala
app.get('/api/admin/sessoes-encerradas', auth, ok((req, res) => {
  const salaId = +req.query.sala_id;
  const condicao = salaId ? 'AND se.sala_id=?' : '';
  const params = salaId ? [salaId] : [];
  const rows = all(`SELECT se.id, se.sala_id, se.importacao_id, se.rotulo, se.aberta_em, se.iniciada_em, se.encerrada_em,
      sa.nome AS sala, sa.ano,
      (SELECT COUNT(*) FROM alunos a WHERE a.sessao_id=se.id) AS alunos,
      (SELECT COUNT(*) FROM respostas r WHERE r.sessao_id=se.id) AS respostas
    FROM sessoes se JOIN salas sa ON sa.id=se.sala_id
    WHERE se.status='encerrada' ${condicao}
    ORDER BY se.encerrada_em DESC, se.id DESC LIMIT 500`, ...params);
  res.json(rows.map((r) => {
    const importacao = detalharAtividadeImportada(db, r);
    return importacao
      ? { ...r, alunos: importacao.totais.criancas, respostas: importacao.totais.respostas }
      : { ...r, rotulo: r.rotulo || rotuloAtividade(r) };
  }));
}));

app.get('/api/admin/alunos', auth, ok((q, res) => res.json(all('SELECT a.id, a.nome, sa.nome AS sala FROM alunos a JOIN salas sa ON sa.id=a.sala_id ORDER BY a.id DESC LIMIT 300'))));
app.get('/api/admin/ranking', auth, ok((req, res) => {
  const s = get('SELECT id FROM sessoes WHERE sala_id=? ORDER BY id DESC', +req.query.sala_id);
  res.json(req.query.sala_id ? (s ? ranking(s.id) : []) : rankingGeral());
}));

// ============ RELATÓRIOS ============
// Estrutura: por turma -> por atividade (sessão) com data

const NOMES_ATIVIDADES_PT = {
  soma: 'Soma', subtracao: 'Subtração', multiplicacao: 'Multiplicação', sequencia: 'Sequência',
  formas: 'Formas', medidas: 'Medidas', par_impar: 'Par ou ímpar', maior_menor: 'Maior ou menor',
  antecessor_sucessor: 'Antecessor e sucessor'
};

function detalharSessao(sessaoId) {
  const sessao = get(`SELECT se.*, sa.nome AS sala, sa.ano FROM sessoes se
    JOIN salas sa ON sa.id=se.sala_id WHERE se.id=?`, sessaoId);
  if (!sessao || sessao.status === 'excluida') return null;
  const relatorioImportado = detalharAtividadeImportada(db, sessao);
  if (relatorioImportado) return relatorioImportado;
  const alunos = all(`SELECT a.id, a.nome,
      COUNT(r.id) AS perguntas,
      COALESCE(SUM(r.correta),0) AS acertos,
      CASE WHEN COUNT(r.id)=0 THEN NULL ELSE ROUND(100.0 * SUM(${aproveitamentoResposta('r')}) / COUNT(r.id), 1) END AS percentual_acerto,
      COALESCE(SUM(r.pontos),0) + COALESCE((SELECT SUM(d.pontos) FROM desafios d WHERE d.aluno_id=a.id AND d.sessao_id=a.sessao_id),0) AS pontos_total,
      ROUND(AVG(r.tempo),1) AS tempo_medio_s,
      MAX(r.nivel) AS nivel_maximo
    FROM alunos a LEFT JOIN respostas r ON r.aluno_id=a.id
    WHERE a.sessao_id=?
    GROUP BY a.id ORDER BY pontos_total DESC, a.nome`, sessaoId);
  const porAtividade = all(`SELECT r.atividade,
      COUNT(*) AS perguntas,
      SUM(r.correta) AS acertos,
      ROUND(100.0 * SUM(${aproveitamentoResposta('r')}) / COUNT(*), 1) AS percentual_acerto,
      ROUND(AVG(r.tempo),1) AS tempo_medio_s
    FROM respostas r WHERE r.sessao_id=?
    GROUP BY r.atividade ORDER BY percentual_acerto, r.atividade`, sessaoId);
  const porAlunoAtividade = all(`SELECT a.nome AS aluno, a.id AS aluno_id, r.atividade,
      COUNT(*) AS perguntas, SUM(r.correta) AS acertos,
      ROUND(100.0 * SUM(${aproveitamentoResposta('r')}) / COUNT(*), 1) AS percentual_acerto
    FROM respostas r JOIN alunos a ON a.id=r.aluno_id
    WHERE r.sessao_id=? GROUP BY a.id, r.atividade
    ORDER BY a.nome, percentual_acerto`, sessaoId);
  const totais = get(`SELECT
      COUNT(DISTINCT a.id) AS criancas,
      MAX((SELECT COUNT(*) FROM respostas r2 WHERE r2.aluno_id=a.id AND r2.sessao_id=?)) AS perguntas_max,
      SUM(r.correta) AS acertos,
      COUNT(r.id) AS respostas,
      SUM(r.pontos) AS pontos,
      SUM(${aproveitamentoResposta('r')}) AS aproveitamento_soma
    FROM alunos a LEFT JOIN respostas r ON r.aluno_id=a.id AND r.sessao_id=?
    WHERE a.sessao_id=?`, sessaoId, sessaoId, sessaoId);
  const percentualGeral = totais.respostas ? Math.round(1000 * totais.aproveitamento_soma / totais.respostas) / 10 : 0;
  const atividadesComDificuldade = porAtividade.filter((a) => a.percentual_acerto < 100);
  const maisDificil = atividadesComDificuldade.length ? atividadesComDificuldade[0] : null;
  const inicio = sessao.iniciada_em || sessao.aberta_em;
  const fim = sessao.encerrada_em;
  const duracaoMin = inicio && fim ? Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / 60000)) : null;
  return {
    id: sessao.id, sala_id: sessao.sala_id, sala: sessao.sala, ano: sessao.ano,
    rotulo: sessao.rotulo || rotuloAtividade(sessao),
    status: sessao.status, aberta_em: sessao.aberta_em, iniciada_em: sessao.iniciada_em, encerrada_em: sessao.encerrada_em,
    duracao_min: duracaoMin,
    totais: { ...totais, percentual_geral: percentualGeral },
    atividade_mais_dificil: maisDificil,
    alunos, por_atividade: porAtividade, por_aluno_atividade: porAlunoAtividade
  };
}

function relatorioPorSala(salaId, desde, ate) {
  const sala = get('SELECT * FROM salas WHERE id=?', salaId);
  if (!sala) throw new Error('Sala não encontrada.');
  const condicoes = ["se.sala_id=?", "se.status='encerrada'"];
  const params = [salaId];
  if (desde) { condicoes.push('DATE(COALESCE(se.iniciada_em, se.aberta_em)) >= ?'); params.push(desde); }
  if (ate) { condicoes.push('DATE(COALESCE(se.iniciada_em, se.aberta_em)) <= ?'); params.push(ate); }
  const sessoes = all(`SELECT se.id FROM sessoes se WHERE ${condicoes.join(' AND ')} ORDER BY COALESCE(se.iniciada_em, se.aberta_em) DESC`, ...params);
  const atividades = sessoes.map((s) => detalharSessao(s.id)).filter(Boolean);
  return { sala: { id: sala.id, nome: sala.nome, ano: sala.ano, professor: sala.professor }, atividades };
}

app.get('/api/admin/relatorio', auth, ok((req, res) => {
  const tipo = String(req.query.tipo || 'geral');
  const salaId = +req.query.sala_id;
  const sessaoId = +req.query.sessao_id;
  const desde = req.query.desde || null;
  const ate = req.query.ate || null;

  if (tipo === 'sessao' && Number.isSafeInteger(sessaoId) && sessaoId > 0) {
    const dados = detalharSessao(sessaoId);
    if (!dados) throw new Error('Atividade não encontrada.');
    return res.json(dados);
  }
  if (tipo === 'sala' && Number.isSafeInteger(salaId) && salaId > 0) {
    return res.json(relatorioPorSala(salaId, desde, ate));
  }
  // Geral: todas as salas e suas atividades
  const salas = all('SELECT * FROM salas ORDER BY nome');
  const resultado = salas.map((sala) => ({
    sala: { id: sala.id, nome: sala.nome, ano: sala.ano, professor: sala.professor },
    atividades: all(`SELECT se.id FROM sessoes se WHERE se.sala_id=? AND se.status='encerrada'
      ${desde ? 'AND DATE(COALESCE(se.iniciada_em, se.aberta_em)) >= ?' : ''}
      ${ate ? 'AND DATE(COALESCE(se.iniciada_em, se.aberta_em)) <= ?' : ''}
      ORDER BY COALESCE(se.iniciada_em, se.aberta_em) DESC`,
      ...[sala.id, ...(desde ? [desde] : []), ...(ate ? [ate] : [])])
      .map((s) => detalharSessao(s.id)).filter(Boolean)
  }));
  res.json(resultado);
}));

function montarDadosExportacao(tipo, req) {
  if (tipo === 'sala') {
    const salaId = +req.query.sala_id;
    const dados = relatorioPorSala(salaId, req.query.desde || null, req.query.ate || null);
    return dados;
  }
  if (tipo === 'sessao') {
    const dados = detalharSessao(+req.query.sessao_id);
    if (!dados) throw new Error('Atividade não encontrada.');
    return { sala: { id: dados.sala_id, nome: dados.sala, ano: dados.ano }, atividades: [dados] };
  }
  const salas = all('SELECT * FROM salas ORDER BY nome');
  return salas.map((sala) => ({
    sala: { id: sala.id, nome: sala.nome, ano: sala.ano, professor: sala.professor },
    atividades: all(`SELECT id FROM sessoes WHERE sala_id=? AND status='encerrada' ORDER BY COALESCE(iniciada_em, aberta_em) DESC`, sala.id)
      .map((s) => detalharSessao(s.id)).filter(Boolean)
  }));
}

// Exportação PDF melhorada
app.get('/api/admin/relatorio.pdf', auth, ok((req, res) => {
  const tipo = String(req.query.tipo || 'geral');
  const dados = montarDadosExportacao(tipo, req);
  const lista = Array.isArray(dados) ? dados : [dados];
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
  const partes = [];
  doc.on('data', (p) => partes.push(p));
  doc.on('end', () => {
    res.type('application/pdf');
    res.set('Content-Disposition', `attachment; filename="relatorio-${tipo}.pdf"`);
    res.send(Buffer.concat(partes));
  });

  const AZUL = '#1d2b4f';
  const AZUL_CLARO = '#3a6fe0';
  const CINZA = '#526579';
  const FUNDO_TABELA = '#f4f8fb';
  const BORDA = '#cfe3f5';
  const paginaW = doc.page.width - 72;

  function titulo(texto, subtitulo) {
    doc.font('Helvetica-Bold').fontSize(20).fillColor(AZUL).text(texto, 36, 36);
    if (subtitulo) {
      doc.font('Helvetica').fontSize(10).fillColor(CINZA).text(subtitulo, 36, doc.y + 2);
    }
    doc.moveDown(0.6);
    doc.moveTo(36, doc.y).lineTo(36 + paginaW, doc.y).strokeColor(BORDA).lineWidth(1).stroke();
    doc.moveDown(0.5);
  }

  function subtitulo(texto) {
    if (doc.y > doc.page.height - 80) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(AZUL).text(texto, 36, doc.y);
    doc.moveDown(0.3);
  }

  function tabela(headers, rows, widths) {
    const alturaLinha = 18;
    const totalWidth = paginaW;
    let x = 36;
    if (doc.y + alturaLinha * (rows.length + 1) > doc.page.height - 40) doc.addPage();
    let y = doc.y;
    // Cabeçalho
    doc.rect(36, y, totalWidth, alturaLinha).fillAndStroke(AZUL, AZUL);
    x = 36;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    headers.forEach((h, i) => {
      doc.text(h, x + 4, y + 5, { width: (widths?.[i] || totalWidth / headers.length) - 8, height: alturaLinha });
      x += widths?.[i] || totalWidth / headers.length;
    });
    y += alturaLinha;
    // Corpo
    let zebra = false;
    for (const row of rows) {
      if (y + alturaLinha > doc.page.height - 30) {
        doc.addPage();
        y = doc.y;
        // Repetir cabeçalho
        doc.rect(36, y, totalWidth, alturaLinha).fillAndStroke(AZUL, AZUL);
        x = 36;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
        headers.forEach((h, i) => {
          doc.text(h, x + 4, y + 5, { width: (widths?.[i] || totalWidth / headers.length) - 8, height: alturaLinha });
          x += widths?.[i] || totalWidth / headers.length;
        });
        y += alturaLinha;
        zebra = false;
      }
      doc.rect(36, y, totalWidth, alturaLinha).fillAndStroke(zebra ? FUNDO_TABELA : '#ffffff', BORDA);
      x = 36;
      doc.font('Helvetica').fontSize(8).fillColor(AZUL);
      row.forEach((valor, i) => {
        doc.text(String(valor ?? ''), x + 4, y + 5, { width: (widths?.[i] || totalWidth / headers.length) - 8, height: alturaLinha });
        x += widths?.[i] || totalWidth / headers.length;
      });
      y += alturaLinha;
      zebra = !zebra;
    }
    doc.y = y + 8;
  }

  titulo('Relatório de Desempenho', `Matemática Divertida · ${new Date().toLocaleString('pt-BR')}`);

  // Resumo por atividade
  subtitulo('Resumo das Atividades');
  const resumoRows = [];
  for (const item of lista) {
    for (const atv of (item.atividades || [item])) {
      const data = atv.iniciada_em || atv.aberta_em;
      resumoRows.push([
        item.sala.nome, atv.rotulo,
        data ? new Date(data).toLocaleString('pt-BR') : '-',
        atv.duracao_min == null ? '-' : `${atv.duracao_min} min`,
        atv.totais.criancas ?? 0,
        atv.totais.respostas ?? 0,
        atv.totais.acertos ?? 0,
        `${(atv.totais.percentual_geral ?? 0).toFixed(1)}%`,
        atv.totais.pontos ?? 0,
        atv.atividade_mais_dificil ? (NOMES_ATIVIDADES_PT[atv.atividade_mais_dificil.atividade] || atv.atividade_mais_dificil.atividade) : '-',
        atv.atividade_mais_dificil ? `${atv.atividade_mais_dificil.percentual_acerto}%` : '-'
      ]);
    }
  }
  tabela(
    ['Sala', 'Atividade', 'Data', 'Duração', 'Crianças', 'Respostas', 'Acertos', '% Aprov.', 'Pontos', 'Maior dificuldade', '% Dificuldade'],
    resumoRows,
    [95, 80, 70, 40, 40, 45, 40, 40, 42, 85, 45]
  );

  // Ranking geral
  subtitulo('Ranking Geral');
  const todosAlunos = [];
  for (const item of lista) {
    for (const atv of (item.atividades || [item])) {
      for (const a of atv.alunos) {
        todosAlunos.push({ aluno: a.nome, sala: item.sala.nome, atividade: atv.rotulo, perguntas: a.perguntas, acertos: a.acertos, percentual: a.percentual_acerto, pontos: a.pontos_total });
      }
    }
  }
  todosAlunos.sort((a, b) => (b.pontos || 0) - (a.pontos || 0));
  tabela(
    ['#', 'Aluno', 'Sala', 'Atividade', 'Perguntas', 'Acertos', '% Aprov.', 'Pontos'],
    todosAlunos.map((a, i) => [
      i + 1, a.aluno, a.sala, a.atividade, a.perguntas, a.acertos,
      a.percentual == null ? '-' : `${a.percentual}%`, a.pontos
    ]),
    [25, 170, 100, 100, 50, 50, 50, 55]
  );

  // Por sala -> por atividade -> alunos
  for (const item of lista) {
    if (doc.y > doc.page.height - 120) doc.addPage();
    subtitulo(`Sala: ${item.sala.nome}`);
    for (const atv of (item.atividades || [item])) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      const data = atv.iniciada_em || atv.aberta_em;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(AZUL_CLARO)
        .text(`${atv.rotulo}${data ? ' — ' + new Date(data).toLocaleString('pt-BR') : ''}`, 36, doc.y);
      doc.moveDown(0.2);
      if (atv.alunos.length) {
        tabela(
          ['Aluno', 'Perguntas', 'Acertos', '% Aprov.', 'Pontos', 'Tempo médio (s)'],
          atv.alunos.map((a) => [a.nome, a.perguntas, a.acertos, a.percentual_acerto == null ? '-' : `${a.percentual_acerto}%`, a.pontos_total ?? 0, a.tempo_medio_s == null ? '-' : a.tempo_medio_s]),
          [220, 65, 60, 60, 60, 65]
        );
      } else {
        doc.font('Helvetica').fontSize(9).fillColor(CINZA).text('Sem dados de crianças nesta atividade.', 36);
        doc.moveDown(0.5);
      }
    }
  }

  // Rodapé com números de página
  const totalPaginas = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPaginas; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor(CINZA)
      .text(`Página ${i + 1} de ${totalPaginas}`, 36, doc.page.height - 24, { width: paginaW, align: 'right' });
  }

  doc.end();
}));

// ---------- Tempo real ----------
io.on('connection', (s) => {
  s.on('entrar', ({ alunoId }) => {
    const a = get('SELECT sessao_id FROM alunos WHERE id=?', +alunoId); if (!a) return;
    s.data.sessao = a.sessao_id; s.join('s' + a.sessao_id);
    if (!online.has(a.sessao_id)) online.set(a.sessao_id, new Set());
    online.get(a.sessao_id).add(s.id); emitirRanking();
  });
  s.on('admin', ({ token }) => { if (tokens.has(token)) { s.join('admin'); s.emit('painel', painel()); } });
  s.on('disconnect', () => { online.get(s.data.sessao)?.delete(s.id); emitirPainel(); });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Matemática Divertida: http://localhost:${PORT}`);
  Object.values(os.networkInterfaces()).flat().filter((ip) => ip && ip.family === 'IPv4' && !ip.internal)
    .forEach((ip) => {
      console.log(`Rede local (alunos): http://${ip.address}:${PORT}`);
      console.log(`Rede local (professor): http://${ip.address}:${PORT}/admin.html`);
    });
  console.log(`Painel do professor: http://localhost:${PORT}/admin.html`);
});
