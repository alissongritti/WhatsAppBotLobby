const hltvService = require("../services/hltvService");

function formatarHora(timestamp) {
  if (!timestamp) return "🔴 AO VIVO";
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

async function listarJogos({ msg }) {
  await msg.reply("⏳ Consultando jogos de CS2...");

  const jogos = await hltvService.getJogosTopTier();

  if (jogos.length === 0) {
    await msg.reply("😴 Nenhum jogo de CS2 encontrado para hoje.");
    return;
  }

  let texto = `🌟 *JOGOS DE CS2 HOJE* 🌟\n\n`;

  jogos.slice(0, 10).forEach((jogo) => {
    const hora = formatarHora(jogo.data_jogo);
    const isBR = hltvService.ehBR(jogo.time1, jogo.time2);
    const destaque = isBR ? " 🇧🇷" : "";
    texto += `⏰ *${hora}* | ${jogo.time1} x ${jogo.time2}${destaque}\n`;
    texto += `🏆 ${jogo.evento}\n\n`;
  });

  await msg.reply(texto.trim());
}

async function listarJogosBR({ msg }) {
  await msg.reply("⏳ Procurando os Brazucas...");

  const jogos = await hltvService.getJogosBR();

  if (jogos.length === 0) {
    await msg.reply("🇧🇷 Nenhum time brasileiro jogando hoje.");
    return;
  }

  let texto = `🇧🇷 *JOGOS DOS BRAZUCAS HOJE* 🇧🇷\n\n`;

  jogos.forEach((jogo) => {
    const hora = formatarHora(jogo.data_jogo);
    texto += `⏰ *${hora}* | ${jogo.time1} x ${jogo.time2}\n`;
    texto += `🏆 ${jogo.evento}\n\n`;
  });

  await msg.reply(texto.trim());
}

async function listarResultados({ msg }) {
  await msg.reply("⏳ Buscando resultados recentes...");

  const resultados = await hltvService.getResultados();

  if (resultados.length === 0) {
    await msg.reply("😴 Nenhum resultado recente encontrado.");
    return;
  }

  let texto = `📊 *RESULTADOS RECENTES* 📊\n\n`;

  resultados.slice(0, 10).forEach((r) => {
    const placar =
      r.score1 !== null && r.score2 !== null
        ? ` *(${r.score1} x ${r.score2})*`
        : "";
    texto += `${r.time1} x ${r.time2}${placar}\n`;
    texto += `🏆 ${r.evento}\n\n`;
  });

  await msg.reply(texto.trim());
}

module.exports = { listarJogos, listarJogosBR, listarResultados };
