require("dotenv").config();
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

    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      criador_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      horario TEXT,
      tipo TEXT NOT NULL,
      max_players INTEGER NOT NULL,
      status TEXT DEFAULT 'ABERTA',
      data_criacao DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS jogadores_partida (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partida_id INTEGER NOT NULL,
      jogador_id TEXT NOT NULL,
      papel TEXT DEFAULT 'TITULAR',
      FOREIGN KEY(partida_id) REFERENCES partidas(id) ON DELETE CASCADE
    );
  `);

  await db.exec("PRAGMA foreign_keys = ON;");

  try {
    await db.exec("ALTER TABLE partidas ADD COLUMN numero_lobby INTEGER");
  } catch (e) {}

  console.log("📦 Banco de dados SQLite conectado e pronto!");
}

iniciarBanco();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ["--no-sandbox"] },
});

// ==========================================
// FUNÇÃO: Renderiza a lista puxando do SQLite (COM NOME DO WHATSAPP)
// ==========================================
async function gerarListaTextoBanco(partidaId, maxPlayers) {
  const jogadores = await db.all(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR' ORDER BY id ASC",
    [partidaId],
  );
  const suplentes = await db.all(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'SUPLENTE' ORDER BY id ASC",
    [partidaId],
  );

  let textoLista = "";
  for (let i = 0; i < maxPlayers; i++) {
    if (jogadores[i]) {
      const nickRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
        jogadores[i].jogador_id,
      ]);
      let nomeJogador = "Jogador";

      if (nickRow) {
        nomeJogador = nickRow.nome; // Achou no banco!
      } else {
        // Não tem nick salvo? Puxa o nome do WhatsApp da pessoa!
        try {
          const contact = await client.getContactById(jogadores[i].jogador_id);
          nomeJogador = contact.pushname || contact.name || contact.number;
        } catch (e) {}
      }

      textoLista += `${i + 1}. ${nomeJogador}\n`;
    } else {
      textoLista += `${i + 1}. \n`;
    }
  }

  if (suplentes.length > 0) {
    textoLista += `\n🔄 *SUPLENTES:*\n`;
    for (let i = 0; i < suplentes.length; i++) {
      const nickRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
        suplentes[i].jogador_id,
      ]);
      let nomeSup = "Jogador";

      if (nickRow) {
        nomeSup = nickRow.nome;
      } else {
        try {
          const contact = await client.getContactById(suplentes[i].jogador_id);
          nomeSup = contact.pushname || contact.name || contact.number;
        } catch (e) {}
      }

      textoLista += `S${i + 1}. ${nomeSup}\n`;
    }
  }
  return textoLista;
}

// Função unificada com Ghost Mention (@todos)
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

    const nickRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
      senderId,
    ]);
    const nome = nickRow ? nickRow.nome : contact.pushname || contact.number;

    const textoMensagem = msg.body.toLowerCase().trim();
    const groupId = chat.id._serialized;
    let comando = textoMensagem;
    let parametro = "";

    // INTERCEPTAÇÃO DE COMANDOS COM PARÂMETROS
    if (textoMensagem.startsWith("!lobby")) {
      comando = "!lobby";
      parametro = textoMensagem.replace("!lobby", "").trim();
    } else if (textoMensagem === "!status" || textoMensagem === "!lista") {
      comando = "!status";
    } else if (textoMensagem.startsWith("!mix")) {
      comando = "!mix";
      parametro = textoMensagem.replace("!mix", "").trim();
    } else if (
      textoMensagem.startsWith("!eu") ||
      textoMensagem.startsWith("!entrar") ||
      textoMensagem.startsWith("!join")
    ) {
      comando = "!eu";
      let aliasUsado = ["!entrar", "!join", "!eu"].find((c) =>
        textoMensagem.startsWith(c),
      );
      parametro = textoMensagem.replace(aliasUsado, "").trim();
    } else if (
      textoMensagem.startsWith("!sair") ||
      textoMensagem.startsWith("!quit")
    ) {
      comando = "!sair";
      let aliasUsado = ["!sair", "!quit"].find((c) =>
        textoMensagem.startsWith(c),
      );
      parametro = textoMensagem.replace(aliasUsado, "").trim();
    } else if (
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
    } else if (
      textoMensagem.startsWith("!titulo") ||
      textoMensagem.startsWith("!título")
    ) {
      comando = "!titulo";
      let aliasUsado = ["!título", "!titulo"].find((c) =>
        textoMensagem.startsWith(c),
      );
      parametro = msg.body.substring(aliasUsado.length).trim();
    } else if (
      textoMensagem.startsWith("!meunick") ||
      textoMensagem.startsWith("!nick")
    ) {
      comando = "!meunick";
      let aliasUsado = ["!meunick", "!nick"].find((c) =>
        textoMensagem.startsWith(c),
      );
      parametro = msg.body.substring(aliasUsado.length).trim();
    } else if (
      textoMensagem === "!cancelar" ||
      textoMensagem === "!fechar" ||
      textoMensagem === "!drop"
    ) {
      comando = "!cancelar";
    }

    // ==========================================
    // 🪄 LIMPEZA DE MENÇÕES NO TÍTULO
    // ==========================================
    if (
      parametro &&
      (comando === "!lobby" || comando === "!mix" || comando === "!titulo")
    ) {
      const mentions = await msg.getMentions();
      if (mentions && mentions.length > 0) {
        const IDsNoTexto = parametro.match(/@\d+/g);
        if (IDsNoTexto) {
          for (let i = 0; i < IDsNoTexto.length; i++) {
            let m = mentions[i];
            if (m) {
              const mRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
                m.id._serialized,
              ]);
              const mNome = mRow
                ? mRow.nome
                : m.pushname || m.name || "Jogador";
              parametro = parametro.replace(IDsNoTexto[i], mNome);
            }
          }
        }
      }
    }

    // ==========================================
    // COMANDO: NICK
    // ==========================================
    if (comando === "!meunick") {
      if (!parametro) {
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
    // COMANDO: COMANDOS
    // ==========================================
    if (
      comando === "!comandos" ||
      comando === "!help" ||
      comando === "!ajuda"
    ) {
      let textoCmd = `🤖 *COMANDOS DO BOT* 🤖\n\n`;
      textoCmd += `🎮 *Criação de Partidas:*\n*!lobby [hora]* - Cria fila para 5 jogadores.\n*!mix [hora]* - Cria um 5x5 para 10 jogadores.\n\n`;
      textoCmd += `👤 *Interação:*\n*!eu* - Entra na lista.\n*!sair* - Sai da lista.\n*!status* - Mostra as listas atuais.\n*!meunick [nome]* - Muda seu nome.\n\n`;
      textoCmd += `⚙️ *Gerenciamento:*\n*!horario [hora]* - Atualiza o horário.\n*!titulo [nome]* - Atualiza o título.\n*!start* - Fecha a lista e dá +1 ponto de estatística aos titulares.\n*!cancelar* - Derruba a lista.\n`;

      await chat.sendMessage(textoCmd);
      return;
    }

    // ==========================================
    // COMANDO: STATUS / LISTA
    // ==========================================
    if (comando === "!status") {
      const abertas = await db.all(
        "SELECT * FROM partidas WHERE group_id = ? AND status = 'ABERTA' ORDER BY numero_lobby ASC",
        [groupId],
      );

      if (abertas.length === 0) {
        await msg.reply(
          "🟢 *Bot tá ON!*\nMas não tem nenhuma partida aberta no momento. Mande *!lobby* ou *!mix* para criar uma!",
        );
        return;
      }

      for (let partida of abertas) {
        const titulares = await db.get(
          "SELECT COUNT(id) as count FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR'",
          [partida.id],
        );
        let vagasRestantes = partida.max_players - titulares.count;

        let textoStatus = `ℹ️ *STATUS DA PARTIDA #${partida.numero_lobby}* ℹ️\n`;
        textoStatus += `🎮 *Lobby: ${partida.titulo}*\n`;
        if (partida.horario)
          textoStatus += `⏰ *Horário:* ${partida.horario}\n`;
        textoStatus += `\n${await gerarListaTextoBanco(partida.id, partida.max_players)}`;

        if (vagasRestantes === 0) {
          textoStatus += `\n🔥 A lista principal tá cheia! Mas você pode mandar *!eu ${partida.numero_lobby}* pra ir pro banco de reservas.`;
        } else {
          textoStatus += `\nRestam ${vagasRestantes} vagas! Mande *!eu ${partida.numero_lobby}* para entrar.`;
        }
        await chat.sendMessage(textoStatus);
      }
      return;
    }

    // ==========================================
    // 🛑 REGRA DE OURO DA MONOGAMIA
    // ==========================================
    if (comando === "!lobby" || comando === "!mix" || comando === "!eu") {
      const jaEstaEmLobby = await db.get(
        `SELECT p.numero_lobby, p.titulo FROM partidas p
         JOIN jogadores_partida jp ON p.id = jp.partida_id
         WHERE p.group_id = ? AND jp.jogador_id = ? AND p.status = 'ABERTA'`,
        [groupId, senderId],
      );

      if (jaEstaEmLobby) {
        await msg.reply(
          `🚨 Emocionado! Você já está na *Lobby #${jaEstaEmLobby.numero_lobby}: ${jaEstaEmLobby.titulo}*. Mande *!sair* dela primeiro se quiser entrar ou criar outra.`,
        );
        return;
      }
    }

    // ==========================================
    // COMANDO: ABRIR LOBBY/MIX (COM TRAVA INTELIGENTE E AVISO AOS RESERVAS)
    // ==========================================
    if (comando === "!lobby" || comando === "!mix") {
      const lobbiesAbertas = await db.all(
        "SELECT id, max_players, numero_lobby FROM partidas WHERE group_id = ? AND status = 'ABERTA'",
        [groupId],
      );

      // 1. A Trava: Só bloqueia se alguma lobby ainda tiver vaga de titular
      if (lobbiesAbertas.length > 0) {
        let temVagaTitular = false;
        let numComVaga = null;

        for (let lobby of lobbiesAbertas) {
          const titulares = await db.get(
            "SELECT COUNT(id) as count FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR'",
            [lobby.id],
          );
          if (titulares.count < lobby.max_players) {
            temVagaTitular = true;
            numComVaga = lobby.numero_lobby;
            break;
          }
        }

        if (temVagaTitular) {
          await msg.reply(
            `Calma lá! A Lobby #${numComVaga} ainda tem vagas para o time titular.\nMande *!eu ${numComVaga}* para entrar nela antes de tentar criar outra.`,
          );
          return; // Bloqueia a criação
        }
        // Se chegou aqui, TODAS as lobbies abertas estão lotadas. Ele segue e cria a nova!
      }

      // 2. Criação Normal da Partida
      let horarioDefinido = "";
      let tituloDefinido = comando === "!mix" ? "MIX 5x5" : "LOBBY";

      if (parametro) {
        let primeiraPalavra = parametro.split(" ")[0];
        if (/^\d/.test(primeiraPalavra)) {
          horarioDefinido = primeiraPalavra;
          let resto = parametro.substring(primeiraPalavra.length).trim();
          if (resto) tituloDefinido = resto.toUpperCase();
        } else {
          tituloDefinido = parametro.toUpperCase();
        }
      }

      let maxPlayers = comando === "!mix" ? 10 : 5;
      let tipo = comando === "!mix" ? "MIX" : "LOBBY";

      // Lógica de Reciclagem de ID Visual
      const lobbiesAtivas = await db.all(
        "SELECT numero_lobby FROM partidas WHERE group_id = ? AND status = 'ABERTA' ORDER BY numero_lobby ASC",
        [groupId],
      );
      let numeroDisponivel = 1;
      for (let lobby of lobbiesAtivas) {
        if (lobby.numero_lobby === numeroDisponivel) numeroDisponivel++;
        else break;
      }

      const result = await db.run(
        `INSERT INTO partidas (group_id, criador_id, titulo, horario, tipo, max_players, numero_lobby) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          groupId,
          senderId,
          tituloDefinido,
          horarioDefinido,
          tipo,
          maxPlayers,
          numeroDisponivel,
        ],
      );

      const partidaId = result.lastID;
      await db.run(
        `INSERT INTO jogadores_partida (partida_id, jogador_id, papel) VALUES (?, ?, 'TITULAR')`,
        [partidaId, senderId],
      );

      let texto = `🎮 *${tipo} #${numeroDisponivel}: ${tituloDefinido} - ABERTA* 🎮\n`;
      if (horarioDefinido) texto += `⏰ *Horário:* ${horarioDefinido}\n`;
      texto += `\n${await gerarListaTextoBanco(partidaId, maxPlayers)}`;
      texto += `\nMande *!eu ${numeroDisponivel}* para entrar!`;

      await marcarTodos(chat, texto);

      // 3. 🚨 AVISO AOS SUPLENTES
      // Busca se tem alguém no banco de reservas de OUTRAS partidas abertas
      const suplentesOutras = await db.all(
        `
        SELECT jp.jogador_id 
        FROM jogadores_partida jp
        JOIN partidas p ON jp.partida_id = p.id
        WHERE p.group_id = ? AND jp.papel = 'SUPLENTE' AND p.status = 'ABERTA' AND p.id != ?
      `,
        [groupId, partidaId],
      );

      if (suplentesOutras.length > 0) {
        let avisoSup = `👀 *Atenção Reservas!*\nA Lobby #${numeroDisponivel} acabou de ser criada com vagas para titulares!\n\nSe quiserem sair do banco e jogar nesta nova, mandem:\n*!sair* (para sair da atual)\ne depois *!eu ${numeroDisponivel}*`;
        let mentionsSup = suplentesOutras.map((s) => s.jogador_id);

        await chat.sendMessage(avisoSup, { mentions: mentionsSup });
      }

      return;
    }

    // ==========================================
    // COMANDO: ENTRAR NA PARTIDA (!eu)
    // ==========================================
    if (comando === "!eu") {
      let partidaAlvo = null;

      if (parametro) {
        const idBuscado = parseInt(parametro);
        if (isNaN(idBuscado)) {
          await msg.reply("Formato inválido. Usa *!eu [numero]*.");
          return;
        }
        partidaAlvo = await db.get(
          "SELECT * FROM partidas WHERE numero_lobby = ? AND group_id = ? AND status = 'ABERTA'",
          [idBuscado, groupId],
        );
        if (!partidaAlvo) {
          await msg.reply(
            `Não encontrei nenhuma partida aberta com o ID #${idBuscado} neste grupo.`,
          );
          return;
        }
      } else {
        const abertas = await db.all(
          "SELECT * FROM partidas WHERE group_id = ? AND status = 'ABERTA' ORDER BY numero_lobby ASC",
          [groupId],
        );
        if (abertas.length === 0) {
          await msg.reply(
            "Nenhuma partida aberta no momento. Envia *!lobby* ou *!mix* para criar uma!",
          );
          return;
        } else if (abertas.length === 1) {
          partidaAlvo = abertas[0];
        } else {
          let textoAviso = `Temos ${abertas.length} partidas a decorrer! Especifica em qual queres entrar:\n\n`;
          abertas.forEach((p) => {
            textoAviso += `ID #${p.numero_lobby} - ${p.titulo} (${p.tipo})\n`;
          });
          textoAviso += `\nExemplo: *!eu ${abertas[0].numero_lobby}*`;
          await msg.reply(textoAviso);
          return;
        }
      }

      const titulares = await db.all(
        "SELECT id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR'",
        [partidaAlvo.id],
      );
      const numTitulares = titulares.length;
      const maxPlayers = partidaAlvo.max_players;

      if (numTitulares < maxPlayers) {
        await db.run(
          "INSERT INTO jogadores_partida (partida_id, jogador_id, papel) VALUES (?, ?, 'TITULAR')",
          [partidaAlvo.id, senderId],
        );
        let vagasRestantes = maxPlayers - (numTitulares + 1);

        if (vagasRestantes === 0) {
          let textoFinal = `🔥 *${partidaAlvo.tipo} #${partidaAlvo.numero_lobby}: ${partidaAlvo.titulo} FECHADA! BORA!* 🔥\n`;
          if (partidaAlvo.horario)
            textoFinal += `⏰ *Horário:* ${partidaAlvo.horario}\n`;
          textoFinal += `\n${await gerarListaTextoBanco(partidaAlvo.id, maxPlayers)}`;
          textoFinal += `\n🎧 Entrem no Discord:\n${process.env.DISCORD_LINK}`;
          await chat.sendMessage(textoFinal);
        } else {
          let textoParcial = `🎮 *${partidaAlvo.tipo} #${partidaAlvo.numero_lobby} (PARCIAL)* 🎮\n`;
          if (partidaAlvo.horario)
            textoParcial += `⏰ *Horário:* ${partidaAlvo.horario}\n`;
          textoParcial += `\n${await gerarListaTextoBanco(partidaAlvo.id, maxPlayers)}`;
          textoParcial += `\n${nome} entrou! Restam ${vagasRestantes} vagas.`;
          await chat.sendMessage(textoParcial);
        }
      } else {
        await db.run(
          "INSERT INTO jogadores_partida (partida_id, jogador_id, papel) VALUES (?, ?, 'SUPLENTE')",
          [partidaAlvo.id, senderId],
        );
        const suplentes = await db.all(
          "SELECT id FROM jogadores_partida WHERE partida_id = ? AND papel = 'SUPLENTE'",
          [partidaAlvo.id],
        );

        let textoSuplente = `⚠️ *EQUIPA CHEIA!* ⚠️\n`;
        textoSuplente += `${nome} entrou no banco de reservas (Suplente #${suplentes.length}) da partida #${partidaAlvo.numero_lobby}.\n\n`;
        textoSuplente += await gerarListaTextoBanco(partidaAlvo.id, maxPlayers);
        await chat.sendMessage(textoSuplente);
      }
      return;
    }

    // ==========================================
    // COMANDO: SAIR (!sair)
    // ==========================================
    if (comando === "!sair") {
      let partidaAlvo = null;

      if (parametro) {
        const idBuscado = parseInt(parametro);
        if (isNaN(idBuscado)) {
          await msg.reply("Formato inválido. Use *!sair [numero]*.");
          return;
        }
        partidaAlvo = await db.get(
          "SELECT * FROM partidas WHERE numero_lobby = ? AND group_id = ? AND status = 'ABERTA'",
          [idBuscado, groupId],
        );
        if (!partidaAlvo) {
          await msg.reply(
            `Não encontrei a partida #${idBuscado} ou ela já foi fechada.`,
          );
          return;
        }
      } else {
        const partidasDoUsuario = await db.all(
          `SELECT p.* FROM partidas p 
           JOIN jogadores_partida jp ON p.id = jp.partida_id 
           WHERE p.group_id = ? AND jp.jogador_id = ? AND p.status = 'ABERTA'`,
          [groupId, senderId],
        );

        if (partidasDoUsuario.length === 0) {
          await msg.reply(
            "Burro ou leigo? Você não está em nenhuma partida aberta...",
          );
          return;
        } else if (partidasDoUsuario.length === 1) {
          partidaAlvo = partidasDoUsuario[0];
        } else {
          let textoAviso = `Você está em ${partidasDoUsuario.length} partidas abertas! Especifique de qual quer sair:\n\n`;
          partidasDoUsuario.forEach((p) => {
            textoAviso += `ID #${p.numero_lobby} - ${p.titulo}\n`;
          });
          textoAviso += `\nExemplo: *!sair ${partidasDoUsuario[0].numero_lobby}*`;
          await msg.reply(textoAviso);
          return;
        }
      }

      const registroJogador = await db.get(
        "SELECT id, papel FROM jogadores_partida WHERE partida_id = ? AND jogador_id = ?",
        [partidaAlvo.id, senderId],
      );

      if (!registroJogador) {
        await msg.reply(
          `Você não está na lista da partida #${partidaAlvo.numero_lobby}.`,
        );
        return;
      }

      await db.run("DELETE FROM jogadores_partida WHERE id = ?", [
        registroJogador.id,
      ]);

      if (registroJogador.papel === "SUPLENTE") {
        await chat.sendMessage(
          `${nome} cansou de esperar e saiu dos suplentes da partida #${partidaAlvo.numero_lobby}.`,
        );
        return;
      }

      let promovidoNome = null;
      const primeiroSuplente = await db.get(
        "SELECT id, jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'SUPLENTE' ORDER BY id ASC LIMIT 1",
        [partidaAlvo.id],
      );

      if (primeiroSuplente) {
        await db.run(
          "UPDATE jogadores_partida SET papel = 'TITULAR' WHERE id = ?",
          [primeiroSuplente.id],
        );
        const nickSup = await db.get("SELECT nome FROM nicks WHERE id = ?", [
          primeiroSuplente.jogador_id,
        ]);
        promovidoNome = nickSup ? nickSup.nome : "Jogador";
      }

      let coroaPassou = false;
      let novoAdminNome = "";

      if (partidaAlvo.criador_id === senderId) {
        const novoPrimeiro = await db.get(
          "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR' ORDER BY id ASC LIMIT 1",
          [partidaAlvo.id],
        );
        if (novoPrimeiro) {
          await db.run("UPDATE partidas SET criador_id = ? WHERE id = ?", [
            novoPrimeiro.jogador_id,
            partidaAlvo.id,
          ]);
          coroaPassou = true;
          const nickAdmin = await db.get(
            "SELECT nome FROM nicks WHERE id = ?",
            [novoPrimeiro.jogador_id],
          );
          novoAdminNome = nickAdmin ? nickAdmin.nome : "Jogador";
        }
      }

      const sobrouAlguem = await db.get(
        "SELECT id FROM jogadores_partida WHERE partida_id = ?",
        [partidaAlvo.id],
      );

      if (!sobrouAlguem) {
        await db.run("DELETE FROM partidas WHERE id = ?", [partidaAlvo.id]);
        await chat.sendMessage(
          `Todo mundo arregou. A partida #${partidaAlvo.numero_lobby} foi cancelada!`,
        );
      } else {
        let textoSair = `🎮 *${partidaAlvo.tipo} #${partidaAlvo.numero_lobby}: ${partidaAlvo.titulo} ATUALIZADA* 🎮\n`;
        if (partidaAlvo.horario)
          textoSair += `⏰ *Horário:* ${partidaAlvo.horario}\n`;
        textoSair += `\n${await gerarListaTextoBanco(partidaAlvo.id, partidaAlvo.max_players)}`;

        if (promovidoNome) {
          textoSair += `\n${nome} arregou.`;
          textoSair += `\n🔄 *${promovidoNome} subiu do banco de reservas!*`;
        } else {
          const numTitularesAtual = await db.get(
            "SELECT COUNT(id) as count FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR'",
            [partidaAlvo.id],
          );
          textoSair += `\n${nome} arregou. Restam ${partidaAlvo.max_players - numTitularesAtual.count} vagas agora.`;
        }
        if (coroaPassou)
          textoSair += `\n👑 *A coroa passou!* ${novoAdminNome} agora é o dono da sala.`;
        await chat.sendMessage(textoSair);
      }
      return;
    }

    // ==========================================
    // COMANDO: START / GG (CONCLUI A LOBBY E GERA ESTATÍSTICAS)
    // ==========================================
    if (comando === "!start") {
      // Procura a partida aberta onde o usuário é o criador
      const partidaAdmin = await db.get(
        "SELECT * FROM partidas WHERE group_id = ? AND criador_id = ? AND status = 'ABERTA'",
        [groupId, senderId],
      );

      if (!partidaAdmin) {
        await msg.reply(
          "Você não é o dono de nenhuma partida aberta no momento para dar start!",
        );
        return;
      }

      // 1. Muda o status para CONCLUIDA (liberando o ID reciclável)
      await db.run("UPDATE partidas SET status = 'CONCLUIDA' WHERE id = ?", [
        partidaAdmin.id,
      ]);

      // 2. Adiciona +1 partida jogada nas estatísticas para todos os TITULARES
      const titulares = await db.all(
        "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR'",
        [partidaAdmin.id],
      );

      for (let t of titulares) {
        // O "ON CONFLICT" insere o jogador se ele não existir na tabela, ou soma +1 se ele já existir
        await db.run(
          `
          INSERT INTO estatisticas (id, partidas_jogadas, arregadas) 
          VALUES (?, 1, 0) 
          ON CONFLICT(id) DO UPDATE SET partidas_jogadas = partidas_jogadas + 1
        `,
          [t.jogador_id],
        );
      }

      // 3. Monta a mensagem de hype
      let textoStart = `🚀 *PARTIDA INICIADA! GG!* 🚀\n\n`;
      textoStart += `A Lobby #${partidaAdmin.numero_lobby} (*${partidaAdmin.titulo}*) foi fechada e o jogo começou!\n`;
      textoStart += `O número #${partidaAdmin.numero_lobby} está livre novamente.\n\n`;
      textoStart += `📈 *+1 Partida contabilizada nas estatísticas dos titulares!* Boa sorte!`;

      await chat.sendMessage(textoStart);
      return;
    }

    // ==========================================
    // GERENCIAMENTO: CANCELAR, HORÁRIO, TÍTULO (REFATORADOS PARA SQLITE)
    // ==========================================
    if (
      comando === "!cancelar" ||
      comando === "!horario" ||
      comando === "!titulo"
    ) {
      // Procura a partida aberta onde o usuário é o criador
      const partidaAdmin = await db.get(
        "SELECT * FROM partidas WHERE group_id = ? AND criador_id = ? AND status = 'ABERTA'",
        [groupId, senderId],
      );

      if (!partidaAdmin) {
        await msg.reply(
          "Tá achando que é admin? Você não criou nenhuma partida aberta!",
        );
        return;
      }

      if (comando === "!cancelar") {
        await db.run("DELETE FROM partidas WHERE id = ?", [partidaAdmin.id]);
        await chat.sendMessage(
          `🛑 *Partida #${partidaAdmin.numero_lobby} cancelada pelo criador.* A fila foi resetada!`,
        );
      } else if (comando === "!horario") {
        if (!parametro) {
          await msg.reply("Esqueceu o horário! Exemplo: *!horario 22h*");
          return;
        }
        await db.run("UPDATE partidas SET horario = ? WHERE id = ?", [
          parametro,
          partidaAdmin.id,
        ]);

        let textoHorario = `⏳ *HORÁRIO ALTERADO PARA ${parametro} (Lobby #${partidaAdmin.numero_lobby})* ⏳\n\n`;
        textoHorario += await gerarListaTextoBanco(
          partidaAdmin.id,
          partidaAdmin.max_players,
        );
        textoHorario += `\n⚠️ Se você NÃO puder mais jogar, mande *!sair* para dar a vaga ao suplente!`;

        const jogadores = await db.all(
          "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ?",
          [partidaAdmin.id],
        );
        let mentionsIds = jogadores.map((j) => j.jogador_id);
        let tagsTexto = mentionsIds
          .map((id) => `@${id.split("@")[0]}`)
          .join(" ");

        await chat.sendMessage(textoHorario);
        await chat.sendMessage(`Por favor, confirmem: ${tagsTexto}`, {
          mentions: mentionsIds,
        });
      } else if (comando === "!titulo") {
        if (!parametro) {
          await msg.reply(
            "Manda o título junto! Exemplo: *!titulo Lobby do Almoço*",
          );
          return;
        }
        const novoTitulo = parametro.toUpperCase();
        await db.run("UPDATE partidas SET titulo = ? WHERE id = ?", [
          novoTitulo,
          partidaAdmin.id,
        ]);

        let textoTitulo = `📝 *TÍTULO ATUALIZADO* 📝\nLobby #${partidaAdmin.numero_lobby}: *${novoTitulo}*\n\n`;
        if (partidaAdmin.horario)
          textoTitulo += `⏰ *Horário:* ${partidaAdmin.horario}\n\n`;
        textoTitulo += await gerarListaTextoBanco(
          partidaAdmin.id,
          partidaAdmin.max_players,
        );

        await chat.sendMessage(textoTitulo);
      }
      return;
    }
  } catch (erro) {
    console.error("⚠️ Erro ao processar mensagem recebida:", erro.message);
  }
});

client.initialize();
