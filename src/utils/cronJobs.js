const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { mencionarJogadores } = require("./mentions");
const { getDb } = require("../database");
const {
  verificarNovaAtualizacao,
  getGruposAutorizados,
  formatarAtualizacao,
} = require("../services/rssService");

let ultimaLimpeza = "";
let ultimaVerificacaoRSS = 0;
const INTERVALO_RSS_MS = 30 * 60 * 1000; // Verifica a cada 30 minutos

// Essa variável guarda os IDs das salas que já apitaram, para não virar spam
const lobbiesAvisadas = new Set();

// ─── Limpeza do banco HLTV ────────────────────────────────────────────────────
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

      // ---------------------------------------------------------
      // 📰 VERIFICAÇÃO DE PATCH NOTES DO CS2 (A cada 30 minutos)
      // ---------------------------------------------------------
      const agoraMs = Date.now();
      if (agoraMs - ultimaVerificacaoRSS >= INTERVALO_RSS_MS) {
        ultimaVerificacaoRSS = agoraMs;

        try {
          const novaAtualizacao = await verificarNovaAtualizacao();

          if (novaAtualizacao) {
            console.log(
              `📰 Nova atualização CS2 detectada: ${novaAtualizacao.title}`,
            );
            const grupos = await getGruposAutorizados();
            const mensagem = formatarAtualizacao(novaAtualizacao);

            for (const grupo of grupos) {
              try {
                await client.sendMessage(grupo.id_grupo, mensagem);
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
      // ⏰ ALARME DA HORA H
      // ---------------------------------------------------------
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
