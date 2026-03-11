const { getDb } = require("../database");

// ─── Whitelist (Aprovação de Uso) ─────────────────────────────────────────

async function isGrupoAutorizado(groupId) {
  const db = getDb();
  const row = await db.get(
    "SELECT autorizado FROM grupos WHERE id_grupo = ? AND autorizado = 1",
    [groupId],
  );
  return !!row;
}

async function autorizarGrupo(groupId) {
  const db = getDb();
  await db.run(
    `INSERT INTO grupos (id_grupo, autorizado) VALUES (?, 1)
     ON CONFLICT(id_grupo) DO UPDATE SET autorizado = 1`,
    [groupId],
  );
}

async function revogarGrupo(groupId) {
  const db = getDb();
  await db.run("UPDATE grupos SET autorizado = 0 WHERE id_grupo = ?", [
    groupId,
  ]);
}

// ─── Discord (Link do Grupo) ──────────────────────────────────────────────

async function obterDiscord(groupId) {
  const db = getDb();
  const row = await db.get(
    "SELECT link_discord FROM grupos WHERE id_grupo = ?",
    [groupId],
  );
  return row ? row.link_discord : null;
}

async function setDiscord(groupId, link) {
  const db = getDb();
  await db.run(
    `INSERT INTO grupos (id_grupo, link_discord) VALUES (?, ?)
     ON CONFLICT(id_grupo) DO UPDATE SET link_discord = ?`,
    [groupId, link, link],
  );
}

// ─── Exportando TUDO ──────────────────────────────────────────────────────
module.exports = {
  isGrupoAutorizado,
  autorizarGrupo,
  revogarGrupo,
  obterDiscord,
  setDiscord,
};
