const { getDb } = require("../database");

async function getNick(jogadorId) {
  const db = getDb();
  return db.get("SELECT nome FROM nicks WHERE id = ?", [jogadorId]);
}

async function setNick(jogadorId, nome) {
  const db = getDb();
  await db.run("INSERT OR REPLACE INTO nicks (id, nome) VALUES (?, ?)", [
    jogadorId,
    nome,
  ]);
}

async function adicionarJogador(partidaId, jogadorId, papel = "TITULAR") {
  const db = getDb();
  await db.run(
    "INSERT INTO jogadores_partida (partida_id, jogador_id, papel) VALUES (?, ?, ?)",
    [partidaId, jogadorId, papel],
  );
}

async function removerJogador(registroId) {
  const db = getDb();
  await db.run("DELETE FROM jogadores_partida WHERE id = ?", [registroId]);
}

async function getRegistroJogador(partidaId, jogadorId) {
  const db = getDb();
  return db.get(
    "SELECT id, papel FROM jogadores_partida WHERE partida_id = ? AND jogador_id = ?",
    [partidaId, jogadorId],
  );
}

async function getTitulares(partidaId) {
  const db = getDb();
  return db.all(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR' ORDER BY id ASC",
    [partidaId],
  );
}

async function getSuplentes(partidaId) {
  const db = getDb();
  return db.all(
    "SELECT id, jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'SUPLENTE' ORDER BY id ASC",
    [partidaId],
  );
}

async function promoverPrimeiroSuplente(partidaId) {
  const db = getDb();
  const suplente = await db.get(
    "SELECT id, jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'SUPLENTE' ORDER BY id ASC LIMIT 1",
    [partidaId],
  );
  if (!suplente) return null;

  await db.run("UPDATE jogadores_partida SET papel = 'TITULAR' WHERE id = ?", [
    suplente.id,
  ]);
  return suplente.jogador_id;
}

async function passarCoroa(partidaId, novoAdminId) {
  const db = getDb();
  await db.run("UPDATE partidas SET criador_id = ? WHERE id = ?", [
    novoAdminId,
    partidaId,
  ]);
}

async function getProximoTitular(partidaId) {
  const db = getDb();
  return db.get(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR' ORDER BY id ASC LIMIT 1",
    [partidaId],
  );
}

async function temAlguemNaPartida(partidaId) {
  const db = getDb();
  const row = await db.get(
    "SELECT id FROM jogadores_partida WHERE partida_id = ?",
    [partidaId],
  );
  return !!row;
}

async function silenciarJogador(jogadorId) {
  const db = getDb();
  await db.run("INSERT OR IGNORE INTO jogadores_silenciados (id) VALUES (?)", [
    jogadorId,
  ]);
}

async function notificarJogador(jogadorId) {
  const db = getDb();
  await db.run("DELETE FROM jogadores_silenciados WHERE id = ?", [jogadorId]);
}

async function getSilenciados() {
  const db = getDb();
  const rows = await db.all("SELECT id FROM jogadores_silenciados");
  return rows.map((r) => r.id);
}

module.exports = {
  getNick,
  setNick,
  adicionarJogador,
  removerJogador,
  getRegistroJogador,
  getTitulares,
  getSuplentes,
  promoverPrimeiroSuplente,
  passarCoroa,
  getProximoTitular,
  temAlguemNaPartida,
  silenciarJogador,
  notificarJogador,
  getSilenciados,
};
