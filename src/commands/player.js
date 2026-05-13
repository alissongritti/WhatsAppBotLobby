const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const statsService = require("../services/statsService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { dataDeHoje } = require("../utils/timeParser");
const grupoService = require("../services/grupoService");

// ─── DEBOUNCE ANTI-SPAM ───────────────────────────────────────────────────────
const jogadoresEmOperacao = new Set();
const DEBOUNCE_MS = 3000;

const MAX_SUPLENTES = 5;

function bloquearJogador(senderId) {
  if (jogadoresEmOperacao.has(senderId)) return false;
  jogadoresEmOperacao.add(senderId);
  setTimeout(() => jogadoresEmOperacao.delete(senderId), DEBOUNCE_MS);
  return true;
}

// ─── COMANDO: !eu (ENTRAR) ────────────────────────────────────────────────────
async function entrar({ msg, chat, parametro, senderId, nome, groupId }) {
  if (!bloquearJogador(senderId)) return;

  const partidaAlvo = await resolverPartidaAlvo({
    msg,
    chat,
    parametro,
    groupId,
    acao: "entrar",
  });
  if (!partidaAlvo) return;

  // Trava de duplicidade
  const jaEstaInscrito = await jogadorService.getRegistroJogador(
    partidaAlvo.id,
    senderId,
  );
  if (jaEstaInscrito) {
    return msg.reply(
      `⚠️ CALMÔ MULA! Você já está na *Lobby #${partidaAlvo.numero_lobby}* como *${jaEstaInscrito.papel}*!`,
    );
  }

  const conflito = await partidaService.verificarConflitoDeHorario(
    groupId,
    senderId,
    partidaAlvo.horario,
    partidaAlvo.data_partida,
  );

  if (conflito) {
    const infoHorario = conflito.horario
      ? ` às *${conflito.horario}*`
      : " (sem horário)";
    const infoData = conflito.data_partida
      ? ` em *${conflito.data_partida}*`
      : "";
    await msg.reply(
      `🚨 Conflito de agenda, emocionado!\n` +
        `Você já é titular na *Lobby #${conflito.numero_lobby}: ${conflito.titulo}*${infoData}${infoHorario}.\n\n` +
        `As partidas precisam ter pelo menos *1h30* de diferença.`,
    );
    return;
  }

  const numTitulares = await partidaService.contarTitulares(partidaAlvo.id);
  const maxPlayers = partidaAlvo.max_players;
  const linkDiscord = await grupoService.obterDiscord(groupId);
  const dataHoje = dataDeHoje();

  if (numTitulares < maxPlayers) {
    await jogadorService.adicionarJogador(partidaAlvo.id, senderId, "TITULAR");
    const vagasRestantes = maxPlayers - (numTitulares + 1);

    let textoFinal = await gerarListaTexto(
      partidaAlvo.id,
      maxPlayers,
      dataHoje,
    );

    if (vagasRestantes === 0) {
      textoFinal += `\n🔥 *LOBBY FECHADA! BORA PRO JOGO!* 🔥`;
      if (partidaAlvo.horario) {
        textoFinal += `\n⏰ Te espero no server às *${partidaAlvo.horario}*!`;
      }
      if (linkDiscord) {
        textoFinal += `\n🎧 Bora para o discord - ${linkDiscord}`;
      }
    } else {
      textoFinal += `\n✅ *${nome}* entrou! Restam *${vagasRestantes}* vagas.`;
    }

    await chat.sendMessage(textoFinal);
  } else {
    // Trava de limite de suplentes
    const suplentes = await jogadorService.getSuplentes(partidaAlvo.id);
    if (suplentes.length >= MAX_SUPLENTES) {
      return msg.reply(
        `⚠️ O banco de reservas da *Lobby #${partidaAlvo.numero_lobby}* já está cheio (${MAX_SUPLENTES}/${MAX_SUPLENTES}).\n` +
          `Aguarde uma vaga ou crie uma nova lobby!`,
      );
    }

    await jogadorService.adicionarJogador(partidaAlvo.id, senderId, "SUPLENTE");
    const suplentesAtualizados = await jogadorService.getSuplentes(
      partidaAlvo.id,
    );

    let textoSuplente = `⚠️ *FILA DE ESPERA!* ⚠️\n`;
    textoSuplente += `*${nome}* entrou no banco (Reserva #${suplentesAtualizados.length}).\n\n`;
    textoSuplente += await gerarListaTexto(
      partidaAlvo.id,
      maxPlayers,
      dataHoje,
    );
    await chat.sendMessage(textoSuplente);
  }
}

// ─── COMANDO: !sair (SAIR) ────────────────────────────────────────────────────
async function sair({ msg, chat, parametro, senderId, nome, groupId }) {
  if (!bloquearJogador(senderId)) return;
  let partidaAlvo = null;

  if (parametro) {
    const idBuscado = parseInt(parametro);
    if (isNaN(idBuscado))
      return msg.reply("Formato inválido. Use *!sair [numero]*.");

    partidaAlvo = await partidaService.getPartidaPorLobby(groupId, idBuscado);
    if (!partidaAlvo)
      return msg.reply(`Não encontrei a partida #${idBuscado} ou já fechou.`);
  } else {
    const partidas = await partidaService.getPartidasDoJogador(
      groupId,
      senderId,
    );
    if (partidas.length === 0)
      return msg.reply("Burro ou leigo? Você não está em nenhuma partida...");
    if (partidas.length === 1) {
      partidaAlvo = partidas[0];
    } else {
      let textoAviso = `Você está em ${partidas.length} partidas! Especifique qual:\n\n`;
      partidas.forEach((p) => {
        const infoData = p.data_partida ? ` 📅 ${p.data_partida}` : "";
        const infoHora = p.horario ? ` às ${p.horario}` : "";
        textoAviso += `ID #${p.numero_lobby} - ${p.titulo}${infoData}${infoHora}\n`;
      });
      return msg.reply(textoAviso);
    }
  }

  const registro = await jogadorService.getRegistroJogador(
    partidaAlvo.id,
    senderId,
  );
  if (!registro)
    return msg.reply(
      `Você não está na lista da partida #${partidaAlvo.numero_lobby}.`,
    );

  await jogadorService.removerJogador(registro.id);

  if (registro.papel === "SUPLENTE") {
    return chat.sendMessage(
      `🏃 *${nome}* saiu dos suplentes da *Lobby #${partidaAlvo.numero_lobby}: ${partidaAlvo.titulo}*.`,
    );
  }

  // ─── CÁLCULO DA PENALIDADE DE ARREGÃO (Regra de 1 Hora) ──────────────────
  const titularesRestantes = await partidaService.contarTitulares(
    partidaAlvo.id,
  );

  if (partidaAlvo.horario) {
    const agora = new Date();
    const dataRef = partidaAlvo.data_partida || dataDeHoje();
    const [dia, mes] = dataRef.split("/").map(Number);
    const [hora, min] = partidaAlvo.horario.split(":").map(Number);

    const ano = agora.getFullYear() + (mes < agora.getMonth() + 1 ? 1 : 0);
    const dataPartida = new Date(ano, mes - 1, dia, hora, min);

    const diffMs = dataPartida - agora;
    const umaHoraMs = 60 * 60 * 1000;
    const metadeCheia =
      titularesRestantes >= Math.ceil(partidaAlvo.max_players / 2);

    if (diffMs < 0) {
      console.log(
        `[STATS] ${nome} saiu, mas o horário (${partidaAlvo.horario}) já passou. Sem penalidade.`,
      );
    } else if (diffMs < umaHoraMs && metadeCheia) {
      await statsService.registrarArregada(senderId);
      console.log(
        `[STATS] Arregada registrada: ${nome} saiu faltando ${Math.floor(diffMs / 60000)} min.`,
      );
    } else {
      console.log(
        `[STATS] ${nome} saiu com antecedência segura (>1h). Sem penalidade.`,
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const promovidoId = await jogadorService.promoverPrimeiroSuplente(
    partidaAlvo.id,
  );
  let promovidoNome = null;
  if (promovidoId) {
    const nickSup = await jogadorService.getNick(promovidoId);
    promovidoNome = nickSup ? nickSup.nome : "Jogador";
  }

  let coroaPassou = false;
  let novoAdminNome = "";
  if (partidaAlvo.criador_id === senderId) {
    const novoPrimeiro = await jogadorService.getProximoTitular(partidaAlvo.id);
    if (novoPrimeiro) {
      await jogadorService.passarCoroa(partidaAlvo.id, novoPrimeiro.jogador_id);
      coroaPassou = true;
      const nickAdmin = await jogadorService.getNick(novoPrimeiro.jogador_id);
      novoAdminNome = nickAdmin ? nickAdmin.nome : "Jogador";
    }
  }

  const temAlguem = await jogadorService.temAlguemNaPartida(partidaAlvo.id);
  if (!temAlguem) {
    await partidaService.cancelarPartida(partidaAlvo.id);
    return chat.sendMessage(
      `💀 Todo mundo arregou. A partida #${partidaAlvo.numero_lobby} foi cancelada!`,
    );
  }

  let textoSair = await gerarListaTexto(
    partidaAlvo.id,
    partidaAlvo.max_players,
    dataDeHoje(),
  );

  if (promovidoNome) {
    textoSair += `\n🏃 *${nome}* arregou.\n🔄 *${promovidoNome}* subiu para o time titular!`;
  } else {
    const numTitulares = await partidaService.contarTitulares(partidaAlvo.id);
    textoSair += `\n🏃 *${nome}* arregou. Restam *${partidaAlvo.max_players - numTitulares}* vagas.`;
  }

  if (coroaPassou)
    textoSair += `\n👑 *Nova gerência!* ${novoAdminNome} agora é o dono da sala.`;

  await chat.sendMessage(textoSair);
}

// ─── COMANDO: !kick (REMOVER) ─────────────────────────────────────────────────
async function kick({ msg, chat, parametro, senderId, groupId, mentionedIds }) {
  if (!parametro)
    return msg.reply(
      "⚠️ Use *!kick [posição]* ou *!kick @jogador*\nExemplos: *!kick 2* ou *!kick @Fulano*",
    );

  const abertas = await partidaService.getPartidasAbertas(groupId);
  if (abertas.length === 0) return msg.reply("❌ Nenhuma lobby aberta.");

  const isSuperAdmin = senderId === process.env.ADMIN_WA_ID;
  let isGroupAdmin = false;
  try {
    const participant = chat.participants.find(
      (p) => p.id._serialized === senderId,
    );
    isGroupAdmin =
      participant && (participant.isAdmin || participant.isSuperAdmin);
  } catch (e) {}

  const temPermissao = isSuperAdmin || isGroupAdmin;
  const lobbyDoSender = abertas.find((p) => p.criador_id === senderId);

  let partidaAlvo = null;

  if (abertas.length === 1) {
    if (!lobbyDoSender && !temPermissao) {
      return msg.reply(
        "⛔ Sem permissão! Só o dono da lobby ou Admin do grupo.",
      );
    }
    partidaAlvo = abertas[0];
  } else {
    if (lobbyDoSender) {
      partidaAlvo = lobbyDoSender;
    } else if (temPermissao) {
      const tokens = parametro.trim().split(/\s+/);
      const lobbyNum = parseInt(tokens[tokens.length - 1]);

      if (!isNaN(lobbyNum) && tokens.length > 1) {
        partidaAlvo = abertas.find((p) => p.numero_lobby === lobbyNum) ?? null;
        if (!partidaAlvo)
          return msg.reply(
            `⚠️ Lobby #${lobbyNum} não encontrada ou não está aberta.`,
          );
        parametro = tokens.slice(0, -1).join(" ");
      } else {
        let aviso = `⚠️ Há ${abertas.length} lobbies abertas. Especifique qual:\n\n`;
        abertas.forEach((p) => {
          const infoData = p.data_partida ? ` 📅 ${p.data_partida}` : "";
          const infoHora = p.horario ? ` às ${p.horario}` : "";
          aviso += `Lobby #${p.numero_lobby} - ${p.titulo}${infoData}${infoHora}\n`;
        });
        aviso += `\nExemplo: *!kick 2 ${abertas[0].numero_lobby}* ou *!kick @Fulano ${abertas[0].numero_lobby}*`;
        return msg.reply(aviso);
      }
    } else {
      return msg.reply(
        "⛔ Sem permissão! Só o dono da lobby ou Admin do grupo.",
      );
    }
  }

  const titulares = await jogadorService.getTitulares(partidaAlvo.id);
  let jogadorAlvo = null;
  let posicao = null;

  const posicaoTentativa = parseInt(parametro);
  const temMencao = mentionedIds && mentionedIds.length > 0;

  if (!isNaN(posicaoTentativa)) {
    posicao = posicaoTentativa;
    if (posicao < 1 || posicao > partidaAlvo.max_players)
      return msg.reply(`⚠️ Posição inválida (1 a ${partidaAlvo.max_players}).`);

    jogadorAlvo = titulares[posicao - 1] ?? null;
    if (!jogadorAlvo) return msg.reply(`⚠️ A posição ${posicao} está vazia.`);
  } else if (temMencao) {
    const mencionadoId = mentionedIds[0];
    jogadorAlvo = titulares.find((t) => t.jogador_id === mencionadoId) ?? null;
    if (!jogadorAlvo)
      return msg.reply(
        "⚠️ Esse jogador não está na lista de titulares desta lobby.",
      );
  } else {
    return msg.reply(
      "⚠️ Formato inválido. Use *!kick 2* (posição) ou *!kick @Fulano* (menção).",
    );
  }

  if (jogadorAlvo.jogador_id === senderId)
    return msg.reply("Usa o comando *!sair* para sair da lista.");

  await jogadorService.removerJogadorPartida(
    partidaAlvo.id,
    jogadorAlvo.jogador_id,
  );

  const temAlguem = await jogadorService.temAlguemNaPartida(partidaAlvo.id);
  if (!temAlguem) {
    await partidaService.cancelarPartida(partidaAlvo.id);
    return chat.sendMessage(
      `👢 Lobby #${partidaAlvo.numero_lobby} cancelada após o kick.`,
    );
  }

  const nickKickado = await jogadorService.getNick(jogadorAlvo.jogador_id);
  const nomeKickado = nickKickado ? nickKickado.nome : "Jogador";

  const promovidoId = await jogadorService.promoverPrimeiroSuplente(
    partidaAlvo.id,
  );
  let promovidoNome = null;
  if (promovidoId) {
    const nickSup = await jogadorService.getNick(promovidoId);
    promovidoNome = nickSup ? nickSup.nome : "Jogador";
  }

  let textoKick = `👢 *KICK EFETUADO!* 👢\n`;
  textoKick += posicao
    ? `*${nomeKickado}* foi removido da posição ${posicao}.\n\n`
    : `*${nomeKickado}* foi removido da lobby.\n\n`;
  textoKick += await gerarListaTexto(
    partidaAlvo.id,
    partidaAlvo.max_players,
    dataDeHoje(),
  );

  if (promovidoNome) {
    textoKick += `\n🔄 *A fila andou! ${promovidoNome} subiu para o time titular!*`;
  }

  await chat.sendMessage(textoKick);
}

// ─── HELPER: resolverPartidaAlvo ─────────────────────────────────────────────
async function resolverPartidaAlvo({ msg, parametro, groupId, acao }) {
  if (parametro) {
    const idBuscado = parseInt(parametro);
    if (isNaN(idBuscado)) {
      await msg.reply(`Formato inválido. Usa *!${acao} [numero]*.`);
      return null;
    }
    const partida = await partidaService.getPartidaPorLobby(groupId, idBuscado);
    if (!partida) {
      await msg.reply(
        `Não encontrei nenhuma partida aberta com o ID #${idBuscado} neste grupo.`,
      );
      return null;
    }
    return partida;
  }

  const abertas = await partidaService.getPartidasAbertas(groupId);
  if (abertas.length === 0) {
    await msg.reply(
      "Nenhuma partida aberta no momento. Envia *!lobby* ou *!mix* para criar uma!",
    );
    return null;
  }
  if (abertas.length === 1) return abertas[0];

  let textoAviso = `Temos ${abertas.length} partidas abertas! Especifica em qual queres entrar:\n\n`;
  abertas.forEach((p) => {
    const infoData = p.data_partida ? ` 📅 ${p.data_partida}` : "";
    const infoHora = p.horario ? ` às ${p.horario}` : "";
    textoAviso += `ID #${p.numero_lobby} - ${p.titulo} (${p.tipo})${infoData}${infoHora}\n`;
  });
  textoAviso += `\nExemplo: *!${acao} ${abertas[0].numero_lobby}*`;
  await msg.reply(textoAviso);
  return null;
}

module.exports = { entrar, sair, kick, resolverPartidaAlvo };