const fs = require("fs");
const path = require("path");
const partidaService = require("../services/partidaService");
const grupoService = require("../services/grupoService");
const adminService = require("../services/adminService");

const LOG_OUT = path.join(process.env.HOME, ".pm2/logs/bot-cs2-out.log");
const LOG_ERROR = path.join(process.env.HOME, ".pm2/logs/bot-cs2-error.log");
const LINHAS_DEFAULT = 20;

async function statusGlobal({ msg, client }) {
  const grupos = await grupoService.getGruposAutorizados();
  const linhas = [];

  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i];
    const abertas = await partidaService.getPartidasAbertas(grupo.id_grupo);
    if (abertas.length === 0) continue;

    let nomeGrupo = grupo.id_grupo;
    try {
      const chat = await client.getChatById(grupo.id_grupo);
      nomeGrupo = chat.name || grupo.id_grupo;
    } catch (e) {}

    linhas.push(`#${i + 1} *${nomeGrupo}*`);
    for (const p of abertas) {
      const titulares = await partidaService.contarTitulares(p.id);
      const infoData = p.data_partida ? ` 📅 ${p.data_partida}` : "";
      const infoHora = p.horario ? ` às ${p.horario}` : "";
      linhas.push(
        `  • Lobby #${p.numero_lobby} - ${p.titulo}${infoData}${infoHora} (${titulares}/${p.max_players})`,
      );
    }
  }

  if (linhas.length === 0) {
    return msg.reply("🟢 Nenhuma lobby aberta em nenhum grupo no momento.");
  }

  await msg.reply(`📊 *STATUS GLOBAL*\n\n${linhas.join("\n")}`);
}

async function listarGrupos({ msg, client }) {
  const grupos = await grupoService.getGruposAutorizados();

  if (grupos.length === 0) {
    return msg.reply("Nenhum grupo autorizado no momento.");
  }

  const linhas = [];
  for (let i = 0; i < grupos.length; i++) {
    let nome = grupos[i].id_grupo;
    try {
      const chat = await client.getChatById(grupos[i].id_grupo);
      nome = chat.name || grupos[i].id_grupo;
    } catch (e) {}
    linhas.push(`${i + 1}. *${nome}*`);
  }

  await msg.reply(
    `📋 *GRUPOS AUTORIZADOS*\n\n${linhas.join("\n")}\n\nUse o número para cancelar: *!cancelar 2 1*`,
  );
}

async function revogarGrupo({ msg, parametro }) {
  if (!parametro) {
    return msg.reply("⚠️ Informe o ID do grupo. Ex: *!revogar 120363XXX@g.us*");
  }

  await grupoService.revogarGrupo(parametro.trim());
  await msg.reply(`🚫 Grupo *${parametro.trim()}* revogado com sucesso.`);
}

// Aceita numero sequencial do !grupos (ex: !cancelar 2 1)
// ou ID completo (ex: !cancelar 120363XXX@g.us 1)
async function cancelarRemoto({ msg, parametro, client }) {
  if (!parametro) {
    return msg.reply(
      "⚠️ Use: *!cancelar [#grupo] [lobby]*\n" +
        "Ex: *!cancelar 2 1* (grupo #2 da lista, lobby #1)\n" +
        "Use *!grupos* para ver os números",
    );
  }

  const tokens = parametro.trim().split(" ");
  if (tokens.length < 2) {
    return msg.reply(
      "⚠️ Informe o grupo e o número da lobby.\n" +
        "Ex: *!cancelar 2 1* — use *!grupos* para ver os números",
    );
  }

  const grupoToken = tokens[0];
  const numero = parseInt(tokens[1]);

  if (isNaN(numero)) {
    return msg.reply("⚠️ Número de lobby inválido.");
  }

  // Resolve groupId: número sequencial ou ID completo
  let groupId = grupoToken;
  const indice = parseInt(grupoToken);

  if (!isNaN(indice) && !grupoToken.includes("@")) {
    const grupos = await grupoService.getGruposAutorizados();
    const grupo = grupos[indice - 1];
    if (!grupo) {
      return msg.reply(
        `⚠️ Grupo #${indice} não encontrado. Use *!grupos* para ver a lista.`,
      );
    }
    groupId = grupo.id_grupo;
  }

  const partida = await partidaService.getPartidaPorLobby(groupId, numero);
  if (!partida) {
    return msg.reply(`⚠️ Lobby #${numero} não encontrada no grupo informado.`);
  }

  await partidaService.cancelarPartida(partida.id);

  // Notifica no grupo para a galera saber
  try {
    await client.sendMessage(
      groupId,
      `🛑 *Partida #${partida.numero_lobby} cancelada pelo administrador.* A fila foi resetada!`,
    );
  } catch (e) {
    console.error(
      "⚠️ Erro ao notificar grupo sobre cancelamento remoto:",
      e.message,
    );
  }

  await msg.reply(
    `🛑 Lobby #${numero} (*${partida.titulo}*) cancelada e grupo notificado.`,
  );
}

async function addAdmin({ msg, parametro, client }) {
  if (!parametro) {
    return msg.reply("⚠️ Informe o número. Ex: *!addadmin 5512999999999*");
  }

  const numero = parametro.trim().replace("@c.us", "");
  if (!/^\d+$/.test(numero)) {
    return msg.reply(
      "⚠️ Número inválido. Use apenas dígitos. Ex: *!addadmin 5512999999999*",
    );
  }

  const waId = `${numero}@c.us`;
  await adminService.adicionarSuperAdmin(waId);

  let nome = waId;
  try {
    const contact = await client.getContactById(waId);
    nome = contact.pushname || contact.name || waId;
  } catch (e) {}

  await msg.reply(`✅ *${nome}* adicionado como superadmin.`);
  console.log(`[ADMIN] Superadmin adicionado: ${waId}`);
}

async function removeAdmin({ msg, parametro }) {
  if (!parametro) {
    return msg.reply("⚠️ Informe o número. Ex: *!removeadmin 5512999999999*");
  }

  const numero = parametro.trim().replace("@c.us", "");
  if (!/^\d+$/.test(numero)) {
    return msg.reply("⚠️ Número inválido.");
  }

  const waId = `${numero}@c.us`;
  await adminService.removerSuperAdmin(waId);
  await msg.reply(`🗑️ Superadmin *${waId}* removido.`);
  console.log(`[ADMIN] Superadmin removido: ${waId}`);
}

async function listarAdmins({ msg, client }) {
  const lista = await adminService.listarSuperAdmins();

  if (lista.length === 0) {
    return msg.reply("Nenhum superadmin cadastrado além de você.");
  }

  const linhas = [];
  for (let i = 0; i < lista.length; i++) {
    let nome = lista[i].id;
    try {
      const contact = await client.getContactById(lista[i].id);
      nome = contact.pushname || contact.name || lista[i].id;
    } catch (e) {}
    linhas.push(`${i + 1}. *${nome}* — desde ${lista[i].atribuido_em}`);
  }

  await msg.reply(`👑 *SUPERADMINS*\n\n${linhas.join("\n")}`);
}

async function logs({ msg, parametro }) {
  const tokens = (parametro || "").trim().split(" ");
  const tipo = tokens[0]?.toLowerCase();
  const linhas = parseInt(tokens[1]) || LINHAS_DEFAULT;

  const logPath = tipo === "error" ? LOG_ERROR : LOG_OUT;
  const tipoLabel = tipo === "error" ? "error" : "out";

  try {
    if (!fs.existsSync(logPath)) {
      return msg.reply(`⚠️ Arquivo de log não encontrado: ${logPath}`);
    }

    const conteudo = fs.readFileSync(logPath, "utf8").split("\n");
    const ultimas = conteudo
      .filter((l) => l.trim())
      .slice(-linhas)
      .join("\n");

    if (!ultimas) {
      return msg.reply("📄 Log vazio.");
    }

    const texto =
      ultimas.length > 3000
        ? "...(truncado)\n" + ultimas.slice(-3000)
        : ultimas;

    await msg.reply(
      `📄 *LOG ${tipoLabel.toUpperCase()} (últimas ${linhas} linhas)*\n\n${texto}`,
    );
  } catch (e) {
    await msg.reply(`❌ Erro ao ler log: ${e.message}`);
  }
}

async function ownerHelp({ msg }) {
  const texto = [
    "🔐 *COMANDOS DO OWNER*",
    "",
    "📊 *Visibilidade:*",
    "*!status* — lobbies abertas em todos os grupos",
    "*!grupos* — grupos autorizados numerados",
    "*!admins* — superadmins cadastrados",
    "*!logs [out|error] [N]* — últimas N linhas do log",
    "",
    "⚙️ *Ações remotas:*",
    "*!aprovar [groupId]* — autoriza um grupo",
    "*!revogar [groupId]* — revoga um grupo",
    "*!cancelar [#grupo] [lobby]* — cancela lobby (ex: !cancelar 2 1)",
    "",
    "👑 *Gestão de superadmins:*",
    "*!addadmin [numero]* — adiciona superadmin",
    "*!removeadmin [numero]* — remove superadmin",
  ].join("\n");

  await msg.reply(texto);
}

module.exports = {
  statusGlobal,
  listarGrupos,
  revogarGrupo,
  cancelarRemoto,
  addAdmin,
  removeAdmin,
  listarAdmins,
  logs,
  ownerHelp,
};
