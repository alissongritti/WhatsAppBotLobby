const { getDb } = require("../database");

async function resolverNomeJogador(jogadorId) {
  const db = getDb();
  const nickRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
    jogadorId,
  ]);
  if (nickRow) return nickRow.nome;

  try {
    const { getClient } = require("../bot");
    const contact = await getClient().getContactById(jogadorId);
    return contact.pushname || contact.name || contact.number;
  } catch (e) {
    console.error("⚠️ Erro ao buscar contato no WhatsApp:", e.message);
    return "Jogador";
  }
}

/**
 * Gera o texto completo da lista de uma partida.
 *
 * @param {number} partidaId
 * @param {number} maxPlayers
 * @param {string|null} dataHoje - "DD/MM" de hoje. Se fornecido e a partida
 *   tiver data_partida diferente, exibe o prefixo 📅. Evita duplicar no !status.
 */
async function gerarListaTexto(partidaId, maxPlayers, dataHoje = null) {
  const db = getDb();

  const partida = await db.get(
    "SELECT tipo, numero_lobby, titulo, horario, data_partida FROM partidas WHERE id = ?",
    [partidaId],
  );

  const jogadores = await db.all(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR' ORDER BY id ASC",
    [partidaId],
  );
  const suplentes = await db.all(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'SUPLENTE' ORDER BY id ASC",
    [partidaId],
  );

  const todosIds = [...jogadores, ...suplentes].map((j) => j.jogador_id);
  const placeholders = todosIds.map(() => "?").join(",");
  const nicksRows =
    todosIds.length > 0
      ? await db.all(
          `SELECT id, nome FROM nicks WHERE id IN (${placeholders})`,
          todosIds,
        )
      : [];

  const nicksMap = Object.fromEntries(nicksRows.map((r) => [r.id, r.nome]));
  const resolverNome = async (jogadorId) => {
    if (nicksMap[jogadorId]) return nicksMap[jogadorId];
    return resolverNomeJogador(jogadorId);
  };

  let texto = "";

  if (partida) {
    // Prefixo de data — só quando a partida é futura e foi passado dataHoje
    const ehFutura =
      partida.data_partida && dataHoje && partida.data_partida !== dataHoje;

    if (ehFutura) {
      texto += `📅 *${partida.data_partida}`;
      if (partida.horario) texto += ` às ${partida.horario}`;
      texto += `*\n`;
    }

    texto += `🎮 *${partida.tipo} #${partida.numero_lobby}: ${partida.titulo}* 🎮\n`;

    // Horário só aparece uma vez — e só se não estiver no prefixo de data
    if (partida.horario && !ehFutura) {
      texto += `⏰ *Horário:* ${partida.horario}\n`;
    }

    texto += `\n`;
  }

  for (let i = 0; i < maxPlayers; i++) {
    if (jogadores[i]) {
      const nome = await resolverNome(jogadores[i].jogador_id);
      texto += `${i + 1}. ${nome}\n`;
    } else {
      texto += `${i + 1}. \n`;
    }
  }

  if (suplentes.length > 0) {
    texto += `\n🔄 *SUPLENTES:*\n`;
    for (let i = 0; i < suplentes.length; i++) {
      const nome = await resolverNome(suplentes[i].jogador_id);
      texto += `S${i + 1}. ${nome}\n`;
    }
  }

  return texto;
}

module.exports = { gerarListaTexto, resolverNomeJogador };
