const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { gerarListaTexto } = require("../utils/listFormatter");
const { marcarTodos, mencionarJogadores } = require("../utils/mentions");

async function criarLobby({ msg, chat, comando, parametro, senderId, groupId }) {
  // Regra da monogamia: jogador não pode estar em duas partidas
  const jaEstaEmLobby = await partidaService.getPartidaDoJogador(groupId, senderId);
  if (jaEstaEmLobby) {
    await msg.reply(
      `🚨 Emocionado! Você já está na *Lobby #${jaEstaEmLobby.numero_lobby}: ${jaEstaEmLobby.titulo}*. Mande *!sair* dela primeiro se quiser entrar ou criar outra.`
    );
    return;
  }

  // Trava: só bloqueia se alguma lobby ainda tiver vaga de titular
  const lobbiesAbertas = await partidaService.getPartidasAbertas(groupId);
  if (lobbiesAbertas.length > 0) {
    for (const lobby of lobbiesAbertas) {
      const numTitulares = await partidaService.contarTitulares(lobby.id);
      if (numTitulares < lobby.max_players) {
        await msg.reply(
          `Calma lá! A Lobby #${lobby.numero_lobby} ainda tem vagas para o time titular.\nMande *!eu ${lobby.numero_lobby}* para entrar nela antes de tentar criar outra.`
        );
        return;
      }
    }
  }

  // Parse dos parâmetros (horário e título)
  const isMix = comando === "!mix";
  let horario = "";
  let titulo = isMix ? "MIX 5x5" : "LOBBY";

  if (parametro) {
    const primeiraPalavra = parametro.split(" ")[0];
    if (/^\d/.test(primeiraPalavra)) {
      horario = primeiraPalavra;
      const resto = parametro.substring(primeiraPalavra.length).trim();
      if (resto) titulo = resto.toUpperCase();
    } else {
      titulo = parametro.toUpperCase();
    }
  }

  const maxPlayers = isMix ? 10 : 5;
  const tipo = isMix ? "MIX" : "LOBBY";
  const numeroLobby = await partidaService.gerarNumeroLobbyDisponivel(groupId);

  const result = await partidaService.criarPartida({
    groupId,
    senderId,
    titulo,
    horario,
    tipo,
    maxPlayers,
    numeroLobby,
  });

  const partidaId = result.lastID;
  await jogadorService.adicionarJogador(partidaId, senderId, "TITULAR");

  let texto = `🎮 *${tipo} #${numeroLobby}: ${titulo} - ABERTA* 🎮\n`;
  if (horario) texto += `⏰ *Horário:* ${horario}\n`;
  texto += `\n${await gerarListaTexto(partidaId, maxPlayers)}`;
  texto += `\nMande *!eu ${numeroLobby}* para entrar!`;

  await marcarTodos(chat, texto);

  // Avisa suplentes de outras lobbies sobre a nova vaga
  const suplentesOutras = await partidaService.getSuplentesDeOutrasPartidas(groupId, partidaId);
  if (suplentesOutras.length > 0) {
    const aviso =
      `👀 *Atenção Reservas!*\nA Lobby #${numeroLobby} acabou de ser criada com vagas para titulares!\n\n` +
      `Se quiserem sair do banco e jogar nesta nova, mandem:\n*!sair* (para sair da atual)\ne depois *!eu ${numeroLobby}*`;
    await mencionarJogadores(chat, aviso, suplentesOutras.map((s) => s.jogador_id));
  }
}

module.exports = { criarLobby };
