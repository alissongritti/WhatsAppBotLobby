const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { parseMessage } = require("./utils/messageParser");
const router = require("./commands/index");
const { iniciarCronJobs } = require("./utils/cronJobs");
const {
  isGrupoAutorizado,
  autorizarGrupo,
} = require("./services/grupoService");
const { ehSuperAdmin } = require("./services/adminService");

const ADMIN_WA_ID = process.env.ADMIN_WA_ID;

const gruposJaNotificados = new Set();

let client;

function getClient() {
  if (!client) throw new Error("Client WhatsApp não inicializado.");
  return client;
}

function initBot() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      protocolTimeout: 60000,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  });

  client.on("qr", (qr) => {
    console.log("Escaneie o QR Code abaixo com seu WhatsApp:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("✅ Bot tá ON e pronto pro jogo!");
    iniciarCronJobs(client);
    console.log("⏰ Alarme da Hora H ativado com sucesso!");
  });

  client.on("message", async (msg) => {
    // 1. FILTRO DE SEGURANÇA INICIAL
    if (!msg || !msg.from || msg.isStatus || msg.fromMe || !msg.body) return;

    // 2. Ignora mensagens antigas (mais de 30 min)
    const tempoAtual = Math.floor(Date.now() / 1000);
    const idadeDaMensagem = tempoAtual - (msg.timestamp || 0);
    if (idadeDaMensagem > 1800) return;

    try {
      // 3. Extração segura de IDs e remetente
      const isGroup = msg.from.endsWith("@g.us");
      const groupId = msg.from;

      const rawSender = isGroup ? msg.author || msg.from : msg.from;
      if (!rawSender) return;

      const senderId = rawSender.includes("@")
        ? rawSender
        : `${rawSender}@c.us`;

      // 4. Fallback seguro para o objeto Chat
      let chat;
      try {
        chat = await msg.getChat();
      } catch (e) {
        chat = {
          id: { _serialized: groupId },
          isGroup: isGroup,
          name: isGroup ? "Grupo CS2" : "Privado",
          sendMessage: (text, options) =>
            client.sendMessage(groupId, text, options),
        };
      }

      // ─── 1. DM — só o owner tem acesso ──────────────────────────────────────
      if (!isGroup) {
        if (senderId !== ADMIN_WA_ID) {
          return; // Ignora DM de estranhos sem logar nada
        }

        const context = await parseMessage(msg, chat);
        if (!context) return; // Não é comando, ignora

        console.log("🚀 Executando comando na DM...");
        await router({
          ...context,
          nomeGrupo: "Privado",
          isGroup: false,
          client,
        });
        return;
      }

      // ─── 2. FILTRO BARATO: É um comando válido? ──────────────────────────────
      const context = await parseMessage(msg, chat);
      if (!context) return; // Não é comando (ex: conversa normal do grupo)

      // ─── 3. FILTRO CARO: O grupo tem autorização? ───────────────────────────
      const autorizado = await isGrupoAutorizado(groupId);

      if (!autorizado) {
        console.log(
          `🚨 Grupo NÃO autorizado: ${chat.name || groupId} (${groupId})`,
        );

        if (ADMIN_WA_ID && !gruposJaNotificados.has(groupId)) {
          gruposJaNotificados.add(groupId);
          try {
            // Usa o JID de envio para notificar na DM do Admin
            const adminDestination = "5512997526116@c.us";

            await client.sendMessage(
              adminDestination,
              `🚨 *Tentativa de uso não autorizado!*\n\n` +
                `📍 *Grupo:* ${chat.name || "Sem Nome"}\n` +
                `🔑 *ID:* \`${groupId}\`\n\n` +
                `Para liberar, responda nesta DM:\n*!aprovar ${groupId}*`,
            );
            console.log(
              `📩 Notificação enviada ao Admin sobre o grupo ${groupId}`,
            );
          } catch (e) {
            console.error("⚠️ Erro ao notificar admin:", e.message);
          }
        }
        return;
      }

      // ─── 4. Verifica se é superadmin ─────────────────────────────────────────
      const isSuperAdmin = await ehSuperAdmin(senderId);

      // ─── 5. Execução do Comando ──────────────────────────────────────────────
      console.log(
        `🚀 Executando comando [${context.comando}] no grupo: ${chat.name || groupId}`,
      );

      await router({
        ...context,
        nomeGrupo: chat.name || groupId,
        isGroup: true,
        isSuperAdmin,
        client,
      });
    } catch (err) {
      console.error(
        "⚠️ Erro ao processar mensagem:",
        err?.stack || err?.message || err,
      );
    }
  });

  if (!ADMIN_WA_ID) {
    console.warn(
      "⚠️ ADMIN_WA_ID não definido! Aprovação de grupos desativada.",
    );
  }

  client.initialize();
}

module.exports = { initBot, getClient };
