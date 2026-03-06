const hltvService = require("../services/hltvService");

// Função auxiliar para formatar a hora (ex: 15:30)
function formatarHora(timestamp) {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatarHora(timestamp) {
  if (!timestamp) return "🔴 AO VIVO"; // <-- trata jogos sem horário
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

async function listarJogos({ msg }) {
  await msg.reply(
    "⏳ Consultando a HLTV... (Isso pode levar alguns segundos na primeira vez do dia)",
  );

  const jogos = await hltvService.getJogosTopTier();

  if (jogos.length === 0) {
    await msg.reply("😴 Nenhum jogo Top Tier da HLTV rolando hoje.");
    return;
  }

  let texto = `🌟 *JOGOS TOP TIER DE HOJE* 🌟\n\n`;

  // Mostra no máximo os 10 primeiros jogos para não bugar o WhatsApp
  jogos.slice(0, 10).forEach((jogo) => {
    const estrelas = "⭐".repeat(jogo.stars);
    const hora = formatarHora(jogo.date);
    texto += `⏰ *${hora}* | ${jogo.team1.name} x ${jogo.team2.name}\n`;
    texto += `🏆 ${jogo.event.name} ${estrelas}\n\n`;
  });

  await msg.reply(texto.trim());
}

async function listarJogosBR({ msg }) {
  await msg.reply("⏳ Procurando os Brazucas no servidor...");

  const jogos = await hltvService.getJogosBR();

  if (jogos.length === 0) {
    await msg.reply(
      "🇧🇷 Nenhum time brasileiro jogando hoje (ou os jogos já acabaram).",
    );
    return;
  }

  let texto = `🇧🇷 *JOGOS DOS BRAZUCAS HOJE* 🇧🇷\n\n`;

  jogos.forEach((jogo) => {
    const hora = formatarHora(jogo.date);
    texto += `⏰ *${hora}* | ${jogo.team1.name} x ${jogo.team2.name}\n`;
    texto += `🏆 ${jogo.event.name}\n\n`;
  });

  await msg.reply(texto.trim());
}

module.exports = { listarJogos, listarJogosBR };
