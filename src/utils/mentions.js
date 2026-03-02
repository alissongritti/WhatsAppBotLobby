async function marcarTodos(chat, mensagem) {
  const mentionsIds = chat.participants.map((p) => p.id._serialized);
  await chat.sendMessage(`${mensagem}\n\n@todos`, { mentions: mentionsIds });
}

async function mencionarJogadores(chat, mensagem, jogadoresIds) {
  await chat.sendMessage(mensagem, { mentions: jogadoresIds });
}

module.exports = { marcarTodos, mencionarJogadores };
