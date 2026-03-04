const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");

async function entrar({ msg, chat, parametro, senderId, nome, groupId }) {
  // Regra da monogamia
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

  if (numTitulares < maxPlayers) {
    await jogadorService.adicionarJogador(partidaAlvo.id, senderId, "TITULAR");
    const vagasRestantes = maxPlayers - (numTitulares + 1);

    if (vagasRestantes === 0) {
      let textoFinal = `🔥 *${partidaAlvo.tipo} #${partidaAlvo.numero_lobby}: ${partidaAlvo.titulo} FECHADA! BORA!* 🔥\n`;
      if (partidaAlvo.horario)
        textoFinal += `⏰ *Horário:* ${partidaAlvo.horario}\n`;
      textoFinal += `\n${await gerarListaTexto(partidaAlvo.id, maxPlayers)}`;
      textoFinal += `\n🎧 Entrem no Discord!`;
      await chat.sendMessage(textoFinal);
    } else {
      let textoParcial = `🎮 *${partidaAlvo.tipo} #${partidaAlvo.numero_lobby} (PARCIAL)* 🎮\n`;
      if (partidaAlvo.horario)
        textoParcial += `⏰ *Horário:* ${partidaAlvo.horario}\n`;
      textoParcial += `\n${await gerarListaTexto(partidaAlvo.id, maxPlayers)}`;
      textoParcial += `\n${nome} entrou! Restam ${vagasRestantes} vagas.`;
      await chat.sendMessage(textoParcial);
    }
  } else {
    await jogadorService.adicionarJogador(partidaAlvo.id, senderId, "SUPLENTE");
    const suplentes = await jogadorService.getSuplentes(partidaAlvo.id);

    let textoSuplente = `⚠️ *EQUIPA CHEIA!* ⚠️\n`;
    textoSuplente += `${nome} entrou no banco de reservas (Suplente #${suplentes.length}) da partida #${partidaAlvo.numero_lobby}.\n\n`;
    textoSuplente += await gerarListaTexto(partidaAlvo.id, maxPlayers);
    await chat.sendMessage(textoSuplente);
  }
}

async function sair({ msg, chat, parametro, senderId, nome, groupId }) {
  let partidaAlvo = null;

  if (parametro) {
    const idBuscado = parseInt(parametro);
    if (isNaN(idBuscado)) {
      await msg.reply("Formato inválido. Use *!sair [numero]*.");
      return;
    }
    partidaAlvo = await partidaService.getPartidaPorLobby(groupId, idBuscado);
    if (!partidaAlvo) {
      await msg.reply(
        `Não encontrei a partida #${idBuscado} ou ela já foi fechada.`,
      );
      return;
    }
  } else {
    const partidas = await partidaService.getPartidasDoJogador(
      groupId,
      senderId,
    );
    if (partidas.length === 0) {
      await msg.reply(
        "Burro ou leigo? Você não está em nenhuma partida aberta...",
      );
      return;
    } else if (partidas.length === 1) {
      partidaAlvo = partidas[0];
    } else {
      let textoAviso = `Você está em ${partidas.length} partidas abertas! Especifique de qual quer sair:\n\n`;
      partidas.forEach((p) => {
        textoAviso += `ID #${p.numero_lobby} - ${p.titulo}\n`;
      });
      textoAviso += `\nExemplo: *!sair ${partidas[0].numero_lobby}*`;
      await msg.reply(textoAviso);
      return;
    }
  }

  const registro = await jogadorService.getRegistroJogador(
    partidaAlvo.id,
    senderId,
  );
  if (!registro) {
    await msg.reply(
      `Você não está na lista da partida #${partidaAlvo.numero_lobby}.`,
    );
    return;
  }

  await jogadorService.removerJogador(registro.id);

  if (registro.papel === "SUPLENTE") {
    await chat.sendMessage(
      `${nome} cansou de esperar e saiu dos suplentes da partida #${partidaAlvo.numero_lobby}.`,
    );
    return;
  }

  // Promove suplente se houver
  const promovidoId = await jogadorService.promoverPrimeiroSuplente(
    partidaAlvo.id,
  );
  let promovidoNome = null;
  if (promovidoId) {
    const nickSup = await jogadorService.getNick(promovidoId);
    promovidoNome = nickSup ? nickSup.nome : "Jogador";
  }

  // Passa a coroa se o criador saiu
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
    await chat.sendMessage(
      `Todo mundo arregou. A partida #${partidaAlvo.numero_lobby} foi cancelada!`,
    );
    return;
  }

  let textoSair = `🎮 *${partidaAlvo.tipo} #${partidaAlvo.numero_lobby}: ${partidaAlvo.titulo} ATUALIZADA* 🎮\n`;
  if (partidaAlvo.horario)
    textoSair += `⏰ *Horário:* ${partidaAlvo.horario}\n`;
  textoSair += `\n${await gerarListaTexto(partidaAlvo.id, partidaAlvo.max_players)}`;

  if (promovidoNome) {
    textoSair += `\n${nome} arregou.\n🔄 *${promovidoNome} subiu do banco de reservas!*`;
  } else {
    const numTitulares = await partidaService.contarTitulares(partidaAlvo.id);
    textoSair += `\n${nome} arregou. Restam ${partidaAlvo.max_players - numTitulares} vagas agora.`;
  }

  if (coroaPassou)
    textoSair += `\n👑 *A coroa passou!* ${novoAdminNome} agora é o dono da sala.`;

  await chat.sendMessage(textoSair);
}

// Helper: resolve qual partida o usuário quer entrar
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
  textoAviso += `\nExemplo: *!eu ${abertas[0].numero_lobby}*`;
  await msg.reply(textoAviso);
  return null;
}

module.exports = { entrar, sair };
