const Parser = require("rss-parser");
const cheerio = require("cheerio");
const { getDb } = require("../database");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa o parser e o Gemini
const parser = new Parser();
const CS2_RSS_URL = "https://steamcommunity.com/games/csgo/rss/";

// Verificação de debug no log do PM2
console.log(
  "🔑 Status da Chave Gemini:",
  process.env.GEMINI_API_KEY ? "CARREGADA" : "UNDEFINED VAZIO",
);

// ─── O Cérebro (Integração com Gemini) ────────────────────────────────────────

async function resumirComIA(titulo, conteudoHtml, dataPub, link) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const $ = cheerio.load(conteudoHtml || "");
  const textoPuro = $.text().trim();

  const prompt = `Você é um jogador experiente de Counter-Strike 2.
A Valve lançou as seguintes notas de atualização (patch notes) em inglês:

TÍTULO: ${titulo}
CONTEÚDO: ${textoPuro}

Sua tarefa:
1. Faça um resumo direto ao ponto das mudanças, em português do Brasil.
2. Use uma lista com o caractere "•" ou emojis de CS (como 🔫, 💣, 📍) no início de cada linha para os tópicos.
3. Não use asteriscos (*) para criar listas, use apenas para NEGRITO em termos importantes.
4. NUNCA traduza nomes de mapas (Dust2, Mirage, Nuke, Overpass, etc) nem de armas.
5. O formato da sua resposta deve ser EXATAMENTE este, pronto para o WhatsApp:

🔔 *CS2 UPDATE* 🔔
📋 *[Escreva o Título Traduzido/Adaptado]*
📅 ${dataPub}

[Seus bullet points resumidos aqui]

🔗 ${link}`;

  try {
    // Usando o 1.5-pro para garantir maior compatibilidade e inteligência
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (err) {
    console.error("❌ Erro ao gerar resumo no Gemini:", err.message);
    console.error("❌ Detalhes:", JSON.stringify(err, null, 2));
    return `🔔 *CS2 UPDATE* 🔔\n📋 *${titulo}*\n📅 ${dataPub}\n\n⚠️ Saiu um patch novo, mas minha IA tá desarmando a C4 e não conseguiu resumir.\n🔗 ${link}`;
  }
}

// ─── Banco de Dados ───────────────────────────────────────────────────────────

async function getDadosSalvos() {
  const db = getDb();
  const guidRow = await db.get(
    "SELECT valor FROM config WHERE chave = 'rss_ultimo_guid'",
  );
  const resumoRow = await db.get(
    "SELECT valor FROM config WHERE chave = 'rss_ultimo_resumo'",
  );
  return {
    guid: guidRow?.valor ?? null,
    resumo: resumoRow?.valor ?? null,
  };
}

async function salvarDados(guid, resumoIA) {
  const db = getDb();
  await db.run(
    "INSERT INTO config (chave, valor) VALUES ('rss_ultimo_guid', ?) ON CONFLICT(chave) DO UPDATE SET valor = ?",
    [guid, guid],
  );
  await db.run(
    "INSERT INTO config (chave, valor) VALUES ('rss_ultimo_resumo', ?) ON CONFLICT(chave) DO UPDATE SET valor = ?",
    [resumoIA, resumoIA],
  );
}

async function getGruposAutorizados() {
  const db = getDb();
  return db.all("SELECT id_grupo FROM grupos WHERE autorizado = 1");
}

// ─── Funções Públicas ─────────────────────────────────────────────────────────

async function verificarNovaAtualizacao() {
  try {
    const feed = await parser.parseURL(CS2_RSS_URL);
    const item = feed.items?.[0];
    if (!item) return null;

    const salvos = await getDadosSalvos();

    if (item.guid !== salvos.guid) {
      console.log("📰 Nova atualização do CS2 detectada. Resumindo...");

      const dataPub = item.pubDate
        ? new Date(item.pubDate).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "America/Sao_Paulo",
          })
        : "Hoje";

      const resumoIA = await resumirComIA(
        item.title,
        item.content,
        dataPub,
        item.link,
      );
      await salvarDados(item.guid, resumoIA);
      return resumoIA;
    }
    return null;
  } catch (e) {
    console.error("❌ Erro ao verificar RSS:", e.message);
    return null;
  }
}

async function getUltimoResumo() {
  const salvos = await getDadosSalvos();
  if (salvos.resumo) return salvos.resumo;

  const textoNovo = await verificarNovaAtualizacao();
  return textoNovo ?? "😴 Nenhuma atualização encontrada no momento.";
}

module.exports = {
  verificarNovaAtualizacao,
  getUltimoResumo,
  getGruposAutorizados,
};
