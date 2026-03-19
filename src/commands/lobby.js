const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { marcarTodos, mencionarJogadores } = require("../utils/mentions");
const { parseHorario } = require("../utils/timeParser");
const grupoService = require("../services/grupoService");

async function criarLobby({
  msg,
  chat,
  comando,
  parametro,
  senderId,
  groupId,
}) {
  // --- PARSE DE PARÂMETROS ---
  const isMix = comando === "!mix";
  let horario = "";
  let titulo = isMix ? "MIX 5X5" : "LOBBY";

  if (parametro) {
    const palavras = parametro.split(" ");
    const primeiraPalavra = palavras[0];
    const ultimaPalavra = palavras[palavras.length - 1];

    const horarioInicio = parseHorario(primeiraPalavra);
    const horarioFim =
      !horarioInicio && palavras.length > 1
        ? parseHorario(ultimaPalavra)
        : null;

    if (horarioInicio) {
      horario = horarioInicio;
      const resto = parametro.substring(primeiraPalavra.length).trim();
      if (resto) titulo = resto.toUpperCase();
    } else if (horarioFim) {
      horario = horarioFim;
      const resto = palavras.slice(0, -1).join(" ").trim();
      if (resto) titulo = resto.toUpperCase();
    } else {
      titulo = parametro.toUpperCase();
    }
  }

  // ─── NOVA TRAVA DE MONOGAMIA INTELIGENTE ───────────────────────────────────
  // Em vez de barrar direto, verifica se o horário conflita (janela de 1h30)
  const conflito = await partidaService.verificarConflitoDeHorario(
    groupId,
    senderId,
    horario
  );

  if (conflito) {
    const infoH = conflito.horario ? ` às *${conflito.horario}*` : " (sem horário)";
    await msg.reply(
      `🚨 Emocionado! Você já é titular na *Lobby #${conflito.numero_lobby}: ${conflito.titulo}*${infoH}.\n\n` +
      `Para criar outra, as partidas precisam ter pelo menos *1h30* de diferença.`
    );
    return;
  }
  // ───────────────────────────────────────────────────────────────────────────

  // ─── Trava unificada: analisa cada sala aberta e decide o que fazer ─────────
  const DIFERENCA_MINIMA_MIN = 90; // 1h30 em minutos
  const agora = new Date();
  const horaAtualStr =
    agora.getHours().toString().padStart(2, "0") +
    ":" +
    agora.getMinutes().toString().padStart(2, "0");

  function horaParaMinutos(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  let textoAviso = "";
  const lobbiesAbertas = await partidaService.getPartidasAbertas(groupId);

  for (const lobby of lobbiesAbertas) {
    const numTitulares = await partidaService.contarTitulares(lobby.id);
    const estaCheia = numTitulares >= lobby.max_players;
    const horarioPassou = lobby.horario ? horaAtualStr > lobby.horario : false;

    if (estaCheia) continue;

    if (horarioPassou) {
      await partidaService.cancelarPartida(lobby.id);
      textoAviso = `♻️ *O ${lobby.tipo} #${lobby.numero_lobby} (${lobby.horario}) foi cancelado por inatividade.*\n\n`;
      continue;
    }

    if (!lobby.horario) {
      await msg.reply(
        `⚠️ O ${lobby.tipo} #${lobby.numero_lobby} ainda tem vagas e não tem horário definido.\n\n` +
          `Para criar outra sala, preencha as vagas ou atribua um horário:\n` +
          `*!horario HH:mm* — para definir o horário\n` +
          `*!eu ${lobby.numero_lobby}* — para entrar nela`,
      );
      return;
    }

    if (horario) {
      const minLobbyExistente = horaParaMinutos(lobby.horario);
      const minNovaLobby = horaParaMinutos(horario);
      const diferenca = Math.abs(minNovaLobby - minLobbyExistente);
      const diferencaReal = diferenca > 720 ? 1440 - diferenca : diferenca;

      if (diferencaReal < DIFERENCA_MINIMA_MIN) {
        await msg.reply(
          `⚠️ O ${lobby.tipo} #${lobby.numero_lobby} já está marcado para as *${lobby.horario}*.\n\n` +
            `Para criar outra sala, o horário precisa ter pelo menos *1h30 de diferença*.\n` +
            `*!eu ${lobby.numero_lobby}* — para entrar nela`,
        );
        return;
      }
    } else {
      await msg.reply(
        `Calma lá! O ${lobby.tipo} #${lobby.numero_lobby} (${lobby.horario}) ainda tem vagas para o time titular.\n` +
          `Mande *!eu ${lobby.numero_lobby}* para entrar nela antes de tentar criar outra.`,
      );
      return;
    }
  }

  // --- CRIAÇÃO DA PARTIDA ---
  const maxPlayers = isMix ? 10 : 5;
  const tipo = isMix ? "MIX" : "LOBBY";
  const numeroLobby = await partidaService.gerarNumeroLobbyDisponivel(groupId);

  const result = await partidaService.criarPartida({
    groupId,
    senderId,
    titulo,
    horario,
    tipo,
    maxPlayers,
    numeroLobby,
  });

  const partidaId = result.lastID;
  await jogadorService.adicionarJogador(partidaId, senderId, "TITULAR");

  let texto = textoAviso;
  texto += await gerarListaTexto(partidaId, maxPlayers);
  texto += `\nMande *!eu ${numeroLobby}* para entrar!`;

  await marcarTodos(chat, texto);

  const suplentesOutras = await partidaService.getSuplentesDeOutrasPartidas(
    groupId,
    partidaId,
  );
  if (suplentesOutras.length > 0) {
    const aviso =
      `👀 *Atenção Reservas!*\nA Lobby #${numeroLobby} acabou de ser criada com vagas para titulares!\n\n` +
      `Se quiserem sair do banco e jogar nesta nova, mandem:\n*!sair* (para sair da atual)\ne depois *!eu ${numeroLobby}*`;
    await mencionarJogadores(
      chat,
      aviso,
      suplentesOutras.map((s) => s.jogador_id),
    );
  }
}

module.exports = { criarLobby };