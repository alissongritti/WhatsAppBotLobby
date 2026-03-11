if (typeof globalThis.File === "undefined") {
  globalThis.File = class File {};
}

const { iniciarBanco } = require("./src/database");
const { initBot } = require("./src/bot");

async function main() {
  await iniciarBanco();
  // --- INSTRUÇÃO TEMPORÁRIA PARA LIMPAR O CACHE ---
  await getDb().run("DELETE FROM config WHERE chave LIKE 'rss_%'");
  console.log(
    "🧹 Cache do RSS limpo! O Gemini vai trabalhar na próxima chamada.",
  );
  // ------------------------------------------------
  initBot();
}

main().catch((err) => {
  console.error("❌ Falha ao iniciar a aplicação:", err);
  process.exit(1);
});
