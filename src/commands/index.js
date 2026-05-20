const lobbyCmd = require("./lobby");
const playerCmd = require("./player");
const adminCmd = require("./admin");
const miscCmd = require("./misc");
const hltvCmd = require("./hltvCmd");
const ownerCmd = require("./ownerCommands");
const grupoService = require("../services/grupoService");

const COMMAND_MAP = {
  "!lobby": lobbyCmd.criarLobby,
  "!mix": lobbyCmd.criarLobby,
  "!eu": playerCmd.entrar,
  "!sair": playerCmd.sair,
  "!start": adminCmd.start,
  "!cancelar": adminCmd.cancelar,
  "!horario": adminCmd.horario,
  "!titulo": adminCmd.titulo,
  "!meunick": miscCmd.meunick,
  "!status": miscCmd.status,
  "!comandos": miscCmd.comandos,
  "!silenciar": miscCmd.silenciar,
  "!notificar": miscCmd.notificar,
  "!kick": playerCmd.kick,
  "!setdiscord": adminCmd.setDiscord,
  "!discord": adminCmd.consultarDiscord,
  "!jogos": hltvCmd.listarJogos,
  "!jogosbr": hltvCmd.listarJogosBR,
  "!resultados": hltvCmd.listarResultados,
  "!resultadosbr": hltvCmd.listarResultadosBR,
  "!novidades": hltvCmd.listarNovidades,
  "!atualizarjogos": hltvCmd.atualizarJogosAdmin,
};

// Comandos exclusivos do owner no privado
const OWNER_COMMAND_MAP = {
  "!status": ownerCmd.statusGlobal,
  "!grupos": ownerCmd.listarGrupos,
  "!revogar": ownerCmd.revogarGrupo,
  "!cancelar": ownerCmd.cancelarRemoto,
  "!addadmin": ownerCmd.addAdmin,
  "!removeadmin": ownerCmd.removeAdmin,
  "!admins": ownerCmd.listarAdmins,
  "!logs": ownerCmd.logs,
  "!ajuda": ownerCmd.ownerHelp,
  "!aprovar": aprovarGrupo, // mantido aqui para centralizar tudo no router
};

// Função de aprovação inline — evita duplicar no bot.js
async function aprovarGrupo({ msg, parametro }) {
  if (!parametro) {
    return msg.reply(
      "⚠️ Informe o ID do grupo. Ex: *!aprovar 120363XXXXXXXXXX@g.us*",
    );
  }

  const groupId = parametro.trim();
  await grupoService.autorizarGrupo(groupId);
  await msg.reply(`✅ Grupo *${groupId}* autorizado com sucesso!`);
  console.log(`✅ Grupo autorizado pelo owner: ${groupId}`);
}

async function router(context) {
  try {
    const comando = context?.comando?.trim().toLowerCase();
    if (!comando) return;

    const nomeGrupo = context.nomeGrupo || context.groupId;
    console.log(
      `[${new Date().toLocaleTimeString()}] 🤖 Comando: ${comando} | De: ${context.nome} | Grupo: ${nomeGrupo}`,
    );

    // ─── Fluxo de DM (owner) ────────────────────────────────────────────────
    if (!context.isGroup) {
      const handler = OWNER_COMMAND_MAP[comando];
      if (handler) {
        await handler(context);
      } else {
        await context.msg.reply(
          "Comando não reconhecido. Use *!ajuda* para ver os comandos disponíveis.",
        );
      }
      return;
    }

    // ─── Fluxo normal de grupos ─────────────────────────────────────────────
    const handler = COMMAND_MAP[comando];
    if (handler) {
      await handler(context);
    }
  } catch (err) {
    console.error("💥 ERRO NO ROUTER:", err.message);
  }
}

module.exports = router;
