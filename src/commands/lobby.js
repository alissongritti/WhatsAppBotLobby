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
  // Aceita horário no início (!lobby 12h Título) ou no fim (!lobby Título 12h)
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
      // !lobby 12h Título
      horario = horarioInicio;
      const resto = parametro.substring(primeiraPalavra.length).trim();
      if (resto) titulo = resto.toUpperCase();
    } else if (horarioFim) {
      // !lobby Título 12h
      horario = horarioFim;
      const resto = palavras.slice(0, -1).join(" ").trim();
      if (resto) titulo = resto.toUpperCase();
    } else {
      // Sem horário — tudo é título
      titulo = parametro.toUpperCase();
    }
  }

  // ─── Trava unificada: analisa cada sala aberta e decide o que fazer ─────────
  // Regras:
  // - Sala CHEIA → ignora, pode criar nova
  // - Sala INCOMPLETA + horário passou → cancela por inatividade, pode criar nova
  // - Sala INCOMPLETA sem horário → bloqueia, pede para atribuir horário
  // - Sala INCOMPLETA com horário + nova sala com horário com < 1h30 de diferença → bloqueia
  // - Sala INCOMPLETA com horário + diferença >= 1h30 → libera
  const DIFERENCA_MINIMA_MIN = 90; // 1h30 em minutos

  const agora = new Date();
  const horaAtualStr =
    agora.getHours().toString().padStart(2, "0") +
    ":" +
    agora.getMinutes().toString().padStart(2, "0");

  // Converte "HH:mm" para minutos totais para facilitar comparação
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

    if (estaCheia) {
      // Sala cheia — ignora e deixa criar a próxima
      continue;
    }

    if (horarioPassou) {
      // Sala incompleta e horário já passou — cancela por inatividade
      await partidaService.cancelarPartida(lobby.id);
      textoAviso = `♻️ *O ${lobby.tipo} #${lobby.numero_lobby} (${lobby.horario}) foi cancelado por inatividade.*\n\n`;
      continue;
    }

    if (!lobby.horario) {
      // Sala incompleta sem horário — bloqueia e pede para atribuir horário
      await msg.reply(
        `⚠️ O ${lobby.tipo} #${lobby.numero_lobby} ainda tem vagas e não tem horário definido.\n\n` +
          `Para criar outra sala, preencha as vagas ou atribua um horário:\n` +
          `*!horario HH:mm* — para definir o horário\n` +
          `*!eu ${lobby.numero_lobby}* — para entrar nela`,
      );
      return;
    }

    // Sala incompleta com horário — verifica diferença mínima de 1h30
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
      // Diferença suficiente — deixa criar
    } else {
      // Nova sala sem horário e já tem sala com horário incompleta — bloqueia
      await msg.reply(
        `Calma lá! O ${lobby.tipo} #${lobby.numero_lobby} (${lobby.horario}) ainda tem vagas para o time titular.\n` +
          `Mande *!eu ${lobby.numero_lobby}* para entrar nela antes de tentar criar outra.`,
      );
      return;
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

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
  texto += await gerarListaTexto(partidaId, maxPlayers); // O cabeçalho já vem incluso!
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
