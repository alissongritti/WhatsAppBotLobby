const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { marcarTodos, mencionarJogadores } = require("../utils/mentions");
const {
  parseDateHorario,
  dataDeHoje,
  dataEFutura,
} = require("../utils/timeParser");
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
  let dataPartida = null; // "DD/MM" ou null
  let titulo = isMix ? "MIX 5X5" : "LOBBY";

  if (parametro) {
    const palavras = parametro.split(" ");

    // Tenta parsear data e/ou horário nos primeiros tokens
    const {
      data,
      horario: h,
      tokensConsumidos,
    } = parseDateHorario(palavras[0], palavras[1]);

    if (tokensConsumidos > 0) {
      dataPartida = data;
      horario = h || "";

      // Valida se a data é futura (ou hoje)
      if (dataPartida && !dataEFutura(dataPartida)) {
        await msg.reply(
          `⚠️ A data *${dataPartida}* já passou. Informe uma data futura ou de hoje.`,
        );
        return;
      }

      // O restante dos tokens é o título
      const restoTokens = palavras.slice(tokensConsumidos).join(" ").trim();
      if (restoTokens) titulo = restoTokens.toUpperCase();
    } else {
      // Nenhum token era data/hora — tudo é título
      titulo = parametro.toUpperCase();
    }
  }

  // Se tem data mas não tem horário, exige horário
  if (dataPartida && !horario) {
    await msg.reply(
      `⚠️ Você informou a data *${dataPartida}* mas esqueceu o horário.\n` +
        `Exemplo: *${comando} ${dataPartida} 20h ${titulo !== (isMix ? "MIX 5X5" : "LOBBY") ? titulo : ""}*`.trim(),
    );
    return;
  }

  // ─── TRAVA DE CONFLITO DE HORÁRIO ──────────────────────────────────────────
  const conflito = await partidaService.verificarConflitoDeHorario(
    groupId,
    senderId,
    horario,
    dataPartida,
  );

  if (conflito) {
    const infoH = conflito.horario
      ? ` às *${conflito.horario}*`
      : " (sem horário)";
    const infoD = conflito.data_partida
      ? ` no dia *${conflito.data_partida}*`
      : "";
    await msg.reply(
      `🚨 Emocionado! Você já é titular na *Lobby #${conflito.numero_lobby}: ${conflito.titulo}*${infoD}${infoH}.\n\n` +
        `Para criar outra, as partidas precisam ter pelo menos *1h30* de diferença.`,
    );
    return;
  }
  // ───────────────────────────────────────────────────────────────────────────

  const DIFERENCA_MINIMA_MIN = 90;
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
    const estaCheia = numTitulares >= lobby.max_players;

    // Lobby com data futura nunca é cancelada aqui
    const lobbyEhFutura = lobby.data_partida && lobby.data_partida !== dataHoje;
    const horarioPassou =
      !lobbyEhFutura && lobby.horario ? horaAtualStr > lobby.horario : false;

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

    // Só verifica conflito de horário se as datas forem iguais (ou ambas sem data)
    const mesmoDia =
      (!dataPartida && !lobby.data_partida) ||
      (!dataPartida && lobby.data_partida === dataHoje) ||
      (dataPartida && lobby.data_partida === dataPartida) ||
      (!dataPartida && !lobby.data_partida);

    if (horario && mesmoDia) {
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
    } else if (!horario && !lobbyEhFutura) {
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
    dataPartida,
    tipo,
    maxPlayers,
    numeroLobby,
  });

  const partidaId = result.lastID;
  await jogadorService.adicionarJogador(partidaId, senderId, "TITULAR");

  // Monta prefixo de data/hora para exibição
  let infoAgendamento = "";
  if (dataPartida && horario) {
    infoAgendamento = `📅 Agendado para *${dataPartida}* às *${horario}*\n`;
  }

  let texto = textoAviso + infoAgendamento;
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
