const lobbyCmd = require("./lobby");

const playerCmd = require("./player");

const adminCmd = require("./admin");

const miscCmd = require("./misc");

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

  "!kickar": playerCmd.kickar,
};

async function router(context) {
  const handler = COMMAND_MAP[context.comando];

  if (handler) {
    await handler(context);
  }
}

module.exports = router;
