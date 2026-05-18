const { getDb } = require("../database");

const OWNER_ID = process.env.ADMIN_WA_ID;

/**
 * Verifica se um ID é owner ou superadmin.
 * O owner (ADMIN_WA_ID) sempre retorna true, independente da tabela.
 */
async function ehSuperAdmin(waId) {
  if (waId === OWNER_ID) return true;
  const db = getDb();
  const row = await db.get("SELECT id FROM superadmins WHERE id = ?", [waId]);
  return !!row;
}

/**
 * Verifica se um ID é o owner absoluto.
 */
function ehOwner(waId) {
  return waId === OWNER_ID;
}

async function adicionarSuperAdmin(waId) {
  const db = getDb();
  await db.run(
    `INSERT INTO superadmins (id) VALUES (?)
     ON CONFLICT(id) DO NOTHING`,
    [waId],
  );
}

async function removerSuperAdmin(waId) {
  const db = getDb();
  await db.run("DELETE FROM superadmins WHERE id = ?", [waId]);
}

async function listarSuperAdmins() {
  const db = getDb();
  return db.all("SELECT id, atribuido_em FROM superadmins ORDER BY atribuido_em ASC");
}

module.exports = {
  ehSuperAdmin,
  ehOwner,
  adicionarSuperAdmin,
  removerSuperAdmin,
  listarSuperAdmins,
};
