const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { parseMessage } = require("./utils/messageParser");
const router = require("./commands/index");
const { iniciarCronJobs } = require("./utils/cronJobs");

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
    iniciarCronJobs(client);
    console.log("⏰ Alarme da Hora H ativado com sucesso!");
  });

  client.on("message_create", async (msg) => {
    // --- INÍCIO DA TRAVA DE 30 MINUTOS ---
    const tempoAtual = Math.floor(Date.now() / 1000); // Pega a hora atual em segundos
    const idadeDaMensagem = tempoAtual - msg.timestamp; // Calcula a diferença

    // Se a mensagem for mais velha que 30 minutos (1800 segundos), ignora na hora
    if (idadeDaMensagem > 1800) {
      return;
    }
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
