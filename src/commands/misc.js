const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const resumoService = require("../services/resumoService"); // Adicionado o novo serviço
const { gerarListaTexto } = require("../utils/listFormatter");

const HORAS_AVISO_LOBBY_ANTIGA = 3;

const resumosPorGrupo = new Map();
const COOLDOWN_RESUMO = 60 * 60 * 1000; // 1 hora em milissegundos

async function resumo({ msg, chat, groupId }) {
  const agora = Date.now();
  const ultimoResumo = resumosPorGrupo.get(groupId) || 0;
  const tempoPassado = agora - ultimoResumo;

  // Verifica se está no período de cooldown
  if (tempoPassado < COOLDOWN_RESUMO) {
    const minutosRestantes = Math.ceil(
      (COOLDOWN_RESUMO - tempoPassado) / (60 * 1000),
    );
    return msg.reply(
      `⏳ Calma aí, fofoqueiro! O resumo tem um tempo de espera para não poluir o grupo. Tente novamente em ${minutosRestantes} minutos.`,
    );
  }

  try {
    await msg.reply("🤖 Peraí, vou ler a resenha e te conto o essencial...");

    const mensagens = await chat.fetchMessages({ limit: 80 }); // Reduzi para 80 para ser mais rápido

    if (!mensagens || mensagens.length < 5) {
      return msg.reply("Pouca conversa para um resumo.");
    }

    const textoResumo = await resumoService.gerarResumoGrupo(chat, mensagens);

    // Atualiza o tempo do último resumo com sucesso
    resumosPorGrupo.set(groupId, Date.now());

    await chat.sendMessage(`📝 *RESUMO EXPRESSO* 📝\n\n${textoResumo}`);
  } catch (error) {
    console.error("Erro !resumo:", error.message);
    await msg.reply("❌ Erro ao processar o resumo.");
  }
}

async function meunick({ msg, parametro, senderId }) {
  if (!parametro) {
    const nickRow = await jogadorService.getNick(senderId);
    if (nickRow) {
      await msg.reply(
        `Seu nick atual é: *${nickRow.nome}*\n\nPara mudar, mande: *!nick NovoNome*`,
      );
    } else {
      await msg.reply(
        "Você ainda não definiu um nick personalizado.\nComo quer ser chamado? Exemplo: *!nick Sonzera*",
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

  const agora = Date.now();
  const LIMITE_MS = HORAS_AVISO_LOBBY_ANTIGA * 60 * 60 * 1000;

  for (const partida of abertas) {
    const numTitulares = await partidaService.contarTitulares(partida.id);
    const vagasRestantes = partida.max_players - numTitulares;

    let texto = await gerarListaTexto(partida.id, partida.max_players);

    if (vagasRestantes === 0) {
      texto += `\n🔥 A lista principal tá cheia! Mas você pode mandar *!eu ${partida.numero_lobby}* pra ir pro banco de reservas.`;
    } else {
      texto += `\nRestam ${vagasRestantes} vagas! Mande *!eu ${partida.numero_lobby}* para entrar.`;
    }

    if (!partida.horario && partida.data_criacao) {
      const dataCriacao = new Date(partida.data_criacao).getTime();
      const idadeMs = agora - dataCriacao;

      if (idadeMs >= LIMITE_MS) {
        const horas = Math.floor(idadeMs / (60 * 60 * 1000));
        texto += `\n\n⏰ *Solta o shift aí, amigão!* Essa lobby tá aberta há *${horas}h* sem horário definido.\nUse *!horario HH:mm* para marcar ou *!cancelar* para liberar a fila.`;
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
    "*!mix [hora]* - Cria um 5x5 para 10 jogadores.",
    "",
    "👤 *Interação:*",
    "*!eu* - Entra na lista.",
    "*!sair* - Sai da lista.",
    "*!status* - Mostra as listas atuais.",
    "*!nick [nome]* - Muda seu nome.",
    "*!resumo* - Resumo do que aconteceu no grupo hoje.", // Comando adicionado à lista
    "*!silenciar* - Não receberá notificação.",
    "*!notificar* - Reativa a notificação.",
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
    "🔕 *Notificações Desativadas!*\nVocê não será mais marcado quando uma nova lobby for criada.\nPara voltar a receber, mande *!notificar*.",
  );
}

async function notificar({ msg, senderId }) {
  await jogadorService.notificarJogador(senderId);
  await msg.reply(
    "🔔 *Notificações Ativadas!*\nVocê voltará a ser marcado nas novas lobbies. Bora pro jogo!",
  );
}

// Exportando a nova função resumo
module.exports = { meunick, status, comandos, silenciar, notificar, resumo };
