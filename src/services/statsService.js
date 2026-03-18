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
        [id],
      );
    }
    await db.run("COMMIT");
  } catch (err) {
    await db.run("ROLLBACK");
    throw err;
  }
}

async function registrarArregada(jogadorId) {
  const db = getDb();
  await db.run(
    `INSERT INTO estatisticas (id, partidas_jogadas, arregadas)
     VALUES (?, 0, 1)
     ON CONFLICT(id) DO UPDATE SET arregadas = arregadas + 1`,
    [jogadorId],
  );
}

async function getTopJogadores(limite = 10) {
  const db = getDb();
  return db.all(
    `SELECT n.nome, e.partidas_jogadas, e.arregadas
     FROM estatisticas e
     JOIN nicks n ON e.id = n.id
     ORDER BY e.partidas_jogadas DESC, e.arregadas ASC
     LIMIT ?`,
    [limite],
  );
}

async function getEstatisticas(jogadorId) {
  const db = getDb();
  return db.get("SELECT * FROM estatisticas WHERE id = ?", [jogadorId]);
}

module.exports = {
  registrarPartidaJogada,
  registrarArregada,
  getEstatisticas,
  getTopJogadores,
};
