if (typeof globalThis.File === "undefined") {
  globalThis.File = class File {};
}

require("dotenv").config();

const { iniciarBanco, getDb } = require("./src/database");
const { initBot } = require("./src/bot");

async function main() {
  await iniciarBanco();
  await getDb().run("DELETE FROM config WHERE chave LIKE 'rss_%'");
  initBot();
}

main().catch((err) => {
  console.error("❌ Falha ao iniciar a aplicação:", err);
  process.exit(1);
});
