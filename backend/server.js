const path = require('path'), http = require('http'), crypto = require('crypto'), os = require('os');
const express = require('express');
const { Server } = require('socket.io');
const db = require('./database');
const { configurarAdmin, confere } = require('./engine/admin');
const { ATIVIDADES, ATIVIDADES_POR_ANO, gerarPergunta, criarSorteadorDeAtividades, criarSorteadorDeModelos } = require('./engine/gerador');
const { criarDesafio } = require('./engine/desafios');
const { calcularPontos, ajustarNivel, mensagemErro, premio, nota } = require('./engine/regras');
const { agora, paraMin, horaFim, sobrepoe, DURACAO_MIN } = require('./agendamento');

const TOTAL = Number(process.env.TOTAL_PERGUNTAS || 0);
const PERGUNTAS_POR_RODADA = 6;
const app = express(), server = http.createServer(app), io = new Server(server);
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/admin', (q, r) => r.redirect('/admin.html'));

const get = (s, ...p) => db.prepare(s).get(...p);
const all = (s, ...p) => db.prepare(s).all(...p);
const run = (s, ...p) => db.prepare(s).run(...p);
const ok = (fn) => (req, res) => { try { fn(req, res); } catch (e) { res.status(400).json({ erro: e.message }); } };

// ---------- Admin: senha criptografada (scrypt) + token de sessão ----------
const tinhaAdmin = Boolean(get('SELECT 1 x FROM admins'));
configurarAdmin(db, process.env.ADMIN_USER || 'admin', process.env.ADMIN_PASS || 'admin123', process.env.NODE_ENV === 'production', {
  usuario: process.env.PRIMARY_ADMIN_USER,
  senha: process.env.PRIMARY_ADMIN_PASS,
});
if (!tinhaAdmin && process.env.NODE_ENV !== 'production') console.log('Admin criado. Usuário padrão: admin / admin123 (troque com ADMIN_USER e ADMIN_PASS).');
const tokens = new Map();
const auth = (req, res, next) => (tokens.has(req.get('x-token')) ? next() : res.status(401).json({ erro: 'Faça login.' }));
const authPrimario = (req, res, next) => {
  if (!tokens.has(req.get('x-token'))) return res.status(401).json({ erro: 'Faça login.' });
  if (tokens.get(req.get('x-token')).papel !== 'primario') {
    return res.status(403).json({ erro: 'Apenas o administrador primário pode excluir dados de crianças.' });
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
let sujo = false;

const abertas = () => all(`SELECT se.*, sa.nome AS sala, sa.ano FROM sessoes se JOIN salas sa ON sa.id=se.sala_id WHERE se.status!='encerrada' ORDER BY se.id`);
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
  ) ORDER BY pontos DESC, nome LIMIT 50`);
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
const painel = () => abertas().map((s) => ({ id: s.id, sala_id: s.sala_id, sala: s.sala, status: s.status,
  conectados: online.get(s.id)?.size || 0, alunos: get('SELECT COUNT(*) n FROM alunos WHERE sessao_id=?', s.id).n,
  aberta_em: s.aberta_em, iniciada_em: s.iniciada_em, encerrada_em: s.encerrada_em,
  terminaram: terminaram(s.id), ranking: ranking(s.id).slice(0, 10) }));
function emitirPainel() { const p = painel(); io.to('admin').emit('painel', p); p.forEach((s) => io.to('s' + s.id).emit('conectados', s.conectados)); }
function emitirRanking() {
  abertas().forEach((s) => io.to('s' + s.id).emit('ranking', ranking(s.id).slice(0, 10)));
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
function abrirSessao(salaId, fimPrevistoEm) {
  const ex = get("SELECT * FROM sessoes WHERE sala_id=? AND status!='encerrada'", salaId);
  if (ex) return ex;
  if (!fimPrevistoEm) {
    const t = agora();
    const horarioAtivo = all('SELECT * FROM horarios WHERE sala_id=? AND dia=?', salaId, t.dia)
      .find((h) => t.min >= paraMin(h.hora) && t.min < paraMin(horaFim(h.hora, h.fim)));
    fimPrevistoEm = horarioAtivo
      ? fimPrevistoDoHorario(horarioAtivo, t.min)
      : fimPrevistoApos(DURACAO_MIN);
  }
  const id = Number(run('INSERT INTO sessoes(sala_id,aberta_em,fim_previsto_em) VALUES(?,?,?)', salaId, new Date().toISOString(), fimPrevistoEm).lastInsertRowid);
  io.emit('estado'); emitirPainel();
  return get('SELECT * FROM sessoes WHERE id=?', id);
}
function encerrarSessao(id) {
  const s = get('SELECT * FROM sessoes WHERE id=?', id);
  if (!s || s.status === 'encerrada') return;
  run("UPDATE sessoes SET status='encerrada', encerrada_em=? WHERE id=?", new Date().toISOString(), id);
  const rk = ranking(id);
  rk.forEach((r, i) => {
    run('INSERT INTO historico_ranking(sessao_id,aluno_id,posicao,aluno,pontos) VALUES(?,?,?,?,?)', id, r.id, i + 1, r.nome, r.pontos);
    const m = resumo(r.id); pendentes.delete(r.id); desafiosPendentes.delete(r.id); sorteadoresModelo.delete(r.id);
    run('INSERT INTO premiacoes(aluno_id,sessao_id,premio,nota,media) VALUES(?,?,?,?,?)', r.id, id, m.premio, m.nota, m.media);
  });
  io.to('s' + id).emit('encerrada', rk.slice(0, 10));
  online.delete(id); io.emit('estado'); emitirPainel();
}

// ---------- Agendamento automático ----------
function tick() {
  const t = agora();
  for (const h of all('SELECT * FROM horarios')) {
    const ini = paraMin(h.hora);
    const fim = paraMin(horaFim(h.hora, h.fim));
    if (h.dia === t.dia && t.min >= ini && t.min < fim) {
      const desde = new Date(Date.now() - (t.min - ini + 1) * 60000).toISOString();
      if (!get('SELECT 1 x FROM sessoes WHERE sala_id=? AND aberta_em>=?', h.sala_id, desde) && get('SELECT 1 x FROM salas WHERE id=?', h.sala_id)) {
        abrirSessao(h.sala_id, fimPrevistoDoHorario(h, t.min));
      }
    }
  }
  const limite = new Date(Date.now() - DURACAO_MIN * 60000).toISOString();
  all("SELECT id FROM sessoes WHERE status!='encerrada' AND ((fim_previsto_em IS NOT NULL AND fim_previsto_em<=?) OR (fim_previsto_em IS NULL AND aberta_em<?))", new Date().toISOString(), limite)
    .forEach((s) => encerrarSessao(s.id));
}
setInterval(tick, 15000); tick();
setInterval(() => { if (sujo) { sujo = false; emitirRanking(); } }, 5000); // ranking a cada 5 s

// ---------- API do aluno ----------
app.get('/api/estado', (req, res) => {
  const id = +req.query.alunoId;
  if (id) {
    const a = get("SELECT a.id, a.nome, se.status FROM alunos a JOIN sessoes se ON se.id=a.sessao_id WHERE a.id=? AND se.status!='encerrada'", id);
    if (a) return res.json({ aluno: { id: a.id, nome: a.nome }, status: a.status });
  }
  const s = primeira();
  const nomesSugeridos = s ? all(`SELECT DISTINCT ai.nome FROM alunos_importados ai
    JOIN importacoes_sala i ON i.id=ai.importacao_id WHERE i.sala_id=? ORDER BY ai.nome`, s.sala_id).map((x) => x.nome) : [];
  res.json(s ? { sessao: s.id, status: s.status, nomesSugeridos } : { sessao: null });
});

app.post('/api/alunos', ok((req, res) => {
  const s = primeira();
  if (!s) throw new Error('Nenhuma aula acontecendo agora.');
  const nome = String(req.body.nome || '').trim().slice(0, 30);
  if (!nome) throw new Error('Digite seu nome.');
  const id = Number(run('INSERT INTO alunos(sessao_id,sala_id,nome,idade) VALUES(?,?,?,?)', s.id, s.sala_id, nome, +req.body.idade || null).lastInsertRowid);
  emitirPainel(); res.json({ alunoId: id, nome, status: s.status });
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
  if (feitas > 0 && feitas % PERGUNTAS_POR_RODADA === 0 &&
      !get('SELECT 1 x FROM desafios WHERE aluno_id=? AND sessao_id=? AND rodada=?', id, a.sessao_id, feitas / PERGUNTAS_POR_RODADA)) {
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
    const nivel = Math.min(5, nivelBase + (turma?.conteudo_maior_dificuldade === at ? 1 : 0));
    if (!sorteadoresModelo.has(id)) sorteadoresModelo.set(id, new Map());
    const modelosDoAluno = sorteadoresModelo.get(id);
    if (!modelosDoAluno.has(at)) modelosDoAluno.set(at, criarSorteadorDeModelos());
    const pergunta = gerarPergunta(at, nivel, modelosDoAluno.get(at));
    q = { p: pergunta, nivelReal: nivel, t0: Date.now(), erros: 0, dica: 0, sessaoId: a.sessao_id, combo: comboPorAluno.get(id) || 0 };
    pendentes.set(id, q);
  }
  const { resposta, dica, ...pub } = q.p;
  res.json({ ...pub, numero: feitas + 1, total: TOTAL || null });
}));

app.post('/api/resposta', ok((req, res) => {
  const id = +req.body.alunoId, q = pendentes.get(id);
  if (!q) throw new Error('Sem pergunta em andamento.');
  if (get('SELECT status FROM sessoes WHERE id=?', q.sessaoId).status !== 'iniciada') return res.status(409).json({ erro: 'Sessão não está ativa.' });
  const seg = (Date.now() - q.t0) / 1000;
  const correta = String(req.body.resposta).trim() === q.p.resposta;
  if (!correta) q.erros++;
  const comboAtual = comboPorAluno.get(id) || 0;
  const comboNovo = correta && q.erros === 0 && q.dica === 0 ? comboAtual + 1 : 0;
  const out = { correta, erros: q.erros, terminou: correta || q.erros >= 5 };
  if (!correta) {
    out.mensagem = mensagemErro(q.erros);
    if (q.erros >= 3) { out.dica = q.p.dica; q.dica = 1; }
    if (q.erros >= 5) out.respostaCerta = q.p.resposta;
  }
  if (out.terminou) {
    const pontos = correta ? calcularPontos({ nivel: q.nivelReal, tempoSegundos: seg, tentativas: q.erros + (correta ? 1 : 0), dica: q.dica, correta: true, combo: comboNovo }) : 0;
    const nivel = ajustarNivel(q.nivelReal, correta, seg, q.erros + 1);
    run('INSERT INTO respostas(aluno_id,sessao_id,atividade,nivel,pergunta,resposta,correta,tentativas,dica,pontos,tempo) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      id, q.sessaoId, q.p.atividade, q.nivelReal, q.p.texto, String(req.body.resposta), correta ? 1 : 0, q.erros + (correta ? 1 : 0), q.dica, pontos, seg);
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
  res.json(out);
}));

app.post('/api/desafio', ok((req, res) => {
  const id = +req.body.alunoId;
  const a = get('SELECT a.sessao_id, sa.ano FROM alunos a JOIN salas sa ON sa.id=a.sala_id WHERE a.id=?', id);
  if (!a) throw new Error('Aluno não encontrado.');
  if (get('SELECT status FROM sessoes WHERE id=?', a.sessao_id)?.status !== 'iniciada') {
    return res.status(409).json({ erro: 'Sessão não está ativa.' });
  }
  const feitas = get('SELECT COUNT(*) n FROM respostas WHERE aluno_id=?', id).n;
  if (!feitas || feitas % PERGUNTAS_POR_RODADA !== 0) {
    return res.status(409).json({ erro: 'O desafio fica disponível ao final de cada rodada.' });
  }
  const rodada = feitas / PERGUNTAS_POR_RODADA;
  const concluido = get('SELECT pontos FROM desafios WHERE aluno_id=? AND sessao_id=? AND rodada=?', id, a.sessao_id, rodada);
  if (concluido) return res.json({ concluido: true, pontos: concluido.pontos });

  let pendente = desafiosPendentes.get(id);
  if (!pendente || pendente.sessaoId !== a.sessao_id || pendente.rodada !== rodada) {
    const perfil = get('SELECT COALESCE(AVG(nivel),1) nivel FROM perfis WHERE aluno_id=?', id);
    const p = criarDesafio(rodada, perfil.nivel, a.ano);
    const tempoLimite = a.ano === 2 ? 30 : 20;
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
  if (correta) emitirRanking();
  res.json({ correta, expirou, pontos });
}));

app.get('/api/resumo/:id', ok((req, res) => res.json(resumo(+req.params.id))));

// ---------- API do admin ----------
app.post('/api/admin/login', ok((req, res) => {
  const a = get('SELECT * FROM admins WHERE usuario=?', String(req.body.usuario || ''));
  if (!a || !confere(String(req.body.senha || ''), a.senha_hash)) return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  const t = crypto.randomBytes(24).toString('hex'); tokens.set(t, { usuario: a.usuario, papel: a.papel }); res.json({ token: t, papel: a.papel });
}));
app.get('/api/admin/sessao', auth, ok((req, res) => res.json({ papel: tokens.get(req.get('x-token')).papel })));

const salasCompletas = () => all('SELECT * FROM salas ORDER BY nome').map(({ periodo, dificuldade, ...s }) => ({ ...s,
  horarios: all('SELECT dia,hora,fim FROM horarios WHERE sala_id=? ORDER BY dia,hora', s.id),
  atividades: all('SELECT atividade FROM conteudos WHERE sala_id=?', s.id).map((x) => x.atividade).filter((x) => ATIVIDADES.includes(x)) }));
function salvarSala(id, b) {
  const { nome, ano, professor, conteudo_maior_dificuldade = null, horarios = [], atividades = [] } = b;
  if (!String(nome || '').trim() || ![2, 3].includes(+ano) || !String(professor || '').trim()) throw new Error('Preencha nome, ano e professor.');
  const horariosValidos = horarios.filter((h) => h.hora).map((h) => {
    const fim = h.fim || horaFim(h.hora);
    if (!Number.isInteger(+h.dia) || +h.dia < 0 || +h.dia > 6 ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(h.hora) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(fim) ||
        paraMin(fim) <= paraMin(h.hora)) {
      throw new Error('Informe um dia válido e horários de início e fim válidos, com o fim depois do início.');
    }
    return { dia: +h.dia, hora: h.hora, fim };
  });
  for (let i = 0; i < horariosValidos.length; i++) {
    for (let j = i + 1; j < horariosValidos.length; j++) {
      const a = horariosValidos[i], b = horariosValidos[j];
      if (a.dia === b.dia && sobrepoe(a.hora, a.fim, b.hora, b.fim)) {
        throw new Error('Os horários da mesma sala não podem se sobrepor.');
      }
    }
  }
  if (id) { run('UPDATE salas SET nome=?,ano=?,professor=?,conteudo_maior_dificuldade=? WHERE id=?', nome.trim(), +ano, professor.trim(), conteudo_maior_dificuldade || null, id);
    ['horarios', 'conteudos'].forEach((t) => run(`DELETE FROM ${t} WHERE sala_id=?`, id)); }
  else id = Number(run('INSERT INTO salas(nome,ano,professor,conteudo_maior_dificuldade) VALUES(?,?,?,?)', nome.trim(), +ano, professor.trim(), conteudo_maior_dificuldade || null).lastInsertRowid);
  horariosValidos.forEach((h) => run('INSERT INTO horarios(sala_id,dia,hora,fim) VALUES(?,?,?,?)', id, h.dia, h.hora, h.fim));
  const listaAtividades = (atividades.length ? atividades : (ATIVIDADES_POR_ANO[+ano] || ATIVIDADES)).filter((a) => ATIVIDADES.includes(a));
  listaAtividades.forEach((a) => run('INSERT INTO conteudos(sala_id,atividade) VALUES(?,?)', id, a));
  return id;
}
app.get('/api/admin/salas', auth, ok((q, res) => res.json(salasCompletas())));
app.post('/api/admin/salas', auth, ok((req, res) => res.json({ id: salvarSala(null, req.body) })));
app.put('/api/admin/salas/:id', auth, ok((req, res) => res.json({ id: salvarSala(+req.params.id, req.body) })));
function excluirSala(id) {
  all("SELECT id FROM sessoes WHERE sala_id=? AND status!='encerrada'", id).forEach((s) => encerrarSessao(s.id));
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
  res.json(abrirSessao(+req.body.sala_id));
}));
app.post('/api/admin/sessoes/:id/iniciar', auth, ok((req, res) => {
  const id = +req.params.id;
  if (run("UPDATE sessoes SET status='iniciada', iniciada_em=? WHERE id=? AND status='aguardando'", new Date().toISOString(), id).changes) {
    io.to('s' + id).emit('iniciada'); emitirPainel();
  }
  res.json({ ok: true });
}));
app.post('/api/admin/sessoes/:id/encerrar', auth, ok((req, res) => { encerrarSessao(+req.params.id); res.json({ ok: true }); }));

app.get('/api/admin/alunos', auth, ok((q, res) => res.json(all('SELECT a.id, a.nome, sa.nome AS sala FROM alunos a JOIN salas sa ON sa.id=a.sala_id ORDER BY a.id DESC LIMIT 300'))));
app.get('/api/admin/dados-alunos', authPrimario, ok((q, res) => res.json(all(`SELECT tipo,id,nome,sala,perguntas,pontos FROM (
  SELECT 'aluno' AS tipo,a.id,a.nome,sa.nome AS sala,COUNT(r.id) AS perguntas,
    COALESCE(SUM(r.pontos),0) + COALESCE((SELECT SUM(d.pontos) FROM desafios d WHERE d.aluno_id=a.id),0) AS pontos
  FROM alunos a JOIN salas sa ON sa.id=a.sala_id LEFT JOIN respostas r ON r.aluno_id=a.id
  GROUP BY a.id
  UNION ALL
  SELECT 'importado',ai.id,ai.nome,sa.nome,ai.total_respostas,ai.pontos_total
  FROM alunos_importados ai JOIN importacoes_sala i ON i.id=ai.importacao_id
  JOIN salas sa ON sa.id=i.sala_id
) ORDER BY sala,nome`))));
app.delete('/api/admin/dados-alunos', authPrimario, ok((req, res) => {
  const tipo = String(req.body.tipo || '');
  const id = Number(req.body.id);
  if (!['aluno', 'importado'].includes(tipo) || !Number.isSafeInteger(id) || id < 1) {
    throw new Error('Selecione um registro válido.');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    if (tipo === 'importado') {
      const importado = get(`SELECT ai.id,ai.linha_origem,i.sala_id,i.arquivo
        FROM alunos_importados ai JOIN importacoes_sala i ON i.id=ai.importacao_id WHERE ai.id=?`, id);
      if (!importado) throw new Error('Registro não encontrado; atualize a lista e tente novamente.');
      run(`INSERT OR IGNORE INTO exclusoes_alunos_importados(sala_id,arquivo,linha_origem)
        VALUES(?,?,?)`, importado.sala_id, importado.arquivo, importado.linha_origem);
      if (run('DELETE FROM alunos_importados WHERE id=?', id).changes !== 1) {
        throw new Error('Registro não encontrado; atualize a lista e tente novamente.');
      }
    } else {
      const aluno = get(`SELECT a.id,a.nome,a.sessao_id,se.status FROM alunos a
        JOIN sessoes se ON se.id=a.sessao_id WHERE a.id=?`, id);
      if (!aluno) throw new Error('Registro não encontrado; atualize a lista e tente novamente.');
      if (aluno.status !== 'encerrada') throw new Error('Encerre a sessão antes de excluir os dados desta criança.');
      run('DELETE FROM respostas WHERE aluno_id=?', id);
      run('DELETE FROM desafios WHERE aluno_id=?', id);
      run('DELETE FROM premiacoes WHERE aluno_id=?', id);
      run('DELETE FROM perfis WHERE aluno_id=?', id);
      run('DELETE FROM historico_ranking WHERE aluno_id=?', id);
      run(`UPDATE historico_ranking SET aluno='Aluno removido'
        WHERE aluno_id IS NULL AND sessao_id=? AND aluno=? AND (
          SELECT COUNT(*) FROM alunos WHERE sessao_id=? AND nome=?
        )>1`, aluno.sessao_id, aluno.nome, aluno.sessao_id, aluno.nome);
      if (run('DELETE FROM alunos WHERE id=?', id).changes !== 1) throw new Error('O registro mudou durante a exclusão.');
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  if (tipo === 'aluno') {
    pendentes.delete(id); desafiosPendentes.delete(id); comboPorAluno.delete(id);
    sorteadoresAtividade.delete(id); sorteadoresModelo.delete(id);
  }
  emitirRanking();
  res.json({ ok: true });
}));
app.get('/api/admin/ranking', auth, ok((req, res) => {
  const s = get('SELECT id FROM sessoes WHERE sala_id=? ORDER BY id DESC', +req.query.sala_id);
  res.json(req.query.sala_id ? (s ? ranking(s.id) : []) : rankingGeral());
}));

const csv = (rows) => { if (!rows.length) return ''; const k = Object.keys(rows[0]), q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '\ufeff' + [k.join(','), ...rows.map((r) => k.map((c) => q(r[c])).join(','))].join('\n'); };
app.get('/api/admin/relatorio/:tipo', auth, ok((req, res) => {
  const id = +req.query.id; let rows, detalhesSala;
  if (req.params.tipo === 'aluno') rows = all(`SELECT atividade, COUNT(*) AS perguntas, SUM(correta) AS acertos,
      ROUND(100.0 * SUM(correta) / COUNT(*), 1) AS percentual_acerto,
      SUM(pontos) AS pontos_total, ROUND(AVG(tempo),1) AS tempo_medio_s
    FROM respostas WHERE aluno_id=? GROUP BY atividade ORDER BY atividade`, id);
  else if (req.params.tipo === 'sala') rows = all(`SELECT aluno, perguntas, acertos, percentual_acerto, pontos_total, tempo_medio_s
    FROM (
      SELECT a.nome AS aluno, COUNT(r.id) AS perguntas, COALESCE(SUM(r.correta),0) AS acertos,
        CASE WHEN COUNT(r.id)=0 THEN NULL ELSE ROUND(100.0 * SUM(r.correta) / COUNT(r.id), 1) END AS percentual_acerto,
        COALESCE(SUM(r.pontos),0) + COALESCE((SELECT SUM(d.pontos) FROM desafios d WHERE d.aluno_id=a.id),0) AS pontos_total,
        ROUND(AVG(r.tempo),1) AS tempo_medio_s
      FROM alunos a LEFT JOIN respostas r ON r.aluno_id=a.id WHERE a.sala_id=? GROUP BY a.id
      UNION ALL
      SELECT ai.nome, ai.total_respostas, NULL, NULL, ai.pontos_total, ai.tempo_medio_s
      FROM alunos_importados ai JOIN importacoes_sala i ON i.id=ai.importacao_id WHERE i.sala_id=?
    ) ORDER BY pontos_total DESC, aluno`, id, id);
  else rows = all(`SELECT aluno, sala, perguntas, acertos, percentual_acerto, pontos
    FROM (
      SELECT a.nome AS aluno, sa.nome AS sala, COUNT(r.id) AS perguntas,
        COALESCE(SUM(r.correta),0) AS acertos,
        CASE WHEN COUNT(r.id)=0 THEN NULL ELSE ROUND(100.0 * SUM(r.correta) / COUNT(r.id), 1) END AS percentual_acerto,
        COALESCE(SUM(r.pontos),0) + COALESCE((SELECT SUM(d.pontos) FROM desafios d WHERE d.aluno_id=a.id),0) AS pontos
      FROM alunos a JOIN salas sa ON sa.id=a.sala_id LEFT JOIN respostas r ON r.aluno_id=a.id
      GROUP BY a.id
      UNION ALL
      SELECT ai.nome, s.nome, ai.total_respostas, NULL, NULL, ai.pontos_total
      FROM alunos_importados ai JOIN importacoes_sala i ON i.id=ai.importacao_id
      JOIN salas s ON s.id=i.sala_id
    ) ORDER BY pontos DESC, aluno LIMIT 50`);
  if (req.params.tipo === 'sala' && req.query.detalhado === '1') {
    detalhesSala = {
      alunos: all(`SELECT a.id,a.nome,COUNT(r.id) AS perguntas FROM alunos a
        LEFT JOIN respostas r ON r.aluno_id=a.id WHERE a.sala_id=? GROUP BY a.id ORDER BY a.nome`, id),
      dificuldadesPorAluno: all(`SELECT a.id AS aluno_id,a.nome AS aluno,r.atividade,COUNT(*) AS perguntas,
          ROUND(100.0 * SUM(r.correta) / COUNT(*),1) AS percentual_acerto
        FROM alunos a JOIN respostas r ON r.aluno_id=a.id WHERE a.sala_id=?
        GROUP BY a.id,r.atividade ORDER BY a.nome,percentual_acerto,r.atividade`, id),
      dificuldadesDaSala: all(`SELECT r.atividade,COUNT(*) AS perguntas,
          SUM(r.correta) AS acertos,ROUND(100.0 * SUM(r.correta) / COUNT(*),1) AS percentual_acerto
        FROM respostas r JOIN alunos a ON a.id=r.aluno_id
        WHERE a.sala_id=? GROUP BY r.atividade ORDER BY percentual_acerto,perguntas DESC,r.atividade`, id)
    };
    return res.json({ ...detalhesSala, relatorioAlunos: rows });
  }
  if (req.query.csv) { res.type('text/csv').send(csv(rows)); } else res.json(rows);
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
