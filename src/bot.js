const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { parseMessage } = require("./utils/messageParser");
const router = require("./commands/index");
const { iniciarCronJobs } = require("./utils/cronJobs");
const {
  isGrupoAutorizado,
  autorizarGrupo,
} = require("./services/grupoService");

const ADMIN_WA_ID = process.env.ADMIN_WA_ID;

// Guarda IDs de grupos que já notificamos o admin — evita spam de DM
// O Set é limpo quando o bot reinicia, o que é suficiente para o caso de uso
const gruposJaNotificados = new Set();

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
    const tempoAtual = Math.floor(Date.now() / 1000);
    const idadeDaMensagem = tempoAtual - msg.timestamp;
    if (idadeDaMensagem > 1800) return;

    try {
      const chat = await msg.getChat();

      // ─── 1. Comando !aprovar via DM (só o admin) ─────────────────────────────
      if (!chat.isGroup) {
        const contact = await msg.getContact();
        const isAdmin = contact.id._serialized === ADMIN_WA_ID;
        const textoLower = msg.body.toLowerCase().trim();

        if (isAdmin && textoLower.startsWith("!aprovar")) {
          const groupId = msg.body.split(" ")[1]?.trim();

          if (!groupId) {
            await msg.reply(
              "⚠️ Informe o ID do grupo. Ex: *!aprovar 120363XXXXXXXXXX@g.us*",
            );
            return;
          }

          await autorizarGrupo(groupId);
          gruposJaNotificados.delete(groupId);

          await msg.reply(`✅ Grupo *${groupId}* autorizado com sucesso!`);
          console.log(`✅ Grupo autorizado pelo admin: ${groupId}`);
        }
        return; // DMs morrem aqui, não processamos comandos normais no privado
      }

      // ─── 2. FILTRO BARATO: É um comando válido? ──────────────────────────────
      // Isso evita que mensagens comuns ("bom dia", "kkk") batam no banco de dados
      const context = await parseMessage(msg, chat);
      if (!context) return;

      // ─── 3. FILTRO CARO: O grupo tem autorização? ────────────────────────────
      // Só chega aqui se o usuário realmente digitou algo como !lobby, !jogos, etc.
      const groupId = chat.id._serialized;
      const autorizado = await isGrupoAutorizado(groupId);

      if (!autorizado) {
        if (ADMIN_WA_ID && !gruposJaNotificados.has(groupId)) {
          gruposJaNotificados.add(groupId);
          try {
            console.log(
              `🚨 Grupo não autorizado tentou usar o bot: ${chat.name} | ${groupId}`,
            );
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
        return; // Morre silenciosamente no grupo não autorizado
      }

      // ─── 4. Execução do Comando ──────────────────────────────────────────────
      await router(context);
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
