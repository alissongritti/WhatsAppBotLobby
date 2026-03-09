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
  const { ativos, encerrados } = await hltvService.getJogosBR();

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

  if (encerrados.length > 0) {
    await msg.reply(
      "😴 Todos os jogos dos Brazucas de hoje já acabaram!\n\nMande *!resultados br* para ver os placares ou aguarde os jogos de amanhã.",
    );
    return;
  }

  await msg.reply(
    "🇧🇷 Nenhum time brasileiro joga hoje.\n\nAguarde os próximos jogos! 💪",
  );
}

async function listarResultados({ msg, parametro }) {
  const resultados = await hltvService.getResultados();

  // Filtra só BR se o usuário mandou "!resultados br"
  const apenasB = parametro?.toLowerCase() === "br";
  const lista = apenasB
    ? resultados.filter((r) => hltvService.ehBR(r.time1, r.time2))
    : resultados;

  if (lista.length === 0) {
    const msgVazia = apenasB
      ? "🇧🇷 Nenhum resultado de time brasileiro ainda hoje.\n\nMande *!jogos* para ver os jogos que ainda vão acontecer!"
      : "😴 Nenhum resultado ainda hoje.\n\nMande *!jogos* para ver os jogos que ainda vão acontecer!";
    await msg.reply(msgVazia);
    return;
  }

  const header = apenasB
    ? `🇧🇷 *RESULTADOS DOS BRAZUCAS HOJE* 🇧🇷\n\n`
    : `📊 *RESULTADOS DE HOJE* 📊\n\n`;

  let texto = header;

  lista.slice(0, 10).forEach((r) => {
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
