const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");
const grupoService = require("../services/grupoService");

// ─── COMANDO: !eu (ENTRAR) ────────────────────────────────────────────────────
async function entrar({ msg, chat, parametro, senderId, nome, groupId }) {
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
      textoFinal += `\n🔥 *LOBBY FECHADA! BORA PRO JOGO!* 🔥`;
      textoFinal += linkDiscord
        ? `\n🎧 Bora para o discord - ${linkDiscord}`
        : `\n🎧 Bora para o discord - (Admins: usem !setdiscord para configurar)`;
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
async function kick({ msg, chat, parametro, senderId, groupId }) {
  if (!parametro) return msg.reply("⚠️ Use *!kick [posição]* (ex: !kick 2)");

  const posicao = parseInt(parametro);
  const abertas = await partidaService.getPartidasAbertas(groupId);
  if (abertas.length === 0) return msg.reply("❌ Nenhuma lobby aberta.");

  let partidaAlvo =
    abertas.length === 1
      ? abertas[0]
      : abertas.find((p) => p.criador_id === senderId);

  let isGroupAdmin = false;
  try {
    const participant = chat.participants.find(
      (p) => p.id._serialized === senderId,
    );
    isGroupAdmin =
      participant && (participant.isAdmin || participant.isSuperAdmin);
  } catch (e) {}

  if (!partidaAlvo && isGroupAdmin) partidaAlvo = abertas[0];
  if (!partidaAlvo || (!isGroupAdmin && partidaAlvo.criador_id !== senderId)) {
    return msg.reply("⛔ Sem permissão! Só o dono da lobby ou Admin do grupo.");
  }

  if (posicao > partidaAlvo.max_players)
    return msg.reply(`⚠️ Vaga inválida (Max: ${partidaAlvo.max_players}).`);

  const titulares = await jogadorService.getTitulares(partidaAlvo.id);
  const jogadorAlvo = titulares[posicao - 1];

  if (!jogadorAlvo) return msg.reply(`⚠️ A vaga ${posicao} está vazia.`);
  if (jogadorAlvo.jogador_id === senderId)
    return msg.reply("Usa o comando *!sair*.");

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
  textoKick += `*${nomeKickado}* foi removido da posição ${posicao}.\n\n`;
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
