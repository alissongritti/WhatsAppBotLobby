const { getDb } = require("../database");

// Mapa de aliases para comandos canônicos
const COMMAND_ALIASES = {
  "!lobby": "!lobby",
  "!mix": "!mix",
  "!eu": "!eu",
  "!entrar": "!eu",
  "!join": "!eu",
  "!sair": "!sair",
  "!quit": "!sair",
  "!horario": "!horario",
  "!horário": "!horario",
  "!horas": "!horario",
  "!hrs": "!horario",
  "!titulo": "!titulo",
  "!título": "!titulo",
  "!meunick": "!meunick",
  "!nick": "!meunick",
  "!cancelar": "!cancelar",
  "!fechar": "!cancelar",
  "!drop": "!cancelar",
  "!status": "!status",
  "!lista": "!status",
  "!start": "!start",
  "!comandos": "!comandos",
  "!help": "!comandos",
  "!ajuda": "!comandos",
  "!silenciar": "!silenciar",
  "!notificar": "!notificar",
  "!kick": "!kick",
  "!discord": "!discord",
  "!setdiscord": "!setdiscord",
  "!jogos": "!jogos",
  "!jogosbr": "!jogosbr",
  "!resultados": "resultados",
};

async function parseMessage(msg, chat) {
  const textoLower = msg.body.toLowerCase().trim();

  // Encontra qual alias bate com o início da mensagem
  const aliasEncontrado = Object.keys(COMMAND_ALIASES)
    .sort((a, b) => b.length - a.length) // mais longos primeiro
    .find((alias) => textoLower.startsWith(alias));
  if (!aliasEncontrado) return null;

  const comando = COMMAND_ALIASES[aliasEncontrado];
  let parametro = msg.body.substring(aliasEncontrado.length).trim();

  // Limpa menções do parâmetro para comandos que usam título
  if (["!lobby", "!mix", "!titulo"].includes(comando) && parametro) {
    parametro = await resolverMencoes(parametro, msg);
  }

  const contact = await msg.getContact();
  const senderId = contact.id._serialized;

  const db = getDb();
  const nickRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
    senderId,
  ]);
  const nome = nickRow ? nickRow.nome : contact.pushname || contact.number;

  return {
    msg,
    chat,
    comando,
    parametro,
    senderId,
    nome,
    groupId: chat.id._serialized,
  };
}

async function resolverMencoes(parametro, msg) {
  const db = getDb();
  const mentions = await msg.getMentions();
  if (!mentions || mentions.length === 0) return parametro;

  const IDsNoTexto = parametro.match(/@\d+/g);
  if (!IDsNoTexto) return parametro;

  for (let i = 0; i < IDsNoTexto.length; i++) {
    const m = mentions[i];
    if (!m) continue;
    const mRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
      m.id._serialized,
    ]);
    const mNome = mRow ? mRow.nome : m.pushname || m.name || "Jogador";
    parametro = parametro.replace(IDsNoTexto[i], mNome);
  }

  return parametro;
}

module.exports = { parseMessage };
