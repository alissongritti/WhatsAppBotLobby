const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { parseMessage } = require("./utils/messageParser");
const router = require("./commands/index");

let client;

function getClient() {
  if (!client) throw new Error("Client WhatsApp não inicializado.");
  return client;
}

function initBot() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ["--no-sandbox"] },
  });

  client.on("qr", (qr) => {
    console.log("Escaneie o QR Code abaixo com seu WhatsApp:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("✅ Bot tá ON e pronto pro jogo!");
  });

  client.on("message_create", async (msg) => {
    try {
      const chat = await msg.getChat();
      if (!chat.isGroup) return;

      const context = await parseMessage(msg, chat);
      if (!context) return;

      await router(context);
    } catch (err) {
      console.error("⚠️ Erro ao processar mensagem:", err.message);
    }
  });

  client.initialize();
}

module.exports = { initBot, getClient };
