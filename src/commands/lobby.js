const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { marcarTodos, mencionarJogadores } = require("../utils/mentions");
const {
  parseDateHorario,
  dataDeHoje,
  dataEFutura,
  diasAteData,
} = require("../utils/timeParser");
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
  let dataInformada = null;
  let titulo = isMix ? "MIX 5X5" : "LOBBY";

  // --- 1. PARSE DE PARÂMETROS ---
  // parseDateHorario varre todos os tokens, data e hora podem estar em qualquer posição
  if (parametro) {
    const { data, horario: h, tituloTokens } = parseDateHorario(parametro);

    dataInformada = data;
    horario = h || "";

    // O título é tudo que não era data nem hora
    if (tituloTokens.length > 0) {
      titulo = tituloTokens.join(" ").toUpperCase();
    }

    // Valida se a data não é retroativa
    if (dataInformada && !dataEFutura(dataInformada)) {
      await msg.reply(
        `⚠️ A data *${dataInformada}* já passou. Informe uma data válida.`,
      );
      return;
    }

    // Valida o limite de 7 dias
    if (dataInformada && diasAteData(dataInformada) > LIMITE_DIAS_AGENDAMENTO) {
      await msg.reply(
        `📅 Calma, organizadão! Só é possível agendar com até *${LIMITE_DIAS_AGENDAMENTO} dias* de antecedência.\nTente uma data mais próxima.`,
      );
      return;
    }
  }

  // --- 2. NORMALIZAÇÃO DE DATA ---
  const dataFinal = dataInformada || dataDeHoje();

  // Bloqueia criação apenas com data, sem horário definido
  if (dataInformada && !horario) {
    await msg.reply(
      `⚠️ Você informou a data *${dataInformada}* mas esqueceu o horário.\n` +
        `Exemplo: *${comando} ${dataInformada} 20h${titulo !== (isMix ? "MIX 5X5" : "LOBBY") ? " " + titulo : ""}*`,
    );
    return;
  }

  // --- 3. TRAVA DE CONFLITO DE HORÁRIO ---
  const conflito = await partidaService.verificarConflitoDeHorario(
    groupId,
    senderId,
    horario,
    dataFinal,
  );

  if (conflito) {
    const infoH = conflito.horario
      ? ` às *${conflito.horario}*`
      : " (sem horário definido)";
    const infoD = conflito.data_partida ? ` em *${conflito.data_partida}*` : "";
    await msg.reply(
      `🚨 Você já é titular na *${conflito.tipo ?? "Lobby"} #${conflito.numero_lobby}: ${conflito.titulo}*${infoD}${infoH}.\n\n` +
        `Para criar outra, as partidas precisam ter pelo menos *1h30* de diferença.`,
    );
    return;
  }

  // --- 4. VALIDAÇÃO DE LOBBIES ABERTAS NO GRUPO ---
  const agora = new Date();
  const horaAtualStr =
    agora.getHours().toString().padStart(2, "0") +
    ":" +
    agora.getMinutes().toString().padStart(2, "0");
  const hojeStr = dataDeHoje();

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

    const lobbyEhFutura = lobby.data_partida && lobby.data_partida !== hojeStr;
    const horarioPassou =
      !lobbyEhFutura && lobby.horario ? horaAtualStr > lobby.horario : false;

    if (horarioPassou) {
      await partidaService.cancelarPartida(lobby.id);
      textoAviso = `♻️ *O ${lobby.tipo} #${lobby.numero_lobby} (${lobby.horario}) foi cancelado por inatividade.*\n\n`;
      continue;
    }

    if (!lobby.horario && lobby.data_partida === dataFinal) {
      await msg.reply(
        `⚠️ O ${lobby.tipo} #${lobby.numero_lobby} ainda tem vagas e está sem horário definido.\n\n` +
          `Defina um horário ou entre nela antes de abrir outra:\n` +
          `*!horario HH:mm*\n*!eu ${lobby.numero_lobby}*`,
      );
      return;
    }

    if (horario && dataFinal === lobby.data_partida) {
      const diferenca = Math.abs(
        horaParaMinutos(horario) - horaParaMinutos(lobby.horario),
      );
      const diferencaReal = diferenca > 720 ? 1440 - diferenca : diferenca;

      if (diferencaReal < DIFERENCA_MINIMA_MIN) {
        await msg.reply(
          `⚠️ Já tem o ${lobby.tipo} #${lobby.numero_lobby} marcado para as *${lobby.horario}*.\n\n` +
            `O horário precisa ter pelo menos *1h30 de diferença*.\n` +
            `*!eu ${lobby.numero_lobby}* — para entrar nela`,
        );
        return;
      }
    }
  }

  // --- 5. CRIAÇÃO DA PARTIDA ---
  const maxPlayers = isMix ? 10 : 5;
  const tipo = isMix ? "MIX" : "LOBBY";
  const numeroLobby = await partidaService.gerarNumeroLobbyDisponivel(groupId);

  const result = await partidaService.criarPartida({
    groupId,
    senderId,
    titulo,
    horario,
    dataPartida: dataFinal,
    tipo,
    maxPlayers,
    numeroLobby,
  });

  const partidaId = result.lastID;
  await jogadorService.adicionarJogador(partidaId, senderId, "TITULAR");

  // --- 6. FORMATAÇÃO DA MENSAGEM FINAL ---
  let infoAgendamento = "";
  if (dataFinal !== hojeStr) {
    infoAgendamento = `📅 *Agendado para ${dataFinal}${horario ? " às " + horario : ""}*\n`;
  } else if (horario) {
    infoAgendamento = `⏰ *Horário: ${horario}*\n`;
  }

  let texto = textoAviso + infoAgendamento;
  texto += await gerarListaTexto(partidaId, maxPlayers, hojeStr);
  texto += `\nMande *!eu ${numeroLobby}* para entrar!`;

  await marcarTodos(chat, texto);

  const suplentesOutras = await partidaService.getSuplentesDeOutrasPartidas(
    groupId,
    partidaId,
  );
  if (suplentesOutras.length > 0) {
    const aviso =
      `👀 *Atenção Reservas!*\nA ${tipo} #${numeroLobby} acabou de ser criada com vagas para titulares!\n\n` +
      `Quer trocar de fila?\n*!sair* — sair da atual\n*!eu ${numeroLobby}* — entrar nessa`;
    await mencionarJogadores(
      chat,
      aviso,
      suplentesOutras.map((s) => s.jogador_id),
    );
  }
}

module.exports = { criarLobby };