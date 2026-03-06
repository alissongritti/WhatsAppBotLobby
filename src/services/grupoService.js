const { getDb } = require("../database");

async function salvarDiscord(groupId, link) {
  const db = getDb();
  const query = `INSERT OR REPLACE INTO grupos (id_grupo, link_discord) VALUES (?, ?)`;
  await db.run(query, [groupId, link]);
}

async function obterDiscord(groupId) {
  const db = getDb();
  const query = `SELECT link_discord FROM grupos WHERE id_grupo = ?`;
  const row = await db.get(query, [groupId]);
  return row ? row.link_discord : null;
}

module.exports = { salvarDiscord, obterDiscord };
