const { getDb } = require("../database");

// ─── Whitelist (Aprovação de Uso) ─────────────────────────────────────────

async function isGrupoAutorizado(groupId) {
  if (!groupId) return false;

  const db = getDb();
  const cleanId = groupId.trim();

  const sql = `SELECT id_grupo FROM grupos_autorizados WHERE id_grupo = ?`;
  const row = await db.get(sql, [cleanId]);

  return !!row;
}

async function autorizarGrupo(groupId) {
  if (!groupId) return false;

  const db = getDb();
  const cleanId = groupId.trim();

  const sql = `INSERT OR REPLACE INTO grupos_autorizados (id_grupo, criado_em) VALUES (?, DATETIME('now'))`;
  await db.run(sql, [cleanId]);
  return true;
}

async function revogarGrupo(groupId) {
  if (!groupId) return false;

  const db = getDb();
  const cleanId = groupId.trim();

  await db.run("DELETE FROM grupos_autorizados WHERE id_grupo = ?", [cleanId]);
}

async function getGruposAutorizados() {
  const db = getDb();
  return await db.all("SELECT id_grupo FROM grupos_autorizados");
}

// ─── Discord (Link do Grupo) ──────────────────────────────────────────────

async function obterDiscord(groupId) {
  const db = getDb();
  const row = await db.get(
    "SELECT link_discord FROM grupos WHERE id_grupo = ?",
    [groupId.trim()],
  );
  return row ? row.link_discord : null;
}

async function setDiscord(groupId, link) {
  const db = getDb();
  await db.run(
    `INSERT INTO grupos (id_grupo, link_discord) VALUES (?, ?)
     ON CONFLICT(id_grupo) DO UPDATE SET link_discord = ?`,
    [groupId.trim(), link, link],
  );
}

module.exports = {
  isGrupoAutorizado,
  autorizarGrupo,
  revogarGrupo,
  getGruposAutorizados,
  obterDiscord,
  setDiscord,
};
