const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const statsService = require("../services/statsService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { mencionarJogadores } = require("../utils/mentions");
const { parseHorario } = require("../utils/timeParser");

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

module.exports = { start, cancelar, horario, titulo };
