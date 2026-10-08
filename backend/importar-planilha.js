const fs = require('node:fs');
const path = require('node:path');

function parseCSV(texto) {
  const linhas = [];
  let linha = [], campo = '', entreAspas = false;
  const conteudo = texto.replace(/^\uFEFF/, '');
  for (let i = 0; i < conteudo.length; i++) {
    const caractere = conteudo[i];
    if (entreAspas) {
      if (caractere === '"' && conteudo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (caractere === '"') entreAspas = false;
      else campo += caractere;
    } else if (caractere === '"') entreAspas = true;
    else if (caractere === ',') {
      linha.push(campo);
      campo = '';
    } else if (caractere === '\n' || caractere === '\r') {
      if (caractere === '\r' && conteudo[i + 1] === '\n') i++;
      linha.push(campo);
      if (linha.some((valor) => valor.trim())) linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += caractere;
  }
  if (entreAspas) throw new Error('A planilha contém um campo entre aspas sem fechamento.');
  linha.push(campo);
  if (linha.some((valor) => valor.trim())) linhas.push(linha);
  return linhas;
}

const normalizar = (valor) => String(valor ?? '').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const ALIASES_COLUNAS = new Map([
  ['aluno', 'aluno'], ['alunos', 'aluno'], ['nome', 'aluno'], ['crianca', 'aluno'],
  ['sala', 'sala'], ['perguntas', 'perguntas'], ['total_respostas', 'total_respostas'],
  ['total de respostas', 'total_respostas'], ['acertos', 'acertos'],
  ['percentual_acerto', 'percentual_acerto'], ['percentual de acerto', 'percentual_acerto'],
  ['aproveitamento', 'percentual_acerto'], ['aproveitamento (%)', 'percentual_acerto'],
  ['pontos_total', 'pontos_total'], ['pontos', 'pontos_total'],
  ['tempo_medio_s', 'tempo_medio_s'], ['tempo medio (s)', 'tempo_medio_s'],
  ['tempo medio', 'tempo_medio_s'], ['atividade', 'atividade'], ['aluno_id', 'aluno_id'],
  ['indicador', 'indicador']
]);
const canonicalizarColuna = (valor) => {
  const coluna = normalizar(valor);
  return ALIASES_COLUNAS.get(coluna) || coluna;
};
const numero = (valor, campo, linha, opcional = false) => {
  const texto = String(valor ?? '').trim().replace('%', '').replace(',', '.');
  if (!texto && opcional) return null;
  const resultado = Number(texto);
  if (!Number.isFinite(resultado)) throw new Error(`Valor inválido para ${campo} na linha ${linha}.`);
  return resultado;
};

function importarPlanilha(db, texto, salaId, nomeArquivo = 'planilha.csv') {
  const sala = db.prepare('SELECT id,nome FROM salas WHERE id=?').get(salaId);
  if (!sala) throw new Error(`Sala ${salaId} não encontrada no banco.`);

  const linhas = parseCSV(texto);
  const nomeNormalizado = normalizar(sala.nome);
  let nestaSala = false, encontrouSala = false, temTitulosSala = false;
  let modo = null, colunas = null, possuiDetalhes = false;
  const alunos = [], atividades = [];
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const primeiro = (linha[0] || '').trim();
    const cabecalho = linha.map(canonicalizarColuna);
    const indice = (nome) => cabecalho.indexOf(nome);
    if (normalizar(primeiro).startsWith('sala:')) {
      temTitulosSala = true;
      const titulo = normalizar(primeiro.slice(primeiro.indexOf(':') + 1));
      nestaSala = titulo === nomeNormalizado || titulo.startsWith(`${nomeNormalizado} `)
        || titulo.startsWith(`${nomeNormalizado} -`) || titulo.startsWith(`${nomeNormalizado} —`);
      encontrouSala ||= nestaSala;
      modo = null;
      colunas = null;
      continue;
    }
    if (indice('aluno') === 0 && (
      indice('pontos_total') >= 0 && (indice('perguntas') >= 0 || indice('total_respostas') >= 0)
    )) {
      if (!encontrouSala && !temTitulosSala) {
        nestaSala = true;
        encontrouSala = true;
      }
      if (!nestaSala) continue;
      modo = 'alunos';
      colunas = cabecalho;
      continue;
    }
    if (!nestaSala) continue;

    if (indice('aluno_id') === 0 && ['aluno', 'atividade', 'perguntas', 'percentual_acerto']
      .every((coluna) => indice(coluna) >= 0)) {
      modo = 'atividades';
      colunas = cabecalho;
      possuiDetalhes = true;
      continue;
    }
    if (indice('indicador') === 0 || indice('atividade') === 0) {
      modo = null;
      colunas = null;
      continue;
    }
    if (modo === 'alunos') {
      const coluna = (nome) => colunas.indexOf(nome);
      const nome = (linha[coluna('aluno')] || '').trim();
      if (!nome) continue;
      const colunaSala = coluna('sala');
      if (colunaSala >= 0 && normalizar(linha[colunaSala]) !== nomeNormalizado) continue;
      const colunaPerguntas = coluna('perguntas') >= 0 ? coluna('perguntas') : coluna('total_respostas');
      const perguntas = numero(linha[colunaPerguntas], 'perguntas', i + 1);
      const acertos = coluna('acertos') < 0 ? null : numero(linha[coluna('acertos')], 'acertos', i + 1, true);
      const percentual = numero(linha[coluna('percentual_acerto')], 'percentual_acerto', i + 1, true);
      const pontos = numero(linha[coluna('pontos_total')], 'pontos_total', i + 1);
      const tempo = coluna('tempo_medio_s') < 0 ? null
        : numero(linha[coluna('tempo_medio_s')], 'tempo_medio_s', i + 1, true);
      if (!Number.isSafeInteger(perguntas) || !Number.isSafeInteger(pontos) || perguntas < 0
          || (acertos !== null && (!Number.isSafeInteger(acertos) || acertos > perguntas || acertos < 0))) {
        throw new Error(`Métricas inválidas na linha ${i + 1}.`);
      }
      alunos.push({ nome, perguntas, acertos, percentual, pontos, tempo });
    } else if (modo === 'atividades') {
      const coluna = (nome) => colunas.indexOf(nome);
      const nome = (linha[coluna('aluno')] || '').trim();
      const atividade = (linha[coluna('atividade')] || '').trim();
      if (!nome || !atividade) continue;
      const perguntas = numero(linha[coluna('perguntas')], 'perguntas da atividade', i + 1);
      const percentual = numero(linha[coluna('percentual_acerto')], 'percentual da atividade', i + 1, true);
      if (!Number.isSafeInteger(perguntas) || perguntas < 0) {
        throw new Error(`Quantidade inválida de perguntas na linha ${i + 1}.`);
      }
      atividades.push({ nome, atividade, perguntas, percentual });
    }
  }
  if (!encontrouSala) throw new Error(`O CSV não contém uma seção para a sala "${sala.nome}".`);
  if (!alunos.length) throw new Error('Não foram encontradas linhas de alunos com as colunas esperadas.');

  const importacaoAnterior = db.prepare(`SELECT id,arquivo FROM importacoes_sala
    WHERE sala_id=? ORDER BY id DESC LIMIT 1`).get(salaId);
  const arquivo = importacaoAnterior?.arquivo || path.basename(nomeArquivo);
  const importacaoId = importacaoAnterior?.id
    || Number(db.prepare('INSERT INTO importacoes_sala(sala_id,arquivo) VALUES(?,?)')
      .run(salaId, arquivo).lastInsertRowid);
  const exclusoes = db.prepare(`SELECT linha_origem,nome FROM exclusoes_alunos_importados
    WHERE sala_id=? AND arquivo=?`).all(salaId, arquivo);
  const linhasExcluidas = new Set(exclusoes.filter((registro) => !registro.nome)
    .map((registro) => registro.linha_origem));
  const nomesExcluidos = new Set(exclusoes.filter((registro) => registro.nome)
    .map((registro) => normalizar(registro.nome)));
  const anteriores = db.prepare('SELECT linha_origem,nome FROM alunos_importados WHERE importacao_id=? ORDER BY linha_origem')
    .all(importacaoId);
  const atuaisPorNome = new Map(), anterioresPorNome = new Map();
  for (const aluno of alunos) {
    const nome = normalizar(aluno.nome);
    if (!atuaisPorNome.has(nome)) atuaisPorNome.set(nome, []);
    atuaisPorNome.get(nome).push(aluno);
  }
  for (const aluno of anteriores) {
    const nome = normalizar(aluno.nome);
    if (!anterioresPorNome.has(nome)) anterioresPorNome.set(nome, []);
    anterioresPorNome.get(nome).push(aluno);
  }
  const linhasEmUso = new Set(exclusoes.map((registro) => registro.linha_origem));
  for (const [nome, atuais] of atuaisPorNome) {
    const anterioresDoNome = anterioresPorNome.get(nome) || [];
    if (nomesExcluidos.has(nome) || atuais.length !== anterioresDoNome.length) continue;
    atuais.forEach((aluno, indice) => {
      aluno.linhaOrigem = anterioresDoNome[indice].linha_origem;
      linhasEmUso.add(aluno.linhaOrigem);
    });
  }
  let proximaLinha = 2;
  for (const aluno of alunos) {
    if (nomesExcluidos.has(normalizar(aluno.nome)) || aluno.linhaOrigem !== undefined) continue;
    while (linhasEmUso.has(proximaLinha)) proximaLinha++;
    aluno.linhaOrigem = proximaLinha;
    linhasEmUso.add(proximaLinha++);
  }
  const ativos = alunos.filter((aluno) => !nomesExcluidos.has(normalizar(aluno.nome))
    && !linhasExcluidas.has(aluno.linhaOrigem));
  const linhasAtivas = ativos.map((aluno) => aluno.linhaOrigem);

  if (linhasAtivas.length) {
    const marcadores = linhasAtivas.map(() => '?').join(',');
    db.prepare(`DELETE FROM alunos_importados_atividades
      WHERE aluno_importado_id IN (SELECT id FROM alunos_importados
        WHERE importacao_id=? AND linha_origem NOT IN (${marcadores}))`)
      .run(importacaoId, ...linhasAtivas);
    db.prepare(`DELETE FROM alunos_importados WHERE importacao_id=? AND linha_origem NOT IN (${marcadores})`)
      .run(importacaoId, ...linhasAtivas);
  } else {
    db.prepare(`DELETE FROM alunos_importados_atividades WHERE aluno_importado_id IN
      (SELECT id FROM alunos_importados WHERE importacao_id=?)`).run(importacaoId);
    db.prepare('DELETE FROM alunos_importados WHERE importacao_id=?').run(importacaoId);
  }

  const gravarAluno = db.prepare(`INSERT INTO alunos_importados
    (importacao_id,linha_origem,nome,total_respostas,pontos_total,tempo_medio_s,acertos,percentual_acerto,estimado)
    VALUES(?,?,?,?,?,?,?,?,0) ON CONFLICT(importacao_id,linha_origem) DO UPDATE SET nome=excluded.nome,
    total_respostas=excluded.total_respostas,pontos_total=excluded.pontos_total,
    tempo_medio_s=excluded.tempo_medio_s,acertos=excluded.acertos,
    percentual_acerto=excluded.percentual_acerto,estimado=0`);
  const ids = new Map(), ocorrencias = new Map();
  alunos.forEach((aluno) => ocorrencias.set(normalizar(aluno.nome), (ocorrencias.get(normalizar(aluno.nome)) || 0) + 1));
  for (const aluno of ativos) {
    gravarAluno.run(importacaoId, aluno.linhaOrigem, aluno.nome, aluno.perguntas, aluno.pontos,
      aluno.tempo, aluno.acertos, aluno.percentual);
    const id = db.prepare('SELECT id FROM alunos_importados WHERE importacao_id=? AND linha_origem=?')
      .get(importacaoId, aluno.linhaOrigem).id;
    ids.set(normalizar(aluno.nome), { id, ambiguo: ocorrencias.get(normalizar(aluno.nome)) > 1 });
  }

  let atividadesImportadas = 0, linhasDetalheAmbiguas = 0;
  const gruposAmbiguosContabilizados = new Set();
  const porAluno = new Map();
  for (const atividade of atividades) {
    const chave = normalizar(atividade.nome);
    if (!porAluno.has(chave)) porAluno.set(chave, []);
    porAluno.get(chave).push(atividade);
  }
  if (possuiDetalhes) {
    const apagarAtividades = db.prepare('DELETE FROM alunos_importados_atividades WHERE aluno_importado_id=?');
    const gravarAtividade = db.prepare(`INSERT INTO alunos_importados_atividades
      (aluno_importado_id,atividade,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s)
      VALUES(?,?,?,NULL,?,NULL,NULL) ON CONFLICT(aluno_importado_id,atividade) DO UPDATE SET
      perguntas=excluded.perguntas,acertos=NULL,percentual_acerto=excluded.percentual_acerto,
      pontos_total=NULL,tempo_medio_s=NULL`);
    for (const aluno of ativos) {
      const chave = normalizar(aluno.nome), registro = ids.get(chave);
      if (registro.ambiguo) {
        if (!gruposAmbiguosContabilizados.has(chave)) {
          linhasDetalheAmbiguas += (porAluno.get(chave) || []).length;
          gruposAmbiguosContabilizados.add(chave);
        }
        continue;
      }
      const detalhe = porAluno.get(chave) || [];
      if (new Set(detalhe.map((item) => item.atividade)).size !== detalhe.length) {
        throw new Error('A planilha contém atividades duplicadas para o mesmo aluno.');
      }
      apagarAtividades.run(registro.id);
      for (const item of detalhe) {
        gravarAtividade.run(registro.id, item.atividade, item.perguntas, item.percentual);
        atividadesImportadas++;
      }
    }
  }

  return { sala: sala.nome, arquivo, alunosImportados: ativos.length, alunosIgnoradosPorExclusao: alunos.length - ativos.length,
    atividadesImportadas, linhasDetalheAmbiguas };
}

function argumentosCLI(args) {
  let salaId, arquivo;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sala') salaId = Number(args[++i]);
    else if (args[i] === '--arquivo') arquivo = args[++i];
    else throw new Error('Uso: node backend/importar-planilha.js --sala ID --arquivo CAMINHO_CSV');
  }
  if (!Number.isSafeInteger(salaId) || salaId < 1 || !arquivo) {
    throw new Error('Uso: node backend/importar-planilha.js --sala ID --arquivo CAMINHO_CSV');
  }
  return { salaId, arquivo };
}

if (require.main === module) {
  let db;
  try {
    const { salaId, arquivo } = argumentosCLI(process.argv.slice(2));
    if (path.extname(arquivo).toLocaleLowerCase() !== '.csv') {
      throw new Error('Salve a planilha do Excel como CSV UTF-8 antes de importá-la.');
    }
    const texto = fs.readFileSync(path.resolve(arquivo), 'utf8');
    db = require('./database');
    db.exec('BEGIN IMMEDIATE');
    try {
      const resultado = importarPlanilha(db, texto, salaId, arquivo);
      db.exec('COMMIT');
      console.log(JSON.stringify(resultado));
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

module.exports = { parseCSV, importarPlanilha };
