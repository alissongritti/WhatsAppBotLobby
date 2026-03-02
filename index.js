require("dotenv").config(); // Puxa as variáveis do .env ANTES de tudo
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

let db;

// Função para iniciar o banco de dados
async function iniciarBanco() {
  db = await open({
    filename: "./bot_database.sqlite",
    driver: sqlite3.Database,
  });

  // Cria as tabelas se elas não existirem
  await db.exec(`
    CREATE TABLE IF NOT EXISTS nicks (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS estatisticas (
      id TEXT PRIMARY KEY,
      partidas_jogadas INTEGER DEFAULT 0,
      arregadas INTEGER DEFAULT 0
    );
  `);
  console.log("📦 Banco de dados SQLite conectado e pronto!");
}

iniciarBanco();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox"],
  },
});

let sessoes = {};

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

    // Busca o nick no SQLite
    const nickRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
      senderId,
    ]);
    const nome = nickRow ? nickRow.nome : contact.pushname || contact.number;

    const textoMensagem = msg.body.toLowerCase().trim();
    const groupId = chat.id._serialized;
    let comando = textoMensagem;
    let parametro = "";

    // INTERCEPTAÇÃO DE COMANDOS COM PARÂMETROS (COM SUPORTE A VARIAÇÕES/ERROS)
    if (textoMensagem.startsWith("!lobby")) {
      comando = "!lobby";
      parametro = textoMensagem.replace("!lobby", "").trim();
    } else if (textoMensagem === "!status" || textoMensagem === "!lista") {
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
      comando = "!horario";
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
      comando = "!titulo";
      let aliasUsado = ["!título", "!titulo"].find((c) =>
        textoMensagem.startsWith(c),
      );
      parametro = msg.body.substring(aliasUsado.length).trim();
    }
    // COMANDO DE NICK
    else if (textoMensagem.startsWith("!meunick")) {
      comando = "!meunick";
      parametro = msg.body.substring(8).trim();
    }

    // ==========================================
    // 🪄 LIMPEZA DE MENÇÕES (Evita ID feio no título)
    // ==========================================
    if (parametro) {
      const mentions = await msg.getMentions();
      if (mentions && mentions.length > 0) {
        // Encontra todos os padrões de "@numeroGigante" no texto
        const IDsNoTexto = parametro.match(/@\d+/g);

        if (IDsNoTexto) {
          for (let i = 0; i < IDsNoTexto.length; i++) {
            let m = mentions[i];
            if (m) {
              // Busca no banco se o mencionado tem nick
              const mRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
                m.id._serialized,
              ]);
              const mNome = mRow
                ? mRow.nome
                : m.pushname || m.name || "Jogador";

              // Troca o ID bizarro pelo Nick bonito
              parametro = parametro.replace(IDsNoTexto[i], mNome);
            }
          }
        }
      }
    }

    // ==========================================
    // COMANDO: DEFINIR NICK PERSONALIZADO (!meunick, !nick)
    // ==========================================
    if (comando === "!meunick" || comando === "!nick") {
      // Se ele mandou só "!meunick" sem passar um nome
      if (!parametro) {
        // 🚨 CORREÇÃO: Agora verifica o nickRow do SQLite em vez do antigo JSON 🚨
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

      // Trava de segurança para nicks gigantes
      if (parametro.length > 15) {
        await msg.reply(
          "Nick muito grande, emocionado! Escolha um com até 15 letras.",
        );
        return;
      }

      // Salva ou atualiza o novo nick no banco de dados
      await db.run("INSERT OR REPLACE INTO nicks (id, nome) VALUES (?, ?)", [
        senderId,
        parametro,
      ]);

      await msg.reply(
        `✅ Nick atualizado! A partir de agora vou te chamar de *${parametro}*.`,
      );
      return;
    }

    // ==========================================
    // COMANDO: LISTAR COMANDOS (!comandos , !help , !ajuda)
    // ==========================================
    if (
      comando === "!comandos" ||
      comando === "!help" ||
      comando === "!ajuda"
    ) {
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
    // COMANDO: VER STATUS (!status, !lista)
    // ==========================================
    if (comando === "!status" || comando === "!lista") {
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
      textoStatus += `🎮 *Lobby: ${sessao.titulo}*\n`;
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
        let horarioDefinido = "";
        let tituloDefinido = comando === "!mix" ? "MIX 5x5" : "LOBBY";

        if (parametro) {
          let primeiraPalavra = parametro.split(" ")[0];

          if (/^\d/.test(primeiraPalavra)) {
            horarioDefinido = primeiraPalavra;
            let resto = parametro.substring(primeiraPalavra.length).trim();
            if (resto) {
              tituloDefinido = resto.toUpperCase();
            }
          } else {
            tituloDefinido = parametro.toUpperCase();
          }
        }

        sessoes[groupId] = {
          jogadores: [{ nome: nome, id: senderId }],
          suplentes: [],
          criador: senderId,
          horario: horarioDefinido,
          titulo: tituloDefinido,
          maxPlayers: comando === "!mix" ? 10 : 5,
          tipo: comando === "!mix" ? "MIX" : "LOBBY",
        };

        let sessao = sessoes[groupId];
        let texto = `🎮 *Lobby: ${sessao.titulo} - ABERTA* 🎮\n`;
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
            let textoFinal = `🔥 *Lobby: ${sessao.titulo} FECHADA! BORA!* 🔥\n`;
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
            let textoParcial = `🎮 *Lobby: ${sessao.titulo} - (PARCIAL)* 🎮\n`;
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
    // COMANDO: SAIR (COM PROMOÇÃO E PASSAGEM DE COROA)
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
        sessao.jogadores.splice(indexTime, 1); // Tira o cara da lista

        // Puxa o suplente, se existir
        let promovido = null;
        if (sessao.suplentes.length > 0) {
          promovido = sessao.suplentes.shift();
          sessao.jogadores.push(promovido);
        }

        // 👑 VERIFICAÇÃO DE ADMIN (Passa a coroa pro Top 1)
        let coroaPassou = false;
        let novoAdminNome = "";
        if (sessao.criador === senderId && sessao.jogadores.length > 0) {
          sessao.criador = sessao.jogadores[0].id;
          coroaPassou = true;
          novoAdminNome = sessao.jogadores[0].nome;
        }

        // Monta o texto de resposta
        let textoSair = `🎮 *${sessao.titulo} ATUALIZADA* 🎮\n`;
        if (sessao.horario) textoSair += `⏰ *Horário:* ${sessao.horario}\n`;

        textoSair += `\n${gerarListaTexto(sessao)}`;

        if (promovido) {
          textoSair += `\n${nome} arregou.`;
          textoSair += `\n🔄 *${promovido.nome} subiu do banco de reservas!*`;
        } else {
          textoSair += `\n${nome} arregou. Restam ${sessao.maxPlayers - sessao.jogadores.length} vagas agora.`;
        }

        // Se passou a coroa, avisa a galera
        if (coroaPassou) {
          textoSair += `\n👑 *A coroa passou!* ${novoAdminNome} agora é o dono da sala.`;
        }

        // Verifica se a sala morreu
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
      textoTitulo += `Lobby: *${sessao.titulo}*\n\n`;
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
