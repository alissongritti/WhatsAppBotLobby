const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

let db;

async function iniciarBanco() {
  db = await open({
    filename: "./bot_database.sqlite",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS nicks (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS estatisticas (
      id TEXT PRIMARY KEY,
      partidas_jogadas INTEGER DEFAULT 0,
      arregadas INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      criador_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      horario TEXT,
      tipo TEXT NOT NULL,
      max_players INTEGER NOT NULL,
      status TEXT DEFAULT 'ABERTA',
      data_criacao DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS jogadores_partida (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partida_id INTEGER NOT NULL,
      jogador_id TEXT NOT NULL,
      papel TEXT DEFAULT 'TITULAR',
      FOREIGN KEY(partida_id) REFERENCES partidas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS jogadores_silenciados (
      id TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS grupos (
      id_grupo TEXT PRIMARY KEY,
      link_discord TEXT
    );

    CREATE TABLE IF NOT EXISTS hltv_jogos (
      id            INTEGER PRIMARY KEY,
      time1         TEXT NOT NULL,
      time2         TEXT NOT NULL,
      evento        TEXT,
      tier          TEXT,
      data_jogo     INTEGER,
      ao_vivo       INTEGER DEFAULT 0,
      atualizado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hltv_resultados (
      id            INTEGER PRIMARY KEY,
      time1         TEXT NOT NULL,
      score1        INTEGER,
      time2         TEXT NOT NULL,
      score2        INTEGER,
      evento        TEXT,
      data_jogo     INTEGER,
      atualizado_em INTEGER NOT NULL
    );
  `);

  await db.exec("PRAGMA foreign_keys = ON;");

  try {
    await db.exec("ALTER TABLE partidas ADD COLUMN numero_lobby INTEGER");
  } catch (e) {
    // Coluna já existe, ignora
  }

  try {
    await db.exec("ALTER TABLE grupos ADD COLUMN autorizado INTEGER DEFAULT 0");
  } catch (e) {
    // Coluna já existe, ignora
  }
  console.log("📦 Banco de dados SQLite conectado e pronto!");
}

function getDb() {
  if (!db) throw new Error("Banco de dados não inicializado.");
  return db;
}

module.exports = { iniciarBanco, getDb };
