const lobbyCmd = require("./lobby");
const playerCmd = require("./player");
const adminCmd = require("./admin");
const miscCmd = require("./misc");
const hltvCmd = require("./hltvCmd");

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

async function router(context) {
  try {
    const comando = context?.comando?.trim().toLowerCase();
    if (!comando) return;

    const nomeGrupo = context.nomeGrupo || context.groupId;
    console.log(
      `[${new Date().toLocaleTimeString()}] 🤖 Comando: ${comando} | De: ${context.nome} | Grupo: ${nomeGrupo}`,
    );
    const handler = COMMAND_MAP[comando];
    if (handler) {
      await handler(context);
    }
  } catch (err) {
    console.error("💥 ERRO NO ROUTER:", err.message);
  }
}

module.exports = router;
