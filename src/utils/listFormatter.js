const { getDb } = require("../database");

async function resolverNomeJogador(jogadorId) {
  const db = getDb();

  // 1. Tenta achar o Nick no banco de dados primeiro
  const nickRow = await db.get("SELECT nome FROM nicks WHERE id = ?", [
    jogadorId,
  ]);
  if (nickRow) return nickRow.nome;

  // 2. Se não tem Nick, busca o nome do WhatsApp
  try {
    // 🔥 O TRUQUE AQUI: Lazy Loading! Importa o bot só na hora exata de usar.
    const { getClient } = require("../bot");

    const contact = await getClient().getContactById(jogadorId);
    return contact.pushname || contact.name || contact.number;
  } catch (e) {
    console.error("⚠️ Erro ao buscar contato no WhatsApp:", e.message);
    return "Jogador";
  }
}

async function gerarListaTexto(partidaId, maxPlayers) {
  const db = getDb();

  // Busca titulares e suplentes em apenas 2 queries
  const jogadores = await db.all(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'TITULAR' ORDER BY id ASC",
    [partidaId],
  );
  const suplentes = await db.all(
    "SELECT jogador_id FROM jogadores_partida WHERE partida_id = ? AND papel = 'SUPLENTE' ORDER BY id ASC",
    [partidaId],
  );

  // Busca todos os nicks de uma vez só (Performance)
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

  // Monta nomes (com fallback para WhatsApp API apenas para quem não tem nick)
  const resolverNome = async (jogadorId) => {
    if (nicksMap[jogadorId]) return nicksMap[jogadorId];
    return resolverNomeJogador(jogadorId);
  };

  let texto = "";
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
