const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://prosettings.net/players";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

// Extrai todas as tabelas como { secao: { chave: valor } }
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

  const { data } = await axios.get(url, { headers: HEADERS });
  const $ = cheerio.load(data);

  // Verifica se a página existe
  const titulo = $("h1").first().text().trim();
  if (!titulo || titulo.toLowerCase().includes("pro settings")) {
    return null;
  }

  const tabelas = extrairTabelas($);

  // Perfil
  const perfil = tabelas["tabela_1"] ?? {};
  const nomeReal = perfil["Name"] ?? jogador;
  const time = perfil["Team"] ?? "–";

  // Mouse
  const mouse = tabelas["Mouse"] ?? {};

  // Crosshair — só os campos essenciais
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

  // Código da mira — extrai direto do HTML com regex
  const codigoMira =
    (data.match(
      /CSGO-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}/,
    ) || [])[0] ?? null;

  // Vídeo — tabelas 6 e 7 (resolução + configurações gráficas)
  const video = { ...tabelas["tabela_6"], ...tabelas["tabela_7"] };

  return { nomeReal, time, mouse, crosshair, codigoMira, video, url };
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

  // Mouse
  if (Object.keys(mouse).length > 0) {
    texto += `🖱️ *Mouse*\n`;
    texto += linha("DPI", mouse["DPI"]);
    texto += linha("Sensitivity", mouse["Sensitivity"]);
    texto += linha("eDPI", mouse["eDPI"]);
    texto += linha("Hz", mouse["Hz"]);
    texto += "\n";
  }

  // Crosshair
  const crosshairFiltrado = Object.entries(crosshair).filter(([, v]) => v);
  if (crosshairFiltrado.length > 0) {
    texto += `➕ *Crosshair*\n`;
    crosshairFiltrado.forEach(([k, v]) => {
      texto += linha(k, v);
    });
    texto += "\n";
  }

  // Código da mira
  if (codigoMira) {
    texto += `🔑 *Crosshair Code*\n`;
    texto += `  ${codigoMira}\n\n`;
  }

  // Vídeo
  if (Object.keys(video).length > 0) {
    texto += `🖥️ *Vídeo*\n`;
    texto += linha("Resolution", video["Resolution"]);
    texto += linha("Aspect Ratio", video["Aspect Ratio"]);
    texto += linha("Scaling Mode", video["Scaling Mode"]);
    texto += linha("V-Sync", video["V-Sync"]);
    texto += linha("NVIDIA Reflex", video["NVIDIA Reflex Low Latency"]);
    texto += "\n";
  }

  texto += `🔗 ${url}`;

  return texto.trim();
}

module.exports = { getConfigs, formatarConfigs };
