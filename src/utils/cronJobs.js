const partidaService = require("../services/partidaService");
const jogadorService = require("../services/jogadorService");
const { mencionarJogadores } = require("./mentions");

let ultimaLimpeza = "";

// Essa variável guarda os IDs das salas que já apitaram, para não virar spam
const lobbiesAvisadas = new Set();

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
        ultimaLimpeza = dataDeHoje;
        console.log(
          `🧹 [${dataDeHoje}] Vassoura passou! Lobbies de ontem foram canceladas.`,
        );
      }

      for (const partida of abertas) {
        // Se a hora do relógio bater com a hora da sala E a gente ainda não avisou
        if (partida.horario === horaAtual && !lobbiesAvisadas.has(partida.id)) {
          // Prepara para avisar a galera
          // Tenta pegar o ID do grupo (seja em inglês ou português)
          const idDoGrupo = partida.grupo_id || partida.group_id;

          // Se por algum motivo o banco não salvou o ID do grupo, ignora pra não crashar o bot
          if (!idDoGrupo) {
            console.log(
              `⚠️ Partida #${partida.id} está sem ID do grupo no banco de dados!`,
            );
            continue;
          }

          // Prepara para avisar a galera
          const chat = await client.getChatById(idDoGrupo);
          const titulares = await jogadorService.getTitulares(partida.id);

          if (titulares.length > 0) {
            const mentionsIds = titulares.map((t) => t.jogador_id);
            const msg = `⏰ *TÁ NA HORA!* ⏰\nA Lobby #${partida.numero_lobby} (${partida.titulo}) estava marcada para as *${partida.horario}*!\n\nBora pro jogo, titulares! (Não esqueçam de mandar *!start* quando fechar a sala).`;

            // Apita o celular cirurgicamente só dos titulares
            await mencionarJogadores(chat, msg, mentionsIds);
          }

          // Marca que já avisou pra não mandar de novo no próximo segundo
          lobbiesAvisadas.add(partida.id);
        } else if (partida.horario !== horaAtual) {
          // Se não é a hora, ou se o admin mudou a hora da sala, tira ela da lista de avisadas
          lobbiesAvisadas.delete(partida.id);
        }
      }
    } catch (err) {
      console.error("⚠️ Erro no Cron Job de Alarme:", err.message);
    }
  }, 60000); // 60.000 ms = 1 minuto
}

module.exports = { iniciarCronJobs };
