const { getDb } = require("../database");
const { dataDeHoje } = require("../utils/timeParser");

async function getPartidasAbertas(groupId) {
  const db = getDb();
  return db.all(
    "SELECT * FROM partidas WHERE group_id = ? AND status = 'ABERTA' ORDER BY numero_lobby ASC",
    [groupId],
  );
}

async function getPartidaPorLobby(groupId, numeroLobby) {
  const db = getDb();
  return db.get(
    "SELECT * FROM partidas WHERE numero_lobby = ? AND group_id = ? AND status = 'ABERTA'",
    [numeroLobby, groupId],
  );
}

async function getPartidaDoAdmin(groupId, senderId) {
  const db = getDb();
  return db.get(
    "SELECT * FROM partidas WHERE group_id = ? AND criador_id = ? AND status = 'ABERTA'",
    [groupId, senderId],
  );
}

async function getPartidaDoTitular(groupId, senderId) {
  const db = getDb();
  return db.get(
    `SELECT p.* FROM partidas p
     JOIN jogadores_partida jp ON p.id = jp.partida_id
     WHERE p.group_id = ? AND jp.jogador_id = ? AND jp.papel = 'TITULAR' AND p.status = 'ABERTA'`,
    [groupId, senderId],
  );
}

async function getPartidaDoJogador(groupId, senderId) {
  const db = getDb();
  return db.get(
    `SELECT p.* FROM partidas p
     JOIN jogadores_partida jp ON p.id = jp.partida_id
     WHERE p.group_id = ? AND jp.jogador_id = ? AND p.status = 'ABERTA'`,
    [groupId, senderId],
  );
}

async function getPartidasDoJogador(groupId, senderId) {
  const db = getDb();
  return db.all(
    `SELECT p.* FROM partidas p
     JOIN jogadores_partida jp ON p.id = jp.partida_id
     WHERE p.group_id = ? AND jp.jogador_id = ? AND p.status = 'ABERTA'`,
    [groupId, senderId],
  );
}

async function contarTitulares(partidaId) {
  const db = getDb();
  const row = await db.get(
    "SELECT COUNT(id) as count FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR'",
    [partidaId],
  );
  return row.count;
}

async function gerarNumeroLobbyDisponivel(groupId) {
  const db = getDb();
  const lobbiesAtivas = await db.all(
    "SELECT numero_lobby FROM partidas WHERE group_id = ? AND status = 'ABERTA' ORDER BY numero_lobby ASC",
    [groupId],
  );
  let numero = 1;
  for (const lobby of lobbiesAtivas) {
    if (lobby.numero_lobby === numero) numero++;
    else break;
  }
  return numero;
}

async function criarPartida({
  groupId,
  senderId,
  titulo,
  horario,
  dataPartida,
  tipo,
  maxPlayers,
  numeroLobby,
}) {
  const db = getDb();
  return db.run(
    `INSERT INTO partidas (group_id, criador_id, titulo, horario, data_partida, tipo, max_players, numero_lobby)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      groupId,
      senderId,
      titulo,
      horario,
      dataPartida,
      tipo,
      maxPlayers,
      numeroLobby,
    ],
  );
}

async function cancelarPartida(partidaId) {
  const db = getDb();
  await db.run(
    "UPDATE partidas SET status = 'CANCELADA', cancelada_em = datetime('now', 'localtime') WHERE id = ?",
    [partidaId],
  );
}

async function atualizarHorario(partidaId, horario) {
  const db = getDb();
  await db.run("UPDATE partidas SET horario = ? WHERE id = ?", [
    horario,
    partidaId,
  ]);
}

async function atualizarTitulo(partidaId, titulo) {
  const db = getDb();
  await db.run("UPDATE partidas SET titulo = ? WHERE id = ?", [
    titulo,
    partidaId,
  ]);
}

async function concluirPartida(partidaId) {
  const db = getDb();
  await db.run("UPDATE partidas SET status = 'CONCLUIDA' WHERE id = ?", [
    partidaId,
  ]);
}

async function getSuplentesDeOutrasPartidas(groupId, partidaIdAtual) {
  const db = getDb();
  return db.all(
    `SELECT jp.jogador_id
     FROM jogadores_partida jp
     JOIN partidas p ON jp.partida_id = p.id
     WHERE p.group_id = ? AND jp.papel = 'SUPLENTE' AND p.status = 'ABERTA' AND p.id != ?`,
    [groupId, partidaIdAtual],
  );
}

async function getTodasPartidasComHorario() {
  const db = getDb();
  return db.all(
    "SELECT * FROM partidas WHERE status = 'ABERTA' AND horario IS NOT NULL AND horario != '' AND alarme_disparado = 0",
  );
}

async function marcarAlarmeDisparado(partidaId) {
  const db = getDb();
  await db.run("UPDATE partidas SET alarme_disparado = 1 WHERE id = ?", [
    partidaId,
  ]);
}

async function getTitularesComId(partidaId) {
  const db = getDb();
  return db.all(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR'",
    [partidaId],
  );
}

/**
 * Converte "DD/MM" para um objeto Date no ano corrente.
 * NÃO faz virada de ano — se passou, passou.
 */
function ddmmParaDate(ddmm) {
  const [dia, mes] = ddmm.split("/").map(Number);
  const ano = new Date().getFullYear();
  return new Date(ano, mes - 1, dia);
}

/**
 * Vassoura: cancela lobbies abertas cujo dia/horário já passou.
 *
 * Regras:
 * - data_partida < hoje (dia anterior) → cancela sempre
 * - data_partida = hoje + horario já passou → cancela
 * - data_partida > hoje → preserva (agendada futura)
 */
async function limparPartidasEsquecidas() {
  const db = getDb();
  const hoje = dataDeHoje(); // "DD/MM"
  const agora = new Date();
  const horaAtual =
    agora.getHours().toString().padStart(2, "0") +
    ":" +
    agora.getMinutes().toString().padStart(2, "0");

  const hojeDate = ddmmParaDate(hoje);

  const partidasAtivas = await db.all(
    "SELECT id, data_partida, horario FROM partidas WHERE status = 'ABERTA'",
  );

  const idsParaCancelar = [];

  for (const p of partidasAtivas) {
    const dataPartidaDate = ddmmParaDate(p.data_partida);

    if (dataPartidaDate < hojeDate) {
      // Dia anterior — cancela independente do horário
      idsParaCancelar.push(p.id);
    } else if (dataPartidaDate.getTime() === hojeDate.getTime()) {
      // Mesmo dia — só cancela se o horário já passou ou não tem horário
      if (!p.horario || p.horario < horaAtual) {
        idsParaCancelar.push(p.id);
      }
    }
    // dataPartidaDate > hojeDate → futuro, preserva
  }

  if (idsParaCancelar.length > 0) {
    const placeholders = idsParaCancelar.map(() => "?").join(",");
    await db.run(
      `UPDATE partidas SET status = 'CANCELADA', cancelada_em = datetime('now', 'localtime')
       WHERE id IN (${placeholders})`,
      idsParaCancelar,
    );
    console.log(
      `[VASSOURA] 🧹 ${idsParaCancelar.length} lobbies antigas canceladas.`,
    );
  }
}

/**
 * Verifica conflito de horário entre partidas do mesmo jogador no mesmo dia.
 */
async function verificarConflitoDeHorario(
  groupId,
  senderId,
  novoHorarioStr,
  novaData,
  partidaIdAExcluir = null,
) {
  const db = getDb();

  const partidasAtivas = await db.all(
    `SELECT p.id, p.horario, p.data_partida, p.numero_lobby, p.titulo
     FROM partidas p
     JOIN jogadores_partida jp ON p.id = jp.partida_id
     WHERE p.group_id = ? AND jp.jogador_id = ? AND jp.papel = 'TITULAR' AND p.status = 'ABERTA'`,
    [groupId, senderId],
  );

  if (partidasAtivas.length === 0) return null;
  if (!novoHorarioStr) return partidasAtivas[0];

  const horaParaMin = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const minNovo = horaParaMin(novoHorarioStr);

  for (const p of partidasAtivas) {
    if (partidaIdAExcluir && p.id === partidaIdAExcluir) continue;
    if (!p.horario) return p;
    if (novaData !== p.data_partida) continue;

    const minExistente = horaParaMin(p.horario);
    let diferenca = Math.abs(minNovo - minExistente);
    if (diferenca > 720) diferenca = 1440 - diferenca;

    if (diferenca < 90) return p;
  }

  return null;
}

module.exports = {
  getPartidasAbertas,
  getPartidaPorLobby,
  getPartidaDoAdmin,
  getPartidaDoTitular,
  getPartidaDoJogador,
  getPartidasDoJogador,
  contarTitulares,
  getTitularesComId,
  gerarNumeroLobbyDisponivel,
  criarPartida,
  cancelarPartida,
  atualizarHorario,
  atualizarTitulo,
  concluirPartida,
  getSuplentesDeOutrasPartidas,
  getTodasPartidasComHorario,
  marcarAlarmeDisparado,
  limparPartidasEsquecidas,
  verificarConflitoDeHorario,
};
