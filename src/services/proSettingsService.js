const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

const BASE_URL = "https://prosettings.net/players";

function extrairTabelas($) {
  const resultado = {};

  $("table").each((i, table) => {
    const secao =
      $(table).closest("section, div").find("h3").first().text().trim() ||
      $(table).prevAll("h3").first().text().trim() ||
      `tabela_${i + 1}`;

    const dados = {};
    $(table)
      .find("tr")
      .each((_, row) => {
        const cols = $(row)
          .find("td, th")
          .map((_, col) => $(col).text().trim())
          .get();
        if (cols.length === 2 && cols[0] && cols[1]) {
          dados[cols[0]] = cols[1];
        }
      });

    if (Object.keys(dados).length > 0) {
      const chave = resultado[secao] ? `${secao}_${i}` : secao;
      resultado[chave] = dados;
    }
  });

  return resultado;
}

async function getConfigs(jogador) {
  const url = `${BASE_URL}/${jogador.toLowerCase()}/`;
  console.log("🔍 Buscando configs para:", url);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    const data = await page.content();
    await browser.close();

    const $ = cheerio.load(data);
    const titulo = $("h1").first().text().trim();
    if (!titulo || titulo.toLowerCase().includes("pro settings")) return null;

    const tabelas = extrairTabelas($);

    const perfil = tabelas["tabela_1"] ?? {};
    const nomeReal = perfil["Name"] ?? jogador;
    const time = perfil["Team"] ?? "–";

    const mouse = tabelas["Mouse"] ?? {};
    const crosshairRaw = tabelas["Crosshair"] ?? {};
    const crosshair = {
      Style: crosshairRaw["Style"],
      Size: crosshairRaw["Size"],
      Thickness: crosshairRaw["Thickness"],
      Gap: crosshairRaw["Gap"],
      Color: crosshairRaw["Color"],
      Outline: crosshairRaw["Outline"],
      Dot: crosshairRaw["Dot"],
    };

    const codigoMira =
      (data.match(
        /CSGO-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}/,
      ) || [])[0] ?? null;
    const video = { ...tabelas["tabela_6"], ...tabelas["tabela_7"] };

    return { nomeReal, time, mouse, crosshair, codigoMira, video, url };
  } catch (error) {
    if (browser) await browser.close();
    console.error("❌ Erro no Puppeteer ao buscar configs:", error.message);
    return null;
  }
}

function formatarConfigs({
  nomeReal,
  time,
  mouse,
  crosshair,
  codigoMira,
  video,
  url,
}) {
  const linha = (label, valor) => (valor ? `  • *${label}:* ${valor}\n` : "");
  let texto = `🎮 *${nomeReal}* (${time})\n\n`;

  if (Object.keys(mouse).length > 0) {
    texto += `🖱️ *Mouse*\n`;
    texto += linha("DPI", mouse["DPI"]);
    texto += linha("Sensitivity", mouse["Sensitivity"]);
    texto += linha("eDPI", mouse["eDPI"]);
    texto += linha("Hz", mouse["Hz"]);
    texto += "\n";
  }

  const crosshairFiltrado = Object.entries(crosshair).filter(([, v]) => v);
  if (crosshairFiltrado.length > 0) {
    texto += `➕ *Crosshair*\n`;
    crosshairFiltrado.forEach(([k, v]) => {
      texto += linha(k, v);
    });
    texto += "\n";
  }

  if (codigoMira) {
    texto += `🔑 *Crosshair Code*\n  ${codigoMira}\n\n`;
  }

  if (Object.keys(video).length > 0) {
    texto += `🖥️ *Vídeo*\n`;
    texto += linha("Resolution", video["Resolution"]);
    texto += linha("Aspect Ratio", video["Aspect Ratio"]);
    texto += linha("Scaling Mode", video["Scaling Mode"]);
    texto += "\n";
  }

  texto += `🔗 ${url}`;
  return texto.trim();
}

module.exports = { getConfigs, formatarConfigs };
