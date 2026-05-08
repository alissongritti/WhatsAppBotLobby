const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
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

      // "DD/MM" de hoje
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
        // Se a partida tem data_partida e não é hoje → pula
        if (partida.data_partida && partida.data_partida !== dataHoje) {
          continue;
        }

        // Só dispara quando o horário chegou (igual ao comportamento anterior)
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

        if (titulares.length > 0) {
          const mentionsIds = titulares.map((t) => t.jogador_id);
          const limiteJogadores = partida.tipo === "MIX" ? 10 : 5;
          const tipo = partida.tipo;

          let mensagem;
          if (titulares.length >= limiteJogadores) {
            mensagem =
              `⏰ *TÁ NA HORA!* ⏰\n` +
              `O ${tipo} #${partida.numero_lobby} (${partida.titulo}) estava marcado para as *${partida.horario}*!\n\n` +
              `Bora pro jogo, titulares! Mandem *!start* para fechar a sala.`;
          } else {
            mensagem =
              `⏰ *Chegou o horário do ${tipo} #${partida.numero_lobby}, mas ainda faltam jogadores!* ` +
              `(${titulares.length}/${limiteJogadores})\n\n` +
              `Mandem *!start* para jogar assim mesmo ou *!cancelar* para liberar a fila.`;
          }

          await mencionarJogadores(chat, mensagem, mentionsIds);
        }

        await partidaService.marcarAlarmeDisparado(partida.id);
        console.log(
          `⏰ Alarme disparado para partida #${partida.numero_lobby} (${partida.data_partida ?? "hoje"} ${partida.horario})`,
        );
      }
    } catch (err) {
      console.error("⚠️ Erro no Cron Job de Alarme:", err.message);
    }
  }, 60000);
}

module.exports = { iniciarCronJobs };
