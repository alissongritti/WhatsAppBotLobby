const { getDb } = require("../database");

async function registrarPartidaJogada(jogadorIds) {
  const db = getDb();

  // Usa transação para garantir que todos os updates sejam atômicos
  await db.run("BEGIN TRANSACTION");
  try {
    for (const id of jogadorIds) {
      await db.run(
        `INSERT INTO estatisticas (id, partidas_jogadas, arregadas)
         VALUES (?, 1, 0)
         ON CONFLICT(id) DO UPDATE SET partidas_jogadas = partidas_jogadas + 1`,
        [id]
      );
    }
    await db.run("COMMIT");
  } catch (err) {
    await db.run("ROLLBACK");
    throw err;
  }
}

async function getEstatisticas(jogadorId) {
  const db = getDb();
  return db.get("SELECT * FROM estatisticas WHERE id = ?", [jogadorId]);
}

module.exports = { registrarPartidaJogada, getEstatisticas };
