const Parser = require("rss-parser");
const cheerio = require("cheerio");
const axios = require("axios");
const { getDb } = require("../database");

const parser = new Parser();

const CS2_RSS_URL = "https://steamcommunity.com/games/csgo/rss/";

// Nomes que não devem ser traduzidos
const NOMES_PRESERVAR = [
  "Warden",
  "Sanctum",
  "Inferno",
  "Mirage",
  "Nuke",
  "Dust2",
  "Anubis",
  "Ancient",
  "Vertigo",
  "Cache",
  "Train",
  "Overpass",
  "Cobblestone",
  "Baggage",
  "Agency",
  "Office",
  "Italy",
  "Canals",
  "Shoreline",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function limparHtml(html) {
  if (!html) return "";

  const $ = cheerio.load(html);

  $("li").each((_, el) => {
    $(el).replaceWith(`• ${$(el).text().trim()}\n`);
  });

  $("br").replaceWith("\n");

  return $.text()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^\*\s+/, "• "))
    .map((l) => l.replace(/\\\[/g, "["))
    .join("\n")
    .trim();
}

async function traduzirTexto(texto) {
  if (!texto) return texto;

  // Protege nomes de mapas/termos com placeholders antes de traduzir
  const substituicoes = [];
  let textoProtegido = texto;

  NOMES_PRESERVAR.forEach((nome, i) => {
    const regex = new RegExp(`\\b${nome}\\b`, "gi");
    if (regex.test(textoProtegido)) {
      textoProtegido = textoProtegido.replace(regex, `__NOME${i}__`);
      substituicoes.push({ placeholder: `__NOME${i}__`, original: nome });
    }
  });

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(textoProtegido)}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    let resultado = data[0].map((parte) => parte[0]).join("");

    // Restaura os nomes originais
    substituicoes.forEach(({ placeholder, original }) => {
      resultado = resultado.replace(new RegExp(placeholder, "g"), original);
    });

    return resultado;
  } catch (err) {
    console.error("⚠️ Erro ao traduzir bloco:", err.message);
    return texto; // Se falhar, retorna o original em inglês
  }
}

async function traduzirBlocos(texto) {
  if (!texto) return texto;

  const linhas = texto.split("\n");
  const blocos = [];
  let blocoAtual = "";

  for (const linha of linhas) {
    if ((blocoAtual + "\n" + linha).length > 500) {
      if (blocoAtual) blocos.push(blocoAtual.trim());
      blocoAtual = linha;
    } else {
      blocoAtual += (blocoAtual ? "\n" : "") + linha;
    }
  }
  if (blocoAtual) blocos.push(blocoAtual.trim());

  const traduzidos = await Promise.all(blocos.map(traduzirTexto));
  return traduzidos.join("\n");
}

// ─── Formatação ───────────────────────────────────────────────────────────────

async function formatarAtualizacao(item, completo = false) {
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

  const tituloTraduzido = await traduzirTexto(titulo);

  let texto =
    `🔔 *CS2 UPDATE* 🔔\n\n` +
    `📋 *${tituloTraduzido}*\n` +
    (data ? `📅 ${data}\n` : "");

  if (completo && item.content) {
    const conteudo = limparHtml(item.content);
    if (conteudo) {
      const traduzido = await traduzirBlocos(conteudo);
      const truncado =
        traduzido.length > 1500
          ? traduzido.substring(0, 1500) + "\n\n_(continua no link)_"
          : traduzido;
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

async function fetchUltimasAtualizacoes(quantidade = 1) {
  const feed = await parser.parseURL(CS2_RSS_URL);
  return feed.items?.slice(0, quantidade) ?? [];
}

module.exports = {
  verificarNovaAtualizacao,
  fetchUltimasAtualizacoes,
  getGruposAutorizados,
  formatarAtualizacao,
};
