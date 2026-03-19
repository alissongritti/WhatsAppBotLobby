const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const statsService = require("../services/statsService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { mencionarJogadores } = require("../utils/mentions");
const { parseHorario } = require("../utils/timeParser");
const grupoService = require("../services/grupoService");

const SUPER_ADMIN_ID = process.env.ADMIN_WA_ID;

async function start({ msg, chat, senderId, groupId }) {
  const partida = await partidaService.getPartidaDoAdmin(groupId, senderId);
  if (!partida) {
    await msg.reply(
      "Você não é o dono de nenhuma partida aberta no momento para dar start!",
    );
    return;
  }

  const titulares = await jogadorService.getTitulares(partida.id);
  const ids = titulares.map((t) => t.jogador_id);

  await partidaService.concluirPartida(partida.id);
  await statsService.registrarPartidaJogada(ids);

  const texto =
    `🚀 *PARTIDA INICIADA! GG!* 🚀\n\n` +
    `A Lobby #${partida.numero_lobby} (*${partida.titulo}*) foi fechada e o jogo começou!\n` +
    `O número #${partida.numero_lobby} está livre novamente.\n\n` +
    `📈 *+1 Partida contabilizada nas estatísticas dos titulares!* Boa sorte!`;

  await chat.sendMessage(texto);
}

async function cancelar({ msg, chat, parametro, senderId, groupId }) {
  const isSuperAdmin = senderId === SUPER_ADMIN_ID;
  let partida = null;

  if (parametro) {
    // Especificou número da lobby: !cancelar 2
    const numeroLobby = parseInt(parametro);
    if (isNaN(numeroLobby))
      return msg.reply(
        "⚠️ Formato inválido. Use *!cancelar* ou *!cancelar [número]*. Ex: *!cancelar 2*",
      );

    partida = await partidaService.getPartidaPorLobby(groupId, numeroLobby);
    if (!partida)
      return msg.reply(
        `⚠️ Não encontrei a lobby #${numeroLobby} ou ela já foi encerrada.`,
      );

    // Verifica permissão — só o dono ou super admin
    if (partida.criador_id !== senderId && !isSuperAdmin)
      return msg.reply(
        "⛔ Só o dono da lobby ou o super admin pode cancelar esta partida.",
      );
  } else {
    // Sem parâmetro — usa o helper normal (busca pelo criador ou super admin)
    partida = await getPartidaOuErro(msg, groupId, senderId);
    if (!partida) return;
  }

  await partidaService.cancelarPartida(partida.id);
  await chat.sendMessage(
    `🛑 *Partida #${partida.numero_lobby} cancelada.* A fila foi resetada!`,
  );
}

async function horario({ msg, parametro, senderId, groupId, chat }) {
  // 1. Verifica se o cara mandou algum parâmetro
  if (!parametro) {
    await msg.reply(
      "⚠️ Você precisa informar o novo horário. Exemplo: *!horario 22:30*",
    );
    return;
  }

  // 2. Passa o parâmetro pelo nosso tradutor rigoroso
  const horarioFormatado = parseHorario(parametro);

  // Se o tradutor retornou null, não é um horário válido. Barra a operação!
  if (!horarioFormatado) {
    await msg.reply(
      "⚠️ Horário inválido! Use formatos como *22h*, *22:30* ou *22*.",
    );
    return;
  }

  // 3. Busca a partida em que o cara é o criador (admin)
  const partida = await partidaService.getPartidaDoAdmin(groupId, senderId);
  if (!partida) {
    await msg.reply(
      "⚠️ Você não é o dono de nenhuma partida aberta no momento para mudar o horário.",
    );
    return;
  }

  // 4. Atualiza no banco de dados com o formato perfeito (HH:mm)
  await partidaService.atualizarHorario(partida.id, horarioFormatado);

  // 5. Avisa a galera que já estava na sala (Menção Cirúrgica)
  const titulares = await jogadorService.getTitulares(partida.id);
  const mentionsIds = titulares.map((t) => t.jogador_id);

  await mencionarJogadores(
    chat,
    `⏰ O horário da partida #${partida.numero_lobby} foi alterado para *${horarioFormatado}* pelo dono da sala!`,
    mentionsIds,
  );
}

async function titulo({ msg, chat, parametro, senderId, groupId }) {
  const partida = await getPartidaOuErro(msg, groupId, senderId);
  if (!partida) return;

  if (!parametro) {
    await msg.reply("Manda o título junto! Exemplo: *!titulo Lobby do Almoço*");
    return;
  }

  const novoTitulo = parametro.toUpperCase();
  await partidaService.atualizarTitulo(partida.id, novoTitulo);

  let texto = `📝 *TÍTULO ATUALIZADO* 📝\nLobby #${partida.numero_lobby}: *${novoTitulo}*\n\n`;
  if (partida.horario) texto += `⏰ *Horário:* ${partida.horario}\n\n`;
  texto += await gerarListaTexto(partida.id, partida.max_players);

  await chat.sendMessage(texto);
}

// Helper: busca partida do admin ou responde com erro
async function getPartidaOuErro(msg, groupId, senderId) {
  const partida = await partidaService.getPartidaDoAdmin(groupId, senderId);
  if (!partida) {
    await msg.reply(
      "Tá achando que é admin? Você não criou nenhuma partida aberta!",
    );
  }
  return partida;
}

async function setDiscord({ msg, chat, parametro, senderId, groupId }) {
  if (!chat.isGroup) {
    await msg.reply("⚠️ Este comando só funciona dentro de grupos.");
    return;
  }

  // Trava de Admin
  let isGroupAdmin = false;
  try {
    if (Array.isArray(chat.participants)) {
      const participant = chat.participants.find(
        (p) => p.id && p.id._serialized === senderId,
      );
      isGroupAdmin =
        participant && (participant.isAdmin || participant.isSuperAdmin);
    }
  } catch (error) {
    console.error("Erro ao ler os administradores do grupo:", error);
  }

  if (!isGroupAdmin) {
    await msg.reply(
      "⛔ Apenas os administradores do grupo podem configurar o link do Discord.",
    );
    return;
  }

  if (!parametro) {
    await msg.reply(
      "⚠️ Envie o link junto com o comando. Exemplo: *!setdiscord https://discord.gg/seulink*",
    );
    return;
  }

  const link = parametro.trim();
  await grupoService.setDiscord(groupId, link);
  await msg.reply(
    `✅ Link do Discord atualizado com sucesso para este grupo!\n\n🔗 ${link}`,
  );
}

async function consultarDiscord({ msg, chat, groupId }) {
  if (!chat.isGroup) {
    await msg.reply("⚠️ Este comando só funciona dentro de grupos.");
    return;
  }

  const link = await grupoService.obterDiscord(groupId);

  if (!link) {
    await msg.reply(
      "⚠️ Nenhum Discord configurado. Um Admin pode configurar utilizando !setdiscord [link]",
    );
    return;
  }

  await msg.reply(`🎧 *Discord da Galera:*\n${link}`);
}

module.exports = {
  start,
  cancelar,
  horario,
  titulo,
  setDiscord,
  consultarDiscord,
};
