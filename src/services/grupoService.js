const db = require("./database"); // Ajuste para o caminho do seu arquivo de DB

async function salvarDiscord(groupId, link) {
  const query = `INSERT OR REPLACE INTO grupos (id_grupo, link_discord) VALUES (?, ?)`;
  await db.run(query, [groupId, link]); // Ajuste o 'db.run' se usar outro método
}

async function obterDiscord(groupId) {
  const query = `SELECT link_discord FROM grupos WHERE id_grupo = ?`;
  const row = await db.get(query, [groupId]); // Ajuste o 'db.get' se usar outro método
  return row ? row.link_discord : null;
}

module.exports = { salvarDiscord, obterDiscord };
