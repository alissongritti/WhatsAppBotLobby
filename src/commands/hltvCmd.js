const hltvService = require("../services/hltvService");
const { getUltimoResumo } = require("../services/rssService");

const SUPER_ADMIN_ID = process.env.ADMIN_WA_ID;

// --- SISTEMA DE ANTI-SPAM (COOLDOWN) ---
const travasDeSpam = new Map();
const TEMPO_SILENCIO = 5 * 60 * 1000; // 5 minutos de trava por comando/grupo

function emCooldown(comando, idChat) {
  const chave = `${comando}_${idChat}`;
  const agora = Date.now();

  if (travasDeSpam.has(chave)) {
    const ultimoUso = travasDeSpam.get(chave);
    if (agora - ultimoUso < TEMPO_SILENCIO) {
      return true; // Está no período de silêncio (bloqueia)
    }
  }

  // Se passou, atualiza o relógio e libera
  travasDeSpam.set(chave, agora);
  return false;
}
// ---------------------------------------

function formatarHora(timestamp) {
  if (!timestamp) return "🔴 AO VIVO";
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

async function listarJogos({ msg, chat }) {
  if (emCooldown("jogos", chat.id._serialized)) return;

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

async function listarJogosBR({ msg, chat }) {
  if (emCooldown("jogosbr", chat.id._serialized)) return;

  const { ativos, encerrados } = await hltvService.getJogosBR();

  let texto = `🇧🇷 *BRAZUCAS NO CS2 HOJE* 🇧🇷\n\n`;
  let temConteudo = false;

  if (ativos.length > 0) {
    texto += `🎮 *Jogando / Em breve:*\n`;
    ativos.forEach((jogo) => {
      const hora = formatarHora(jogo.data_jogo);
      texto += `⏰ *${hora}* | ${jogo.time1} x ${jogo.time2}\n`;
      texto += `🏆 ${jogo.evento}\n\n`;
    });
    temConteudo = true;
  }

  if (encerrados.length > 0) {
    texto += `📊 *Resultados de hoje:*\n`;
    encerrados.forEach((r) => {
      const placar =
        r.score1 !== null && r.score2 !== null
          ? ` *(${r.score1} x ${r.score2})*`
          : "";
      texto += `${r.time1} x ${r.time2}${placar}\n`;
      texto += `🏆 ${r.evento}\n\n`;
    });
    temConteudo = true;
  }

  if (!temConteudo) {
    await msg.reply(
      "🇧🇷 Nenhum time brasileiro joga hoje.\n\nAguarde os próximos jogos! 💪",
    );
    return;
  }

  await msg.reply(texto.trim());
}

async function listarResultados({ msg, chat }) {
  if (emCooldown("resultados", chat.id._serialized)) return;

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

async function listarResultadosBR({ msg, chat }) {
  if (emCooldown("resultadosbr", chat.id._serialized)) return;

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

async function listarNovidades({ msg, chat }) {
  if (emCooldown("novidades", chat.id._serialized)) return;

  try {
    const textoResumo = await getUltimoResumo();
    await msg.reply(textoResumo);
  } catch (err) {
    console.error("❌ Erro ao buscar novidades:", err.message);
    await msg.reply("❌ Não foi possível ler as notas da atualização agora.");
  }
}

async function atualizarJogosAdmin({ msg, senderId }) {
  if (senderId !== SUPER_ADMIN_ID) return; // Silencioso — nem avisa que o comando existe

  await hltvService.resetarCache();

  // Força busca imediata chamando getJogos (que vai detectar cache vazio e buscar)
  await hltvService.getJogos();
  await hltvService.getResultados();

  await msg.reply("✅ Cache HLTV resetado e atualizado com sucesso!");
}

module.exports = {
  listarJogos,
  listarJogosBR,
  listarResultados,
  listarResultadosBR,
  listarNovidades,
  atualizarJogosAdmin,
};
