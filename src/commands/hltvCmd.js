const hltvService = require("../services/hltvService");
const {
  fetchUltimasAtualizacoes,
  formatarAtualizacao,
} = require("../services/rssService");
const {
  getConfigs,
  formatarConfigs,
} = require("../services/proSettingsService");

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
      "😴 Todos os jogos dos Brazucas de hoje já acabaram!\n\nMande *!resultadosbr* para ver os placares ou aguarde os jogos de amanhã.",
    );
    return;
  }

  await msg.reply(
    "🇧🇷 Nenhum time brasileiro joga hoje.\n\nAguarde os próximos jogos! 💪",
  );
}

async function listarResultados({ msg }) {
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

async function listarResultadosBR({ msg }) {
  const resultados = await hltvService.getResultados();
  const lista = resultados.filter((r) => hltvService.ehBR(r.time1, r.time2));

  if (lista.length === 0) {
    await msg.reply(
      "🇧🇷 Nenhum resultado de time brasileiro até o momento.\n\nMande *!jogosbr* para ver os jogos que ainda vão acontecer!",
    );
    return;
  }

  let texto = `🇧🇷 *RESULTADOS DOS BRAZUCAS HOJE* 🇧🇷\n\n`;

  lista.slice(0, 10).forEach((r) => {
    const placar =
      r.score1 !== null && r.score2 !== null
        ? ` *(${r.score1} x ${r.score2})*`
        : "";
    texto += `${r.time1} x ${r.time2}${placar}\n`;
    texto += `🏆 ${r.evento}\n\n`;
  });

  await msg.reply(texto.trim());
}

async function listarNovidades({ msg }) {
  let itens;

  try {
    itens = await fetchUltimasAtualizacoes(1);
  } catch (err) {
    await msg.reply(
      "❌ Não foi possível buscar as atualizações agora. Tente novamente mais tarde.",
    );
    return;
  }

  if (itens.length === 0) {
    await msg.reply("😴 Nenhuma atualização encontrada no momento.");
    return;
  }

  for (const item of itens) {
    await msg.reply(formatarAtualizacao(item, true));
  }
}

async function configJogador({ msg, parametro }) {
  if (!parametro) {
    await msg.reply("❓ Informe o nome do jogador.\nExemplo: *!config fallen*");
    return;
  }

  try {
    const configs = await getConfigs(parametro);

    if (!configs) {
      await msg.reply(
        `❌ Jogador *${parametro}* não encontrado no prosettings.net.\n\nVerifique o nome e tente novamente. Ex: *!config niko*`,
      );
      return;
    }

    await msg.reply(formatarConfigs(configs));
  } catch (err) {
    console.error("❌ Erro ao buscar configs:", err.message);
    await msg.reply(
      "❌ Não foi possível buscar as configurações agora. Tente novamente mais tarde.",
    );
  }
}

module.exports = {
  listarJogos,
  listarJogosBR,
  listarResultados,
  listarResultadosBR,
  listarNovidades,
  configJogador,
};
