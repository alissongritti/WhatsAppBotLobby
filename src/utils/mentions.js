const jogadorService = require("../services/jogadorService");

async function marcarTodos(chat, mensagem) {
  // 1. Pega o ID de absolutamente todo mundo que está no grupo
  const todosIds = chat.participants.map((p) => p.id._serialized);

  // 2. Puxa do banco de dados a "lista negra" de quem deu !silenciar
  const silenciados = await jogadorService.getSilenciados();

  // 3. Filtra a lista: só mantém quem NÃO está na lista de silenciados
  const mentionsIds = todosIds.filter((id) => !silenciados.includes(id));

  // 4. Envia a mensagem. O texto vai com "@todos" escrito, mas o WhatsApp 
  // só vai apitar/notificar os IDs que sobraram na array 'mentionsIds'
  await chat.sendMessage(`${mensagem}\n\n@todos`, { mentions: mentionsIds });
}

async function mencionarJogadores(chat, mensagem, jogadoresIds) {
  // Essa aqui é a função cirúrgica (usada pra chamar suplentes ou confirmar horário)
  await chat.sendMessage(mensagem, { mentions: jogadoresIds });
}

module.exports = { marcarTodos, mencionarJogadores };