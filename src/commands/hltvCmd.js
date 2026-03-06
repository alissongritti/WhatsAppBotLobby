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

  const jogos = await hltvService.getJogos();

  if (jogos.length === 0) {
    await msg.reply(
      "😴 Todos os jogos de hoje já acabaram!\n\nMande *!resultados* para ver os placares ou aguarde os jogos de amanhã.",
    );
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

  const { ativos, encerrados } = await hltvService.getJogosBR();

  // Tem jogos ao vivo ou futuros
  if (ativos.length > 0) {
    let texto = `🇧🇷 *JOGOS DOS BRAZUCAS HOJE* 🇧🇷\n\n`;

    ativos.forEach((jogo) => {
      const hora = formatarHora(jogo.data_jogo);
      texto += `⏰ *${hora}* | ${jogo.time1} x ${jogo.time2}\n`;
      texto += `🏆 ${jogo.evento}\n\n`;
    });

    await msg.reply(texto.trim());
    return;
  }

  // Só tem jogos encerrados
  if (encerrados.length > 0) {
    await msg.reply(
      "😴 Todos os jogos dos Brazucas de hoje já acabaram!\n\nMande *!resultados* para ver os placares ou aguarde os jogos de amanhã.",
    );
    return;
  }

  // Nenhum jogo BR hoje
  await msg.reply(
    "🇧🇷 Nenhum time brasileiro joga hoje.\n\nAguarde os próximos jogos! 💪",
  );
}

async function listarResultados({ msg }) {
  await msg.reply("⏳ Buscando resultados do dia...");

  const resultados = await hltvService.getResultados();

  if (resultados.length === 0) {
    await msg.reply(
      "😴 Nenhum resultado ainda hoje.\n\nMande *!jogos* para ver os jogos que ainda vão acontecer!",
    );
    return;
  }

  let texto = `📊 *RESULTADOS DE HOJE* 📊\n\n`;

  resultados.slice(0, 10).forEach((r) => {
    const isBR = hltvService.ehBR(r.time1, r.time2);
    const destaque = isBR ? " 🇧🇷" : "";
    const placar =
      r.score1 !== null && r.score2 !== null
        ? ` *(${r.score1} x ${r.score2})*`
        : "";
    texto += `${r.time1} x ${r.time2}${placar}${destaque}\n`;
    texto += `🏆 ${r.evento}\n\n`;
  });

  await msg.reply(texto.trim());
}

module.exports = { listarJogos, listarJogosBR, listarResultados };
