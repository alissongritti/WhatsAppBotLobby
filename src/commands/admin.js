const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const statsService = require("../services/statsService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { mencionarJogadores } = require("../utils/mentions");
const { parseHorario } = require("../utils/timeParser");
const grupoService = require("../services/grupoService");

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

async function cancelar({ msg, chat, senderId, groupId }) {
  const partida = await getPartidaOuErro(msg, groupId, senderId);
  if (!partida) return;

  await partidaService.cancelarPartida(partida.id);
  await chat.sendMessage(
    `🛑 *Partida #${partida.numero_lobby} cancelada pelo criador.* A fila foi resetada!`,
  );
}

async function horario({ msg, parametro, senderId, groupId, chat }) {
  if (!parametro) {
    await msg.reply(
      "⚠️ Você precisa informar o novo horário. Exemplo: *!horario 22:30*",
    );
    return;
  }

  const horarioFormatado = parseHorario(parametro);
  if (!horarioFormatado) {
    await msg.reply(
      "⚠️ Horário inválido! Use formatos como *22h*, *22:30* ou *22*.",
    );
    return;
  }

  const partida = await partidaService.getPartidaDoAdmin(groupId, senderId);
  if (!partida) {
    await msg.reply(
      "⚠️ Você não é o dono de nenhuma partida aberta para mudar o horário.",
    );
    return;
  }

  await partidaService.atualizarHorario(partida.id, horarioFormatado);

  // Busca a lista atualizada (o cabeçalho novo já vem nela)
  const listaAtualizada = await gerarListaTexto(
    partida.id,
    partida.max_players,
  );

  const titulares = await jogadorService.getTitulares(partida.id);
  const mentionsIds = titulares.map((t) => t.jogador_id);

  // Injetando a variável na mensagem para resolver o erro de "value is never read"
  await mencionarJogadores(
    chat,
    `⏰ *HORÁRIO ALTERADO PARA ${horarioFormatado}* \n\n${listaAtualizada}`,
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

  // Simplificado: gerarListaTexto já traz Título e Horário formatados no topo
  let texto = await gerarListaTexto(partida.id, partida.max_players);
  texto += `\n📝 Título atualizado pelo dono da sala.`;

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
      "⛔ Apenas os administradores do grupo podem configurar o Discord.",
    );
    return;
  }

  if (!parametro) {
    await msg.reply(
      "⚠️ Envie o link junto. Exemplo: *!setdiscord https://discord.gg/link*",
    );
    return;
  }

  const link = parametro.trim();
  if (!link.startsWith("https://")) {
    await msg.reply("⚠️ Link inválido! Precisa começar com *https://*");
    return;
  }

  await grupoService.setDiscord(groupId, link);
  await msg.reply(`✅ Link do Discord atualizado!\n\n🔗 ${link}`);
}

async function consultarDiscord({ msg, chat, groupId }) {
  if (!chat.isGroup) {
    await msg.reply("⚠️ Este comando só funciona dentro de grupos.");
    return;
  }

  const link = await grupoService.obterDiscord(groupId);
  if (!link) {
    await msg.reply("⚠️ Nenhum Discord configurado. Use !setdiscord [link]");
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
