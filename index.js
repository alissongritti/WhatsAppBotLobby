require("dotenv").config();

const { iniciarBanco, getDb } = require("./src/database");
const { initBot } = require("./src/bot");

async function main() {
  await iniciarBanco();
  const db = getDb();
  await db.run("DELETE FROM config WHERE chave LIKE 'rss_%'");
  console.log(
    "🧹 MEMÓRIA DO RSS RESETADA! O Gemini vai tentar resumir na próxima.",
  );
  initBot();
}

main().catch((err) => {
  console.error("❌ Falha ao iniciar a aplicação:", err);
  process.exit(1);
});
