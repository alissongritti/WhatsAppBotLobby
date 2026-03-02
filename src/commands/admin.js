const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const statsService = require("../services/statsService");
const { gerarListaTexto } = require("../utils/listFormatter");

async function start({ msg, chat, senderId, groupId }) {
  const partida = await partidaService.getPartidaDoAdmin(groupId, senderId);
  if (!partida) {
    await msg.reply("Você não é o dono de nenhuma partida aberta no momento para dar start!");
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
    `🛑 *Partida #${partida.numero_lobby} cancelada pelo criador.* A fila foi resetada!`
  );
}

async function horario({ msg, chat, parametro, senderId, groupId }) {
  const partida = await getPartidaOuErro(msg, groupId, senderId);
  if (!partida) return;

  if (!parametro) {
    await msg.reply("Esqueceu o horário! Exemplo: *!horario 22h*");
    return;
  }

  await partidaService.atualizarHorario(partida.id, parametro);

  let texto = `⏳ *HORÁRIO ALTERADO PARA ${parametro} (Lobby #${partida.numero_lobby})* ⏳\n\n`;
  texto += await gerarListaTexto(partida.id, partida.max_players);
  texto += `\n⚠️ Se você NÃO puder mais jogar, mande *!sair* para dar a vaga ao suplente!`;

  const jogadores = await jogadorService.getTitulares(partida.id);
  const mentionsIds = jogadores.map((j) => j.jogador_id);
  const tagsTexto = mentionsIds.map((id) => `@${id.split("@")[0]}`).join(" ");

  await chat.sendMessage(texto);
  await chat.sendMessage(`Por favor, confirmem: ${tagsTexto}`, { mentions: mentionsIds });
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
    await msg.reply("Tá achando que é admin? Você não criou nenhuma partida aberta!");
  }
  return partida;
}

module.exports = { start, cancelar, horario, titulo };
