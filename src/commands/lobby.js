const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { marcarTodos, mencionarJogadores } = require("../utils/mentions");
const { parseDateHorario, dataDeHoje, dataEFutura, diasAteData } = require("../utils/timeParser");
const grupoService = require("../services/grupoService");

const LIMITE_DIAS_AGENDAMENTO = 7;
const DIFERENCA_MINIMA_MIN = 90;

async function criarLobby({
  msg,
  chat,
  comando,
  parametro,
  senderId,
  groupId,
}) {
  const isMix = comando === "!mix";
  let horario = "";
  let dataPartida = null;
  let titulo = isMix ? "MIX 5X5" : "LOBBY";

  // --- PARSE DE PARÂMETROS ---
  if (parametro) {
    const palavras = parametro.split(" ");
    const { data, horario: h, tokensConsumidos } = parseDateHorario(palavras[0], palavras[1]);

    if (tokensConsumidos > 0) {
      dataPartida = data;
      horario = h || "";

      if (dataPartida && !dataEFutura(dataPartida)) {
        await msg.reply(`⚠️ A data *${dataPartida}* já passou. Informe uma data válida.`);
        return;
      }

      if (dataPartida && diasAteData(dataPartida) > LIMITE_DIAS_AGENDAMENTO) {
        await msg.reply(
          `📅 Calma, organizadão! Só é possível agendar com até *${LIMITE_DIAS_AGENDAMENTO} dias* de antecedência.\nTente uma data mais próxima.`
        );
        return;
      }

      const restoTokens = palavras.slice(tokensConsumidos).join(" ").trim();
      if (restoTokens) titulo = restoTokens.toUpperCase();
    } else {
      titulo = parametro.toUpperCase();
    }
  }

  // Data informada sem horário
  if (dataPartida && !horario) {
    await msg.reply(
      `⚠️ Você informou a data *${dataPartida}* mas esqueceu o horário.\n` +
      `Exemplo: *${comando} ${dataPartida} 20h${titulo !== (isMix ? "MIX 5X5" : "LOBBY") ? " " + titulo : ""}*`
    );
    return;
  }

  // --- TRAVA DE CONFLITO DE HORÁRIO ---
  const conflito = await partidaService.verificarConflitoDeHorario(
    groupId,
    senderId,
    horario,
    dataPartida,
  );

  if (conflito) {
    const infoH = conflito.horario ? ` às *${conflito.horario}*` : " (sem horário definido)";
    const infoD = conflito.data_partida ? ` em *${conflito.data_partida}*` : "";
    await msg.reply(
      `🚨 Você já é titular na *${conflito.tipo ?? "Lobby"} #${conflito.numero_lobby}: ${conflito.titulo}*${infoD}${infoH}.\n\n` +
      `Para criar outra, as partidas precisam ter pelo menos *1h30* de diferença.`
    );
    return;
  }

  // --- VALIDAÇÃO DE LOBBIES ABERTAS ---
  const agora = new Date();
  const horaAtualStr =
    agora.getHours().toString().padStart(2, "0") +
    ":" +
    agora.getMinutes().toString().padStart(2, "0");
  const dataHoje = dataDeHoje();

  function horaParaMinutos(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  let textoAviso = "";
  const lobbiesAbertas = await partidaService.getPartidasAbertas(groupId);

  for (const lobby of lobbiesAbertas) {
    const numTitulares = await partidaService.contarTitulares(lobby.id);
    if (numTitulares >= lobby.max_players) continue;

    const lobbyEhFutura = lobby.data_partida && lobby.data_partida !== dataHoje;
    const horarioPassou = !lobbyEhFutura && lobby.horario
      ? horaAtualStr > lobby.horario
      : false;

    if (horarioPassou) {
      await partidaService.cancelarPartida(lobby.id);
      textoAviso = `♻️ *O ${lobby.tipo} #${lobby.numero_lobby} (${lobby.horario}) foi cancelado por inatividade.*\n\n`;
      continue;
    }

    if (!lobby.horario) {
      await msg.reply(
        `⚠️ O ${lobby.tipo} #${lobby.numero_lobby} ainda tem vagas e está sem horário definido.\n\n` +
        `Defina um horário ou entre nela antes de abrir outra:\n` +
        `*!horario HH:mm* — definir horário\n` +
        `*!eu ${lobby.numero_lobby}* — entrar na fila`
      );
      return;
    }

    const mesmoDia =
      (!dataPartida && !lobby.data_partida) ||
      (!dataPartida && lobby.data_partida === dataHoje) ||
      (dataPartida && lobby.data_partida === dataPartida);

    if (horario && mesmoDia) {
      const diferenca = Math.abs(horaParaMinutos(horario) - horaParaMinutos(lobby.horario));
      const diferencaReal = diferenca > 720 ? 1440 - diferenca : diferenca;

      if (diferencaReal < DIFERENCA_MINIMA_MIN) {
        await msg.reply(
          `⚠️ Já tem o ${lobby.tipo} #${lobby.numero_lobby} marcado para as *${lobby.horario}*.\n\n` +
          `O horário precisa ter pelo menos *1h30 de diferença*.\n` +
          `*!eu ${lobby.numero_lobby}* — para entrar nela`
        );
        return;
      }
    } else if (!horario && !lobbyEhFutura) {
      await msg.reply(
        `Ei! O ${lobby.tipo} #${lobby.numero_lobby} (${lobby.horario}) ainda tem vagas.\n` +
        `Mande *!eu ${lobby.numero_lobby}* para entrar antes de abrir outra.`
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
    dataPartida,
    tipo,
    maxPlayers,
    numeroLobby,
  });

  const partidaId = result.lastID;
  await jogadorService.adicionarJogador(partidaId, senderId, "TITULAR");

  let infoAgendamento = "";
  if (dataPartida && horario) {
    infoAgendamento = `📅 *Agendado para ${dataPartida} às ${horario}*\n`;
  }

  let texto = textoAviso + infoAgendamento;
  texto += await gerarListaTexto(partidaId, maxPlayers);
  texto += `\nMande *!eu ${numeroLobby}* para entrar!`;

  await marcarTodos(chat, texto);

  const suplentesOutras = await partidaService.getSuplentesDeOutrasPartidas(groupId, partidaId);
  if (suplentesOutras.length > 0) {
    const aviso =
      `👀 *Atenção Reservas!*\nA ${tipo} #${numeroLobby} acabou de ser criada com vagas para titulares!\n\n` +
      `Quer trocar de fila?\n*!sair* — sair da atual\n*!eu ${numeroLobby}* — entrar nessa`;
    await mencionarJogadores(chat, aviso, suplentesOutras.map((s) => s.jogador_id));
  }
}

module.exports = { criarLobby };