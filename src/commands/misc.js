const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");

async function meunick({ msg, parametro, senderId }) {
  if (!parametro) {
    const nickRow = await jogadorService.getNick(senderId);
    if (nickRow) {
      await msg.reply(
        `Seu nick atual é: *${nickRow.nome}*\n\nPara mudar, mande: *!meunick NovoNome*`,
      );
    } else {
      await msg.reply(
        "Você ainda não definiu um nick personalizado.\nComo quer ser chamado? Exemplo: *!meunick Sonzera*",
      );
    }
    return;
  }

  if (parametro.length > 15) {
    await msg.reply(
      "Nick muito grande, emocionado! Escolha um com até 15 letras.",
    );
    return;
  }

  await jogadorService.setNick(senderId, parametro);
  await msg.reply(
    `✅ Nick atualizado! A partir de agora vou te chamar de *${parametro}*.`,
  );
}

async function status({ msg, chat, groupId }) {
  const abertas = await partidaService.getPartidasAbertas(groupId);

  if (abertas.length === 0) {
    await msg.reply(
      "🟢 *Bot tá ON!*\nMas não tem nenhuma partida aberta no momento. Mande *!lobby* ou *!mix* para criar uma!",
    );
    return;
  }

  for (const partida of abertas) {
    const numTitulares = await partidaService.contarTitulares(partida.id);
    const vagasRestantes = partida.max_players - numTitulares;

    let texto = `ℹ️ *STATUS DA PARTIDA #${partida.numero_lobby}* ℹ️\n`;
    texto += `🎮 *Lobby: ${partida.titulo}*\n`;
    if (partida.horario) texto += `⏰ *Horário:* ${partida.horario}\n`;
    texto += `\n${await gerarListaTexto(partida.id, partida.max_players)}`;

    if (vagasRestantes === 0) {
      texto += `\n🔥 A lista principal tá cheia! Mas você pode mandar *!eu ${partida.numero_lobby}* pra ir pro banco de reservas.`;
    } else {
      texto += `\nRestam ${vagasRestantes} vagas! Mande *!eu ${partida.numero_lobby}* para entrar.`;
    }

    await chat.sendMessage(texto);
  }
}

async function comandos({ chat }) {
  const texto = [
    "🤖 *COMANDOS DO BOT* 🤖",
    "",
    "🎮 *Criação de Partidas:*",
    "*!lobby [hora]* - Cria fila para 5 jogadores.",
    "*!mix [hora]* - Cria um 5x5 para 10 jogadores.",
    "",
    "👤 *Interação:*",
    "*!eu* - Entra na lista.",
    "*!sair* - Sai da lista.",
    "*!status* - Mostra as listas atuais.",
    "*!nick [nome]* - Muda seu nome.",
    "*!silenciar* - Não receberá notificação.",
    "*!notificar* - Reativa a notificação.",
    "*!discord* - Consulta o discord do grupo.",
    "*!jogos* - Consulta os jogos de CS2 do dia.",
    "*!jogosbr* - Consulta os jogos de times brasileiros do dia.",
    "*!resultados* - Consulta os resultados dos jogos do dia.",
    "*!resultadosbr* - Consulta os resultados dos jogos brasileiros do dia.",
    "",
    "⚙️ *Gerenciamento:*",
    "*!horario [hora]* - Atualiza o horário.",
    "*!titulo [nome]* - Atualiza o título.",
    "*!start* - Fecha a lista e pontua titulares.",
    "*!cancelar* - Derruba a lista.",
    "*!kick [posição]* - Remove jogador ausente.",
    "*!setdiscord [link]* - Adiciona o link do Discord.",
  ].join("\n");

  await chat.sendMessage(texto);
}

async function silenciar({ msg, senderId }) {
  await jogadorService.silenciarJogador(senderId);
  await msg.reply(
    "🔕 *Notificações Desativadas!*\nVocê não será mais marcado quando uma nova lobby for criada.\nPara voltar a receber, mande *!notificar*.",
  );
}

async function notificar({ msg, senderId }) {
  await jogadorService.notificarJogador(senderId);
  await msg.reply(
    "🔔 *Notificações Ativadas!*\nVocê voltará a ser marcado nas novas lobbies. Bora pro jogo!",
  );
}

module.exports = { meunick, status, comandos, silenciar, notificar };
