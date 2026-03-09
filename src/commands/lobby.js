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
  // Regra da monogamia: jogador não pode estar em duas partidas
  const jaEstaEmLobby = await partidaService.getPartidaDoJogador(
    groupId,
    senderId,
  );
  if (jaEstaEmLobby) {
    await msg.reply(
      `🚨 Emocionado! Você já está na *Lobby #${jaEstaEmLobby.numero_lobby}: ${jaEstaEmLobby.titulo}*. Mande *!sair* dela primeiro se quiser entrar ou criar outra.`,
    );
    return;
  }

  // Parse dos parâmetros (horário e título)
  const isMix = comando === "!mix";
  let horario = "";
  let titulo = isMix ? "MIX 5X5" : "LOBBY";

  if (parametro) {
    const primeiraPalavra = parametro.split(" ")[0];
    const horarioFormatado = parseHorario(primeiraPalavra);

    if (horarioFormatado) {
      horario = horarioFormatado;
      const resto = parametro.substring(primeiraPalavra.length).trim();
      if (resto) titulo = resto.toUpperCase();
    } else {
      titulo = parametro.toUpperCase();
    }
  }

  // ─── Trava unificada: analisa cada sala aberta e decide o que fazer ───────────
  // Regras:
  // - Sala CHEIA → ignora, pode criar nova
  // - Sala INCOMPLETA + horário passou → cancela por inatividade, pode criar nova
  // - Sala INCOMPLETA + ainda no prazo → bloqueia criação
  const agora = new Date();
  const horaAtualStr =
    agora.getHours().toString().padStart(2, "0") +
    ":" +
    agora.getMinutes().toString().padStart(2, "0");

  let textoAviso = "";
  const lobbiesAbertas = await partidaService.getPartidasAbertas(groupId);

  for (const lobby of lobbiesAbertas) {
    const numTitulares = await partidaService.contarTitulares(lobby.id);
    const estaCheia = numTitulares >= lobby.max_players;

    // Se a lobby não tem horário definido, tratamos como "ainda no prazo"
    // para evitar cancelamento acidental de salas sem horário marcado
    const horarioPassou = lobby.horario ? horaAtualStr > lobby.horario : false;

    if (estaCheia) {
      // Sala cheia — ignora e deixa criar a próxima
      continue;
    }

    if (horarioPassou) {
      // Sala incompleta e horário já passou — cancela e avisa
      await partidaService.cancelarLobby(lobby.id);
      textoAviso = `♻️ *O ${lobby.tipo} #${lobby.numero_lobby} (${lobby.horario}) foi cancelado por inatividade.*\n\n`;
    } else {
      // Sala incompleta e ainda no prazo — bloqueia criação
      await msg.reply(
        `Calma lá! O ${lobby.tipo} #${lobby.numero_lobby} ainda tem vagas para o time titular.\nMande *!eu ${lobby.numero_lobby}* para entrar nela antes de tentar criar outra.`,
      );
      return;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

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

  let texto = textoAviso; // Inclui aviso de sala morta se houver
  texto += `🎮 *${tipo} #${numeroLobby}: ${titulo} - ABERTA* 🎮\n`;
  if (horario) texto += `⏰ *Horário:* ${horario}\n`;
  texto += `\n${await gerarListaTexto(partidaId, maxPlayers)}`;
  texto += `\nMande *!eu ${numeroLobby}* para entrar!`;

  await marcarTodos(chat, texto);

  // Avisa suplentes de outras lobbies sobre a nova vaga
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
