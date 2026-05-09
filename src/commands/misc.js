const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { dataDeHoje } = require("../utils/timeParser");

const HORAS_AVISO_LOBBY_ANTIGA = 3;

async function meunick({ msg, parametro, senderId }) {
  if (!parametro) {
    const nickRow = await jogadorService.getNick(senderId);
    if (nickRow) {
      await msg.reply(
        `Seu nick atual é: *${nickRow.nome}*\n\nPara mudar, mande: *!nick NovoNome*`,
      );
    } else {
      await msg.reply(
        "Você ainda não definiu um nick.\nComo quer ser chamado? Exemplo: *!nick Sonzera*",
      );
    }
    return;
  }

  if (parametro.length > 15) {
    await msg.reply("Nick muito longo! Escolha um com até 15 caracteres.");
    return;
  }

  await jogadorService.setNick(senderId, parametro);
  await msg.reply(`✅ Feito! A partir de agora você é *${parametro}*.`);
}

async function status({ msg, chat, groupId }) {
  const abertas = await partidaService.getPartidasAbertas(groupId);
  const dataHoje = dataDeHoje();

  if (abertas.length === 0) {
    await msg.reply(
      "🟢 *Bot tá ON!*\nNão tem nenhuma partida aberta no momento.\nMande *!lobby* ou *!mix* para criar uma!",
    );
    return;
  }

  const agora = Date.now();
  const LIMITE_MS = HORAS_AVISO_LOBBY_ANTIGA * 60 * 60 * 1000;

  for (const partida of abertas) {
    const numTitulares = await partidaService.contarTitulares(partida.id);
    const vagasRestantes = partida.max_players - numTitulares;

    let texto = await gerarListaTexto(partida.id, partida.max_players);

    if (partida.data_partida && partida.data_partida !== dataHoje) {
      texto =
        `📅 *${partida.data_partida}` +
        (partida.horario ? ` às ${partida.horario}` : "") +
        `*\n` +
        texto;
    } else if (partida.horario) {
      texto = `⏰ *${partida.horario}*\n` + texto;
    }

    if (vagasRestantes === 0) {
      texto += `\n🔥 Lista cheia! Mande *!eu ${partida.numero_lobby}* para ir pro banco de reservas.`;
    } else {
      texto += `\n${vagasRestantes} vaga${vagasRestantes > 1 ? "s" : ""} restante${vagasRestantes > 1 ? "s" : ""}! Mande *!eu ${partida.numero_lobby}* para entrar.`;
    }

    if (!partida.horario && partida.data_criacao) {
      const dataCriacao = new Date(partida.data_criacao).getTime();
      const idadeMs = agora - dataCriacao;

      if (idadeMs >= LIMITE_MS) {
        const horas = Math.floor(idadeMs / (60 * 60 * 1000));
        texto += `\n\n⏰ *Essa lobby tá aberta há ${horas}h sem horário definido.*\nUse *!horario HH:mm* para marcar ou *!cancelar* para liberar a fila.`;
      }
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
    "*!lobby [DD/MM] [hora]* - Agenda fila para uma data futura (máx. 7 dias).",
    "*!mix [hora]* - Cria um 5x5 para 10 jogadores.",
    "*!mix [DD/MM] [hora]* - Agenda um 5x5 para uma data futura (máx. 7 dias).",
    "",
    "👤 *Interação:*",
    "*!eu* - Entra na lista.",
    "*!sair* - Sai da lista.",
    "*!status* - Mostra as listas atuais.",
    "*!nick [nome]* - Muda seu nome.",
    "*!silenciar* - Não receberá notificações.",
    "*!notificar* - Reativa as notificações.",
    "*!discord* - Consulta o discord do grupo.",
    "*!jogos* - Consulta os jogos de CS2 do dia.",
    "*!jogosbr* - Consulta os jogos de times brasileiros do dia.",
    "*!resultados* - Consulta os resultados dos jogos do dia.",
    "*!resultadosbr* - Consulta os resultados dos jogos brasileiros do dia.",
    "*!novidades* - Mostra a última atualização oficial do CS2 (Patch Notes).",
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
    "🔕 *Notificações desativadas!*\nVocê não será marcado em novas lobbies.\nPara voltar, mande *!notificar*.",
  );
}

async function notificar({ msg, senderId }) {
  await jogadorService.notificarJogador(senderId);
  await msg.reply(
    "🔔 *Notificações ativadas!*\nVocê voltará a ser marcado nas novas lobbies. Bora pro jogo!",
  );
}

module.exports = { meunick, status, comandos, silenciar, notificar };
