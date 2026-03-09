const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { mencionarJogadores } = require("./mentions");
const { getDb } = require("../database");

let ultimaLimpeza = "";

// Essa variável guarda os IDs das salas que já apitaram, para não virar spam
const lobbiesAvisadas = new Set();

// ─── Limpeza do banco HLTV ────────────────────────────────────────────────────
// Remove jogos e resultados do dia anterior e força atualização na próxima consulta
async function limparCacheHltv() {
  const db = getDb();
  await db.run("DELETE FROM hltv_jogos");
  await db.run("DELETE FROM hltv_resultados");
  console.log("🧹 Cache HLTV limpo! Será atualizado na próxima consulta.");
}

function iniciarCronJobs(client) {
  setInterval(async () => {
    try {
      const agora = new Date();
      const horaAtual =
        agora.getHours().toString().padStart(2, "0") +
        ":" +
        agora.getMinutes().toString().padStart(2, "0");

      const abertas = await partidaService.getTodasPartidasComHorario();

      // ---------------------------------------------------------
      // 🧹 A VASSOURA INTELIGENTE (Roda todo dia às 05:00 da manhã)
      // ---------------------------------------------------------
      const dataDeHoje = agora.toLocaleDateString();
      if (horaAtual === "05:00" && ultimaLimpeza !== dataDeHoje) {
        await partidaService.limparPartidasEsquecidas();
        await limparCacheHltv();
        ultimaLimpeza = dataDeHoje;
        console.log(
          `🧹 [${dataDeHoje}] Vassoura passou! Lobbies e cache HLTV limpos.`,
        );
      }

      for (const partida of abertas) {
        if (partida.horario === horaAtual && !lobbiesAvisadas.has(partida.id)) {
          const idDoGrupo = partida.grupo_id || partida.group_id;

          if (!idDoGrupo) {
            console.log(
              `⚠️ Partida #${partida.id} está sem ID do grupo no banco de dados!`,
            );
            continue;
          }

          const chat = await client.getChatById(idDoGrupo);
          const titulares = await jogadorService.getTitulares(partida.id);

          if (titulares.length > 0) {
            const mentionsIds = titulares.map((t) => t.jogador_id);
            // Limite dinâmico: Mix precisa de 10, Lobby de 5
            const limiteJogadores = partida.tipo === "MIX" ? 10 : 5;
            const tipo = partida.tipo; // "MIX" ou "LOBBY"

            let mensagem;
            if (titulares.length >= limiteJogadores) {
              // Sala completa
              mensagem =
                `⏰ *TÁ NA HORA!* ⏰\n` +
                `O ${tipo} #${partida.numero_lobby} (${partida.titulo}) estava marcado para as *${partida.horario}*!\n\n` +
                `Bora pro jogo, titulares! Mandem *!start* para fechar a sala.`;
            } else {
              // Sala incompleta
              mensagem =
                `⏰ *Chegou o horário do ${tipo} #${partida.numero_lobby}, mas ainda faltam jogadores!* ` +
                `(${titulares.length}/${limiteJogadores})\n\n` +
                `Mandem *!start* para jogar assim mesmo ou *!cancelar* para liberar a fila.`;
            }

            await mencionarJogadores(chat, mensagem, mentionsIds);
          }

          lobbiesAvisadas.add(partida.id);
        } else if (partida.horario !== horaAtual) {
          lobbiesAvisadas.delete(partida.id);
        }
      }
    } catch (err) {
      console.error("⚠️ Erro no Cron Job de Alarme:", err.message);
    }
  }, 60000);
}

module.exports = { iniciarCronJobs };