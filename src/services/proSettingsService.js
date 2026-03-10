const cheerio = require("cheerio");

const BASE_URL = "https://prosettings.net/players";

// Headers muito mais agressivos para simular 100% um navegador real
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Ch-Ua":
    '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
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
  console.log("🔍 Buscando configs para:", url);

  try {
    // Trocando Axios pelo fetch nativo do Node.js
    const response = await fetch(url, {
      method: "GET",
      headers: HEADERS,
    });

    if (!response.ok) {
      console.log(
        `⚠️ Prosettings bloqueou ou não achou. Status: ${response.status}`,
      );
      return null;
    }

    const data = await response.text();
    const $ = cheerio.load(data);

    // Verifica se a página existe (algumas vezes o site redireciona para a home em vez de dar 404)
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
  } catch (error) {
    console.error("❌ Erro na requisição do getConfigs:", error.message);
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
    texto += "\n";
  }

  texto += `🔗 ${url}`;

  return texto.trim();
}

module.exports = { getConfigs, formatarConfigs };
