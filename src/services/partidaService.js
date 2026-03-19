const { getDb } = require("../database");

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
  tipo,
  maxPlayers,
  numeroLobby,
}) {
  const db = getDb();

  return db.run(
    `INSERT INTO partidas (group_id, criador_id, titulo, horario, tipo, max_players, numero_lobby)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [groupId, senderId, titulo, horario, tipo, maxPlayers, numeroLobby],
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

async function limparPartidasEsquecidas() {
  const db = getDb();
  await db.run(
    "UPDATE partidas SET status = 'CANCELADA' WHERE status = 'ABERTA'",
  );
}

async function verificarConflitoDeHorario(groupId, senderId, novoHorarioStr) {
  const db = getDb();
  
  const partidasAtivas = await db.all(
    `SELECT p.horario, p.numero_lobby, p.titulo 
     FROM partidas p
     JOIN jogadores_partida jp ON p.id = jp.partida_id
     WHERE p.group_id = ? AND jp.jogador_id = ? AND jp.papel = 'TITULAR' AND p.status = 'ABERTA'`,
    [groupId, senderId]
  );

  if (partidasAtivas.length === 0) return null;

  if (!novoHorarioStr) return partidasAtivas[0];

  const horaParaMin = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const minNovo = horaParaMin(novoHorarioStr);

  for (const p of partidasAtivas) {
    if (!p.horario) return p;

    const minExistente = horaParaMin(p.horario);
    let diferenca = Math.abs(minNovo - minExistente);
    
    if (diferenca > 720) diferenca = 1440 - diferenca;

    if (diferenca < 90) { 
      return p;
    }
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