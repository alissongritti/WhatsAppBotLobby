const Parser = require("rss-parser");
const cheerio = require("cheerio");
const { getDb } = require("../database");

const parser = new Parser();

const CS2_RSS_URL = "https://steamcommunity.com/games/csgo/rss/";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Converte HTML do patch note em texto limpo para WhatsApp
function limparHtml(html) {
  if (!html) return "";

  const $ = cheerio.load(html);

  // Converte <li> em bullet points
  $("li").each((_, el) => {
    $(el).replaceWith(`• ${$(el).text().trim()}\n`);
  });

  // Converte <br> em quebra de linha
  $("br").replaceWith("\n");

  // Pega o texto limpo e remove linhas vazias extras
  return $.text()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
}

function formatarAtualizacao(item, completo = false) {
  const titulo = item.title ?? "New Update";
  const link = item.link ?? "";
  const data = item.pubDate
    ? new Date(item.pubDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  let texto =
    `🔔 *CS2 UPDATE* 🔔\n\n` +
    `📋 *${titulo}*\n` +
    (data ? `📅 ${data}\n` : "");

  // No !novidades mostra o conteúdo, na notificação automática só o título + link
  if (completo && item.content) {
    const conteudo = limparHtml(item.content);
    if (conteudo) {
      // Limita a 1500 chars para não estourar o WhatsApp
      const truncado =
        conteudo.length > 1500
          ? conteudo.substring(0, 1500) + "\n\n_(continua no link)_"
          : conteudo;
      texto += `\n${truncado}\n`;
    }
  }

  if (link) texto += `\n🔗 ${link}`;

  return texto;
}

// ─── Banco ────────────────────────────────────────────────────────────────────

async function getUltimoGuidSalvo() {
  const db = getDb();
  const row = await db.get(
    "SELECT valor FROM config WHERE chave = 'rss_ultimo_guid'",
  );
  return row?.valor ?? null;
}

async function salvarUltimoGuid(guid) {
  const db = getDb();
  await db.run(
    `INSERT INTO config (chave, valor) VALUES ('rss_ultimo_guid', ?)
     ON CONFLICT(chave) DO UPDATE SET valor = ?`,
    [guid, guid],
  );
}

async function getGruposAutorizados() {
  const db = getDb();
  return db.all("SELECT id_grupo FROM grupos WHERE autorizado = 1");
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

// Verifica se tem patch note novo — retorna o item ou null
async function verificarNovaAtualizacao() {
  const feed = await parser.parseURL(CS2_RSS_URL);
  const item = feed.items?.[0];
  if (!item) return null;

  const ultimoGuid = await getUltimoGuidSalvo();
  if (item.guid !== ultimoGuid) {
    await salvarUltimoGuid(item.guid);
    return item;
  }

  return null;
}

// Retorna as N últimas atualizações para o !novidades
async function fetchUltimasAtualizacoes(quantidade = 3) {
  const feed = await parser.parseURL(CS2_RSS_URL);
  return feed.items?.slice(0, quantidade) ?? [];
}

module.exports = {
  verificarNovaAtualizacao,
  fetchUltimasAtualizacoes,
  getGruposAutorizados,
  formatarAtualizacao,
};
