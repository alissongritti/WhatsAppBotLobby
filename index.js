require("dotenv").config(); // Puxa as variáveis do .env ANTES de tudo
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs"); 

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox"],
  },
});

let sessoes = {};

// Carrega os nicks salvos ou cria um objeto vazio se for a primeira vez
let nicks = {};
if (fs.existsSync("./nicks.json")) {
  nicks = JSON.parse(fs.readFileSync("./nicks.json", "utf8"));
}

// Função auxiliar para renderizar a lista titular e os suplentes
function gerarListaTexto(sessao) {
  let textoLista = "";
  for (let i = 0; i < sessao.maxPlayers; i++) {
    let jogador = sessao.jogadores[i];
    textoLista += `${i + 1}. ${jogador ? jogador.nome : ""}\n`;
  }

  // Adiciona os suplentes embaixo, se houver
  if (sessao.suplentes && sessao.suplentes.length > 0) {
    textoLista += `\n🔄 *SUPLENTES:*\n`;
    sessao.suplentes.forEach((sup, index) => {
      textoLista += `S${index + 1}. ${sup.nome}\n`;
    });
  }
  return textoLista;
}

// Função unificada com Ghost Mention (@todos invisível por baixo dos panos)
async function marcarTodos(chat, mensagemInicial) {
  let mentionsIds = chat.participants.map((p) => p.id._serialized);
  await chat.sendMessage(`${mensagemInicial}\n\n@todos`, {
    mentions: mentionsIds,
  });
}

client.on("qr", (qr) => {
  console.log("Escaneie o QR Code abaixo com seu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Bot tá ON e pronto pro jogo!");
});

client.on("message_create", async (msg) => {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    const contact = await msg.getContact();
    const senderId = contact.id._serialized;

    // A MÁGICA: Puxa o nick salvo ou usa o do Whats
    const nome = nicks[senderId] || contact.pushname || contact.number;

    const textoMensagem = msg.body.toLowerCase().trim();
    const groupId = chat.id._serialized;

    let comando = textoMensagem;
    let parametro = "";

    // INTERCEPTAÇÃO DE COMANDOS COM PARÂMETROS (COM SUPORTE A VARIAÇÕES/ERROS)
    if (textoMensagem.startsWith("!lobby")) {
      comando = "!lobby";
      parametro = textoMensagem.replace("!lobby", "").trim();
    } else if (textoMensagem === "!status") {
      comando = "!status";
    } else if (textoMensagem.startsWith("!mix")) {
      comando = "!mix";
      parametro = textoMensagem.replace("!mix", "").trim();
    }
    // Aceita variações de horário
    else if (
      textoMensagem.startsWith("!horario") ||
      textoMensagem.startsWith("!horário") ||
      textoMensagem.startsWith("!horas") ||
      textoMensagem.startsWith("!hrs")
    ) {
      comando = "!horario"; // Normaliza para o resto do código entender
      // Descobre qual das variações o usuário digitou para cortar certinho
      let aliasUsado = ["!horário", "!horario", "!horas", "!hrs"].find((c) =>
        textoMensagem.startsWith(c),
      );
      parametro = textoMensagem.replace(aliasUsado, "").trim();
    }
    // Aceita variações de título
    else if (
      textoMensagem.startsWith("!titulo") ||
      textoMensagem.startsWith("!título")
    ) {
      comando = "!titulo"; // Normaliza
      let aliasUsado = ["!título", "!titulo"].find((c) =>
        textoMensagem.startsWith(c),
      );
      // Preserva a formatação original (maiúsculas/minúsculas) cortando o tamanho exato do alias
      parametro = msg.body.substring(aliasUsado.length).trim();
    }
    // COMANDO DE NICK
    else if (textoMensagem.startsWith("!meunick")) {
      comando = "!meunick";
      parametro = msg.body.substring(8).trim();
    }

    // ==========================================
    // COMANDO: DEFINIR NICK PERSONALIZADO (!meunick)
    // ==========================================
    if (comando === "!meunick") {
      if (!parametro) {
        await msg.reply("Como quer ser chamado? Exemplo: *!meunick Sonzera*");
        return;
      }

      if (parametro.length > 15) {
        await msg.reply(
          "Nick muito grande, emocionado! Escolha um com até 15 letras.",
        );
        return;
      }

      nicks[senderId] = parametro;
      fs.writeFileSync("./nicks.json", JSON.stringify(nicks, null, 2));

      await msg.reply(
        `✅ Nick atualizado! A partir de agora vou te chamar de *${parametro}*.`,
      );
      return;
    }

    // ==========================================
    // COMANDO: LISTAR COMANDOS (!comandos)
    // ==========================================
    if (comando === "!comandos") {
      let textoCmd = `🤖 *COMANDOS DO BOT* 🤖\n\n`;
      textoCmd += `🎮 *Criação de Partidas:*\n`;
      textoCmd += `*!lobby [hora]* - Cria fila para 5 jogadores.\n`;
      textoCmd += `*!mix [hora]* - Cria um 5x5 para 10 jogadores.\n\n`;
      textoCmd += `👤 *Interação:*\n`;
      textoCmd += `*!eu* - Entra na lista (ou banco de reservas).\n`;
      textoCmd += `*!sair* - Sai da lista (sobe um reserva).\n`;
      textoCmd += `*!status* - Mostra a lista atual sem você precisar entrar.\n`;
      textoCmd += `*!meunick [nome]* - Muda seu nome na lista.\n\n`;
      textoCmd += `⚙️ *Gerenciamento (Só o Criador):*\n`;
      textoCmd += `*!horario [hora]* - Atualiza o horário e avisa os confirmados.\n`;
      textoCmd += `*!titulo [nome]* - Dá um título pra partida.\n`;
      textoCmd += `*!cancelar* - Derruba a lista.\n`;

      await chat.sendMessage(textoCmd);
      return;
    }

    // ==========================================
    // COMANDO: VER STATUS (!status)
    // ==========================================
    if (comando === "!status") {
      // Se não tem nada rolando
      if (!sessoes[groupId]) {
        await msg.reply(
          "🟢 *Bot tá ON!*\nMas não tem nenhuma partida aberta no momento. Mande *!lobby* ou *!mix* para criar uma!",
        );
        return;
      }

      // Se tem partida rolando, puxa as informações
      let sessao = sessoes[groupId];
      let vagasRestantes = sessao.maxPlayers - sessao.jogadores.length;

      let textoStatus = `ℹ️ *STATUS DA PARTIDA* ℹ️\n`;
      textoStatus += `🎮 *${sessao.titulo}*\n`;
      if (sessao.horario) textoStatus += `⏰ *Horário:* ${sessao.horario}\n`;
      textoStatus += `\n${gerarListaTexto(sessao)}`;

      if (vagasRestantes === 0) {
        textoStatus += `\n🔥 A lista principal tá cheia! Mas você pode mandar *!eu* pra ir pro banco de reservas.`;
      } else {
        textoStatus += `\nRestam ${vagasRestantes} vagas! Mande *!eu* para entrar.`;
      }

      await chat.sendMessage(textoStatus);
      return;
    }

    // ==========================================
    // COMANDO: ABRIR OU ENTRAR NA LOBBY/MIX
    // ==========================================
    if (comando === "!lobby" || comando === "!mix" || comando === "!eu") {
      if (!sessoes[groupId] && (comando === "!lobby" || comando === "!mix")) {
        sessoes[groupId] = {
          jogadores: [{ nome: nome, id: senderId }],
          suplentes: [],
          criador: senderId,
          horario: parametro,
          titulo: comando === "!mix" ? "MIX 5x5" : "LOBBY",
          maxPlayers: comando === "!mix" ? 10 : 5,
          tipo: comando === "!mix" ? "MIX" : "LOBBY",
        };

        let sessao = sessoes[groupId];
        let texto = `🎮 *${sessao.titulo} ABERTA* 🎮\n`;
        if (sessao.horario) texto += `⏰ *Horário:* ${sessao.horario}\n`;
        texto += `\n${gerarListaTexto(sessao)}`;
        texto += `\nMande *!eu* para entrar, ou *!sair* para quitar.`;

        await marcarTodos(chat, texto);
      } else if (
        sessoes[groupId] &&
        (sessoes[groupId].jogadores.length > 0 ||
          sessoes[groupId].suplentes.length > 0)
      ) {
        let sessao = sessoes[groupId];

        let jaEstaNoTime = sessao.jogadores.some((j) => j.id === senderId);
        let jaEstaNosSuplentes = sessao.suplentes.some(
          (s) => s.id === senderId,
        );

        if (jaEstaNoTime || jaEstaNosSuplentes) {
          await msg.reply(
            "Você já está na lista ou no banco de reservas, emocionado!",
          );
          return;
        }

        if (sessao.jogadores.length < sessao.maxPlayers) {
          sessao.jogadores.push({ nome: nome, id: senderId });
          let vagasRestantes = sessao.maxPlayers - sessao.jogadores.length;

          if (vagasRestantes === 0) {
            let textoFinal = `🔥 *${sessao.titulo} FECHADA! BORA!* 🔥\n`;
            if (sessao.horario)
              textoFinal += `⏰ *Horário:* ${sessao.horario}\n`;
            textoFinal += `\n${gerarListaTexto(sessao)}`;

            if (sessao.tipo === "LOBBY") {
              textoFinal += `\n🎧 Entrem no Discord:\n${process.env.DISCORD_LINK}`;
            } else {
              textoFinal += `\n🎧 Entrem no Discord para sortear os times!\n${process.env.DISCORD_LINK}`;
            }

            await chat.sendMessage(textoFinal);
          } else {
            let textoParcial = `🎮 *${sessao.titulo} (PARCIAL)* 🎮\n`;
            if (sessao.horario)
              textoParcial += `⏰ *Horário:* ${sessao.horario}\n`;
            textoParcial += `\n${gerarListaTexto(sessao)}`;
            textoParcial += `\n${nome} entrou! Restam ${vagasRestantes} vagas.`;

            await chat.sendMessage(textoParcial);
          }
        } else {
          sessao.suplentes.push({ nome: nome, id: senderId });

          let textoSuplente = `⚠️ *TIME CHEIO!* ⚠️\n`;
          textoSuplente += `${nome} entrou no banco de reservas (Suplente #${sessao.suplentes.length}).\n\n`;
          textoSuplente += gerarListaTexto(sessao);

          await chat.sendMessage(textoSuplente);
        }
      } else if (comando === "!eu") {
        await msg.reply(
          "Nenhuma partida aberta no momento. Mande *!lobby* ou *!mix* para criar uma!",
        );
      }
    }

    // ==========================================
    // COMANDO: SAIR (COM PROMOÇÃO DE SUPLENTE)
    // ==========================================
    else if (comando === "!sair" && sessoes[groupId]) {
      let sessao = sessoes[groupId];

      let indexTime = sessao.jogadores.findIndex((j) => j.id === senderId);
      let indexSuplente = sessao.suplentes.findIndex((s) => s.id === senderId);

      if (indexTime === -1 && indexSuplente === -1) {
        await msg.reply("Burro ou leigo? Você nem tava na lista...");
        return;
      }

      if (indexSuplente !== -1) {
        sessao.suplentes.splice(indexSuplente, 1);
        await chat.sendMessage(
          `${nome} cansou de esperar e saiu dos suplentes.`,
        );
        return;
      }

      if (indexTime !== -1) {
        sessao.jogadores.splice(indexTime, 1);

        let textoSair = `🎮 *${sessao.titulo} ATUALIZADA* 🎮\n`;
        if (sessao.horario) textoSair += `⏰ *Horário:* ${sessao.horario}\n`;

        if (sessao.suplentes.length > 0) {
          let promovido = sessao.suplentes.shift();
          sessao.jogadores.push(promovido);

          textoSair += `\n${gerarListaTexto(sessao)}`;
          textoSair += `\n${nome} arregou.`;
          textoSair += `\n🔄 *${promovido.nome} subiu do banco de reservas para o time titular!*`;
        } else {
          textoSair += `\n${gerarListaTexto(sessao)}`;
          textoSair += `\n${nome} arregou. Restam ${sessao.maxPlayers - sessao.jogadores.length} vagas agora.`;
        }

        if (sessao.jogadores.length === 0) {
          delete sessoes[groupId];
          await chat.sendMessage(
            "Todo mundo arregou. A partida foi cancelada.",
          );
        } else {
          await chat.sendMessage(textoSair);
        }
      }
    }

    // ==========================================
    // COMANDO: CANCELAR
    // ==========================================
    else if (comando === "!cancelar" && sessoes[groupId]) {
      if (sessoes[groupId].criador !== senderId) {
        await msg.reply(
          "Tá achando que é admin? Só quem abriu a partida pode cancelar!",
        );
        return;
      }
      delete sessoes[groupId];
      await chat.sendMessage(
        "🛑 *Partida cancelada pelo criador.* A fila foi resetada!",
      );
    }

    // ==========================================
    // COMANDO: ALTERAR HORÁRIO
    // ==========================================
    else if (comando === "!horario") {
      if (!sessoes[groupId]) {
        await msg.reply("Nenhuma partida rolando para alterar o horário.");
        return;
      }
      if (sessoes[groupId].criador !== senderId) {
        await msg.reply(
          "Tá achando que é admin? Só quem abriu pode alterar o horário!",
        );
        return;
      }
      if (!parametro) {
        await msg.reply("Esqueceu o horário! Exemplo: *!horario 22h*");
        return;
      }

      sessoes[groupId].horario = parametro;
      let sessao = sessoes[groupId];

      let textoHorario = `⏳ *HORÁRIO ALTERADO PARA ${sessao.horario}* ⏳\n\n`;
      textoHorario += gerarListaTexto(sessao);
      textoHorario += `\n⚠️ Se você NÃO puder mais jogar, mande *!sair* para dar a vaga ao suplente!`;

      let mentionsIds = [];
      let tagsTexto = "";

      let todosNaSessao = [...sessao.jogadores, ...sessao.suplentes];
      todosNaSessao.forEach((jogador) => {
        mentionsIds.push(jogador.id);
        tagsTexto += `@${jogador.id.split("@")[0]} `;
      });

      await chat.sendMessage(textoHorario);
      await chat.sendMessage(`Por favor, confirmem: ${tagsTexto}`, {
        mentions: mentionsIds,
      });
    }

    // ==========================================
    // COMANDO: ALTERAR TÍTULO (!titulo)
    // ==========================================
    else if (comando === "!titulo") {
      if (!sessoes[groupId]) {
        await msg.reply("Nenhuma partida rolando para dar nome.");
        return;
      }
      if (sessoes[groupId].criador !== senderId) {
        await msg.reply("Opa, só quem abriu a partida pode mudar o título!");
        return;
      }
      if (!parametro) {
        await msg.reply(
          "Manda o título junto! Exemplo: *!titulo Lobby do Almoço*",
        );
        return;
      }

      sessoes[groupId].titulo = parametro.toUpperCase();
      let sessao = sessoes[groupId];

      let textoTitulo = `📝 *TÍTULO ATUALIZADO* 📝\n`;
      textoTitulo += `Agora é: *${sessao.titulo}*\n\n`;
      if (sessao.horario) textoTitulo += `⏰ *Horário:* ${sessao.horario}\n\n`;
      textoTitulo += gerarListaTexto(sessao);
      textoTitulo += `\nRestam ${sessao.maxPlayers - sessao.jogadores.length} vagas!`;

      await chat.sendMessage(textoTitulo);
    }
  } catch (erro) {
    console.error("⚠️ Erro ao processar mensagem recebida:", erro.message);
  }
});

client.initialize();
