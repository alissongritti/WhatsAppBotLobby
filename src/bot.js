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

  client.on("message_create", async (msg) => {
    const tempoAtual = Math.floor(Date.now() / 1000);
    const idadeDaMensagem = tempoAtual - msg.timestamp;
    if (idadeDaMensagem > 1800) return;

    try {
      const chat = await msg.getChat();
      const contact = await msg.getContact();
      const senderId = contact.id._serialized;

      // ─── 1. DM — só o owner tem acesso ──────────────────────────────────────
      if (!chat.isGroup) {
        if (senderId !== ADMIN_WA_ID) return; // Silêncio absoluto

        const context = await parseMessage(msg, chat);
        if (!context) return;

        await router({
          ...context,
          nomeGrupo: "Privado",
          isGroup: false,
          client, // passa o client para evitar referência circular no ownerCommands
        });
        return;
      }

      // ─── 2. FILTRO BARATO: É um comando válido? ──────────────────────────────
      const context = await parseMessage(msg, chat);
      if (!context) return;

      // ─── 3. FILTRO CARO: O grupo tem autorização? ────────────────────────────
      const groupId = chat.id._serialized;
      const autorizado = await isGrupoAutorizado(groupId);

      if (!autorizado) {
        if (ADMIN_WA_ID && !gruposJaNotificados.has(groupId)) {
          gruposJaNotificados.add(groupId);
          try {
            console.log(`🚨 Grupo não autorizado: ${chat.name} | ${groupId}`);
            await client.sendMessage(
              ADMIN_WA_ID,
              `🚨 *Tentativa de uso não autorizado!*\n\n` +
                `📍 *Grupo:* ${chat.name}\n` +
                `🔑 *ID:* ${groupId}\n\n` +
                `Para liberar, responda:\n*!aprovar ${groupId}*`,
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
      await router({
        ...context,
        nomeGrupo: chat.name || groupId,
        isGroup: true,
        isSuperAdmin,
        client,
      });
    } catch (err) {
      console.error("⚠️ Erro ao processar mensagem:", err.message);
    }
  });

  if (!ADMIN_WA_ID) {
    console.warn(
      "⚠️  ADMIN_WA_ID não definido! Aprovação de grupos desativada.",
    );
  }

  client.initialize();
}

module.exports = { initBot, getClient };
