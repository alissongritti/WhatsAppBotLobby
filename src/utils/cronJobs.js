const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const statsService = require("../services/statsService");
const { mencionarJogadores } = require("./mentions");
const { getDb } = require("../database");
const {
  verificarNovaAtualizacao,
  getGruposAutorizados,
} = require("../services/rssService");

let ultimaLimpeza = "";
let ultimaVerificacaoRSS = 0;
const INTERVALO_RSS_MS = 30 * 60 * 1000;

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

      const dataHoje =
        agora.getDate().toString().padStart(2, "0") +
        "/" +
        (agora.getMonth() + 1).toString().padStart(2, "0");

      const abertas = await partidaService.getTodasPartidasComHorario();

      // ---------------------------------------------------------
      // 🧹 VASSOURA INTELIGENTE (05:00 — preserva agendadas futuras)
      // ---------------------------------------------------------
      const dataDeHoje = agora.toLocaleDateString();
      if (horaAtual === "05:00" && ultimaLimpeza !== dataDeHoje) {
        await partidaService.limparPartidasEsquecidas();
        await limparCacheHltv();
        ultimaLimpeza = dataDeHoje;
        console.log(
          `🧹 [${dataDeHoje}] Vassoura passou! Lobbies sem data futura e cache HLTV limpos.`,
        );
      }

      // ---------------------------------------------------------
      // 📰 VERIFICAÇÃO DE PATCH NOTES DO CS2 (A cada 30 minutos)
      // ---------------------------------------------------------
      const agoraMs = Date.now();
      if (agoraMs - ultimaVerificacaoRSS >= INTERVALO_RSS_MS) {
        ultimaVerificacaoRSS = agoraMs;

        try {
          const resumoPronto = await verificarNovaAtualizacao();

          if (resumoPronto) {
            console.log(
              `📰 Notificando grupos sobre nova atualização do CS2...`,
            );
            const grupos = await getGruposAutorizados();

            for (const grupo of grupos) {
              try {
                await client.sendMessage(grupo.id_grupo, resumoPronto);
              } catch (e) {
                console.error(
                  `⚠️ Erro ao notificar grupo ${grupo.id_grupo}:`,
                  e.message,
                );
              }
            }
          }
        } catch (e) {
          console.error("⚠️ Erro ao verificar RSS do CS2:", e.message);
        }
      }

      // ---------------------------------------------------------
      // ⏰ ALARME DA HORA H (considera data_partida)
      // ---------------------------------------------------------
      for (const partida of abertas) {
        if (partida.data_partida && partida.data_partida !== dataHoje) continue;
        if (partida.horario > horaAtual) continue;

        const idDoGrupo = partida.grupo_id || partida.group_id;

        if (!idDoGrupo) {
          console.log(
            `⚠️ Partida #${partida.id} está sem ID do grupo no banco de dados!`,
          );
          await partidaService.marcarAlarmeDisparado(partida.id);
          continue;
        }

        const chat = await client.getChatById(idDoGrupo);
        const titulares = await jogadorService.getTitulares(partida.id);
        const limiteJogadores = partida.tipo === "MIX" ? 10 : 5;
        const tipo = partida.tipo;

        const mentionsIds = titulares.map((t) => t.jogador_id);

        if (titulares.length >= limiteJogadores) {
          // ─── START AUTOMÁTICO ────────────────────────────────────────────
          const ids = titulares.map((t) => t.jogador_id);
          await partidaService.concluirPartida(partida.id);
          await statsService.registrarPartidaJogada(ids);

          const mensagem =
            `🚀 *PARTIDA INICIADA AUTOMATICAMENTE!* 🚀\n\n` +
            `O ${tipo} #${partida.numero_lobby} (*${partida.titulo}*) estava marcado para as *${partida.horario}* e o time estava completo!\n\n` +
            `📈 *+1 partida contabilizada para todos os titulares!*\n` +
            `🎮 Bora pro jogo, galera!`;

          await mencionarJogadores(chat, mensagem, mentionsIds);
          console.log(
            `🚀 Start automático: partida #${partida.numero_lobby} (${partida.horario}) — ${titulares.length}/${limiteJogadores}`,
          );
        } else {
          // ─── TIME INCOMPLETO — aviso mais chamativo ───────────────────────
          const mensagem =
            `⏰ *HORA H!* ⏰\n\n` +
            `O ${tipo} #${partida.numero_lobby} (*${partida.titulo}*) era pras *${partida.horario}* mas o time ainda tá incompleto! ` +
            `(${titulares.length}/${limiteJogadores})\n\n` +
            `⚠️ *A lobby não fecha sozinha quando está incompleta.*\n\n` +
            `👉 *!start* — jogar assim mesmo e fechar a sala\n` +
            `👉 *!cancelar* — liberar a fila`;

          await mencionarJogadores(chat, mensagem, mentionsIds);
          console.log(
            `⏰ Alarme disparado (incompleto): partida #${partida.numero_lobby} (${titulares.length}/${limiteJogadores})`,
          );
        }

        await partidaService.marcarAlarmeDisparado(partida.id);
      }
    } catch (err) {
      console.error("⚠️ Erro no Cron Job de Alarme:", err.message);
    }
  }, 60000);
}

module.exports = { iniciarCronJobs };
