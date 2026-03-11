const Parser = require("rss-parser");
const cheerio = require("cheerio");
const { getDb } = require("../database");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa o parser e o Gemini
const parser = new Parser();
const CS2_RSS_URL = "https://steamcommunity.com/games/csgo/rss/";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── O Cérebro (Integração com Gemini) ────────────────────────────────────────

async function resumirComIA(titulo, conteudoHtml, dataPub, link) {
  // O cheerio agora só serve pra limpar as tags de HTML e economizar tokens da IA
  const $ = cheerio.load(conteudoHtml || "");
  const textoPuro = $.text().trim();

  // O Prompt do "Tech Lead" de CS2
  const prompt = `Você é um jogador experiente de Counter-Strike 2.
A Valve lançou as seguintes notas de atualização (patch notes) em inglês:

TÍTULO: ${titulo}
CONTEÚDO: ${textoPuro}

Sua tarefa:
1. Faça um resumo direto ao ponto das mudanças, em português do Brasil.
2. Use bullet points curtos com emojis.
3. Use jargões e gírias da comunidade brasileira de CS (ex: TR, CT, smoke, pixel, varado, nerf, buff).
4. NUNCA traduza nomes de mapas (Dust2, Mirage, Nuke, Overpass, etc) nem de armas.
5. O formato da sua resposta deve ser EXATAMENTE este, pronto para o WhatsApp:

🔔 *CS2 UPDATE* 🔔
📋 *[Escreva o Título Traduzido/Adaptado]*
📅 ${dataPub}

[Seus bullet points resumidos aqui]

🔗 ${link}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("❌ Erro ao gerar resumo no Gemini:", err.message);
    // Fallback de segurança se a API cair
    return `🔔 *CS2 UPDATE* 🔔\n📋 *${titulo}*\n📅 ${dataPub}\n\n⚠️ Saiu um patch novo, mas minha IA tá desarmando a C4 e não conseguiu resumir.\n🔗 ${link}`;
  }
}

// ─── Banco de Dados (Cache Permanente) ────────────────────────────────────────

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
    `INSERT INTO config (chave, valor) VALUES ('rss_ultimo_guid', ?)
     ON CONFLICT(chave) DO UPDATE SET valor = ?`,
    [guid, guid],
  );
  await db.run(
    `INSERT INTO config (chave, valor) VALUES ('rss_ultimo_resumo', ?)
     ON CONFLICT(chave) DO UPDATE SET valor = ?`,
    [resumoIA, resumoIA], // Salvamos o textão inteiro formatado no banco!
  );
}

async function getGruposAutorizados() {
  const db = getDb();
  return db.all("SELECT id_grupo FROM grupos WHERE autorizado = 1");
}

// ─── Funções Públicas ─────────────────────────────────────────────────────────

// Usada pelo Cronjob para vigiar a Steam (só gasta API se tiver patch novo)
async function verificarNovaAtualizacao() {
  const feed = await parser.parseURL(CS2_RSS_URL);
  const item = feed.items?.[0];
  if (!item) return null;

  const salvos = await getDadosSalvos();

  // Se o GUID for diferente, tem atualização nova!
  if (item.guid !== salvos.guid) {
    console.log(
      "📰 Nova atualização do CS2! Acordando o Gemini para resumir...",
    );

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

    return resumoIA; // Retorna a string pronta pro WhatsApp
  }

  return null; // Nada novo sob o sol
}

// Usada pelo comando !novidades no WhatsApp (Custo ZERO, lê direto do SQLite)
async function getUltimoResumo() {
  const salvos = await getDadosSalvos();

  if (salvos.resumo) {
    console.log("⚡ Retornando resumo das novidades direto do SQLite");
    return salvos.resumo;
  }

  // Se o banco estiver vazio (primeira vez rodando), força a buscar e resumir
  const textoNovo = await verificarNovaAtualizacao();
  return textoNovo ?? "😴 Nenhuma atualização encontrada no momento.";
}

module.exports = {
  verificarNovaAtualizacao,
  getUltimoResumo,
  getGruposAutorizados,
};
