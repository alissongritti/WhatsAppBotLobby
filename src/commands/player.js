const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");
const grupoService = require("../services/grupoService");

// ─── DEBOUNCE ANTI-SPAM ───────────────────────────────────────────────────────
// Impede que o mesmo jogador dispare duas operações simultâneas (race condition).
// O bloqueio dura apenas 3 segundos — tempo suficiente para o banco responder.
const jogadoresEmOperacao = new Set();
const DEBOUNCE_MS = 3000;

function bloquearJogador(senderId) {
  if (jogadoresEmOperacao.has(senderId)) return false; // já está processando
  jogadoresEmOperacao.add(senderId);
  setTimeout(() => jogadoresEmOperacao.delete(senderId), DEBOUNCE_MS);
  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── COMANDO: !eu (ENTRAR) ────────────────────────────────────────────────────
async function entrar({ msg, chat, parametro, senderId, nome, groupId }) {
  if (!bloquearJogador(senderId)) return; // silencioso — é spam acidental
  // Regra da monogamia: jogador não pode estar em duas partidas
  const jaEstaEmLobby = await partidaService.getPartidaDoJogador(
    groupId,
    senderId,
  );
  if (jaEstaEmLobby) {
    await msg.reply(
      `🚨 Emocionado! Você já está na *Lobby #${jaEstaEmLobby.numero_lobby}: ${jaEstaEmLobby.titulo}*. Mande *!sair* dela primeiro.`,
    );
    return;
  }

  const partidaAlvo = await resolverPartidaAlvo({
    msg,
    chat,
    parametro,
    groupId,
    acao: "entrar",
  });
  if (!partidaAlvo) return;

  const numTitulares = await partidaService.contarTitulares(partidaAlvo.id);
  const maxPlayers = partidaAlvo.max_players;
  const linkDiscord = await grupoService.obterDiscord(groupId);

  if (numTitulares < maxPlayers) {
    await jogadorService.adicionarJogador(partidaAlvo.id, senderId, "TITULAR");
    const vagasRestantes = maxPlayers - (numTitulares + 1);

    // O cabeçalho (Título/Horário) já vem dentro do gerarListaTexto
    let textoFinal = await gerarListaTexto(partidaAlvo.id, maxPlayers);

    if (vagasRestantes === 0) {
      textoFinal += linkDiscord
        ? `\n🔥 *LOBBY FECHADA! BORA PRO JOGO!* 🔥`
        : `\n🔥 *LOBBY FECHADA! BORA PRO JOGO!* 🔥`;

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
    await jogadorService.adicionarJogador(partidaAlvo.id, senderId, "SUPLENTE");
    const suplentes = await jogadorService.getSuplentes(partidaAlvo.id);

    let textoSuplente = `⚠️ *FILA DE ESPERA!* ⚠️\n`;
    textoSuplente += `*${nome}* entrou no banco (Reserva #${suplentes.length}).\n\n`;
    textoSuplente += await gerarListaTexto(partidaAlvo.id, maxPlayers);
    await chat.sendMessage(textoSuplente);
  }
}

// ─── COMANDO: !sair (SAIR) ────────────────────────────────────────────────────
async function sair({ msg, chat, parametro, senderId, nome, groupId }) {
  if (!bloquearJogador(senderId)) return; // silencioso — é spam acidental
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
        textoAviso += `ID #${p.numero_lobby} - ${p.titulo}\n`;
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
    return chat.sendMessage(`🏃 *${nome}* saiu dos suplentes.`);
  }

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

  // ─── Permissão ────────────────────────────────────────────────────────────
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

  // ─── Resolver qual lobby sofre o kick ────────────────────────────────────
  // Regras:
  // - 1 lobby aberta → usa ela sempre
  // - 2+ lobbies: dono usa a sua; admin/superadmin precisa especificar com !kick [jogador] [#lobby]
  let partidaAlvo = null;

  if (abertas.length === 1) {
    // Só existe uma — mas ainda precisa ter permissão
    if (!lobbyDoSender && !temPermissao) {
      return msg.reply(
        "⛔ Sem permissão! Só o dono da lobby ou Admin do grupo.",
      );
    }
    partidaAlvo = abertas[0];
  } else {
    // Mais de uma lobby aberta
    if (lobbyDoSender) {
      // Sender é dono de uma delas — usa a dele
      partidaAlvo = lobbyDoSender;
    } else if (temPermissao) {
      // Admin/SuperAdmin sem lobby própria — exige que especifique o número da lobby
      // Tenta ler o último token do parâmetro como número de lobby: ex "2 1" = posição 2 lobby #1
      const tokens = parametro.trim().split(/\s+/);
      const lobbyNum = parseInt(tokens[tokens.length - 1]);

      if (!isNaN(lobbyNum) && tokens.length > 1) {
        partidaAlvo = abertas.find((p) => p.numero_lobby === lobbyNum) ?? null;
        if (!partidaAlvo)
          return msg.reply(
            `⚠️ Lobby #${lobbyNum} não encontrada ou não está aberta.`,
          );
        // Remove o número da lobby do parâmetro para não confundir o parser de posição/menção
        parametro = tokens.slice(0, -1).join(" ");
      } else {
        // Não especificou — lista as opções
        let aviso = `⚠️ Há ${abertas.length} lobbies abertas. Especifique qual:\n\n`;
        abertas.forEach((p) => {
          aviso += `Lobby #${p.numero_lobby} - ${p.titulo}\n`;
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

  // ─── Resolver alvo: posição (número) ou menção (@) ───────────────────────
  const titulares = await jogadorService.getTitulares(partidaAlvo.id);
  let jogadorAlvo = null;
  let posicao = null;

  const posicaoTentativa = parseInt(parametro);
  const temMencao = mentionedIds && mentionedIds.length > 0;

  if (!isNaN(posicaoTentativa)) {
    // ── Modo posição: !kick 2 ──────────────────────────────────────────────
    posicao = posicaoTentativa;
    if (posicao < 1 || posicao > partidaAlvo.max_players)
      return msg.reply(`⚠️ Posição inválida (1 a ${partidaAlvo.max_players}).`);

    jogadorAlvo = titulares[posicao - 1] ?? null;
    if (!jogadorAlvo) return msg.reply(`⚠️ A posição ${posicao} está vazia.`);
  } else if (temMencao) {
    // ── Modo menção: !kick @Fulano — usa mentionedIds do contexto ──────────
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

  // ─── Executa o kick ───────────────────────────────────────────────────────
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
  textoKick += await gerarListaTexto(partidaAlvo.id, partidaAlvo.max_players);

  if (promovidoNome) {
    textoKick += `\n🔄 *A fila andou! ${promovidoNome} subiu para o time titular!*`;
  }

  await chat.sendMessage(textoKick);
}

// ─── HELPER: resolverPartidaAlvo (LÓGICA DE BUSCA) ───────────────────────────
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
    textoAviso += `ID #${p.numero_lobby} - ${p.titulo} (${p.tipo})\n`;
  });
  textoAviso += `\nExemplo: *!${acao} ${abertas[0].numero_lobby}*`;
  await msg.reply(textoAviso);
  return null;
}

// ─── EXPORTAÇÃO ──────────────────────────────────────────────────────────────
module.exports = {
  entrar,
  sair,
  kick,
  resolverPartidaAlvo,
};