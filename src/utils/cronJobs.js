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
  // Esse código roda automaticamente a cada 60000 milissegundos (1 minuto)
  setInterval(async () => {
    try {
      // 1. Descobre que horas são agora (formato HH:mm)
      const agora = new Date();
      const horaAtual =
        agora.getHours().toString().padStart(2, "0") +
        ":" +
        agora.getMinutes().toString().padStart(2, "0");

      // 2. Puxa do banco todas as salas que têm horário marcado
      const abertas = await partidaService.getTodasPartidasComHorario();

      // ---------------------------------------------------------
      // 🧹 A VASSOURA INTELIGENTE (Roda todo dia às 05:00 da manhã)
      // ---------------------------------------------------------
      const dataDeHoje = agora.toLocaleDateString();
      if (horaAtual === "05:00" && ultimaLimpeza !== dataDeHoje) {
        await partidaService.limparPartidasEsquecidas();
        await limparCacheHltv(); // Limpa jogos/resultados do dia anterior
        ultimaLimpeza = dataDeHoje;
        console.log(
          `🧹 [${dataDeHoje}] Vassoura passou! Lobbies e cache HLTV limpos.`,
        );
      }

      for (const partida of abertas) {
        // Se a hora do relógio bater com a hora da sala E a gente ainda não avisou
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
            const msg = `⏰ *TÁ NA HORA!* ⏰\nA Lobby #${partida.numero_lobby} (${partida.titulo}) estava marcada para as *${partida.horario}*!\n\nBora pro jogo, titulares! (Não esqueçam de mandar *!start* quando fechar a sala).`;

            await mencionarJogadores(chat, msg, mentionsIds);
          }

          lobbiesAvisadas.add(partida.id);
        } else if (partida.horario !== horaAtual) {
          lobbiesAvisadas.delete(partida.id);
        }
      }
    } catch (err) {
      console.error("⚠️ Erro no Cron Job de Alarme:", err.message);
    }
  }, 60000); // 60.000 ms = 1 minuto
}

module.exports = { iniciarCronJobs };
