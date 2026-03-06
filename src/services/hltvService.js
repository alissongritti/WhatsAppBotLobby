const axios = require("axios");
const { getDb } = require("../database");

// ─── Config ───────────────────────────────────────────────────────────────────
const PANDASCORE_TOKEN = process.env.PANDASCORE_TOKEN;

const TIMES_BR = [
  "FURIA",
  "MIBR",
  "paiN",
  "Imperial",
  "RED Canids",
  "Legacy",
  "9z",
  "Fluxo",
  "ODDIK",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extrairTimes(match) {
  const t1 = match.opponents?.[0]?.opponent?.name ?? "TBD";
  const t2 = match.opponents?.[1]?.opponent?.name ?? "TBD";
  return { t1, t2 };
}

function ehBR(time1, time2) {
  return TIMES_BR.some((br) => {
    const brUp = br.toUpperCase();
    return time1.toUpperCase() === brUp || time2.toUpperCase() === brUp;
  });
}

async function precisaAtualizar(tabela, intervaloMs) {
  const db = getDb();
  const row = await db.get(
    `SELECT atualizado_em FROM ${tabela} ORDER BY atualizado_em DESC LIMIT 1`,
  );
  if (!row) return true;
  return Date.now() - row.atualizado_em > intervaloMs;
}

// ─── Atualização do Cache ─────────────────────────────────────────────────────

async function atualizarJogos() {
  const UMA_HORA_MS = 60 * 60 * 1000;

  if (!(await precisaAtualizar("hltv_jogos", UMA_HORA_MS))) {
    console.log("✅ Cache de jogos ainda válido, pulando requisição.");
    return;
  }

  console.log("🔄 Buscando jogos na PandaScore...");

  try {
    const hoje = new Date().toISOString().split("T")[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const [resAoVivo, resHoje] = await Promise.all([
      axios.get("https://api.pandascore.co/csgo/matches/running", {
        headers: { Authorization: `Bearer ${PANDASCORE_TOKEN}` },
        params: { per_page: 50 },
      }),
      axios.get("https://api.pandascore.co/csgo/matches/upcoming", {
        headers: { Authorization: `Bearer ${PANDASCORE_TOKEN}` },
        params: {
          "range[scheduled_at]": `${hoje},${amanha}`,
          per_page: 50,
          sort: "scheduled_at",
        },
      }),
    ]);

    const db = getDb();
    const agora = Date.now();

    // Limpa tudo e insere do zero
    await db.run("DELETE FROM hltv_jogos");

    const inserir = async (matches, aoVivo) => {
      for (const m of matches) {
        const { t1, t2 } = extrairTimes(m);
        if (t1 === "TBD" && t2 === "TBD") continue;

        await db.run(
          `INSERT OR REPLACE INTO hltv_jogos
            (id, time1, time2, evento, tier, data_jogo, ao_vivo, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m.id,
            t1,
            t2,
            m.league?.name ?? m.tournament?.name ?? "?",
            m.tier ?? null,
            m.scheduled_at ? new Date(m.scheduled_at).getTime() : null,
            aoVivo ? 1 : 0,
            agora,
          ],
        );
      }
    };

    await inserir(resAoVivo.data, true);
    await inserir(resHoje.data, false);

    const total = await db.get("SELECT COUNT(*) as n FROM hltv_jogos");
    console.log(`✅ Jogos atualizados! ${total.n} partidas no banco.`);
  } catch (err) {
    console.error(
      "❌ Erro ao buscar jogos:",
      err.response?.data ?? err.message,
    );
  }
}

async function atualizarResultados() {
  const CINCO_MIN_MS = 5 * 60 * 1000;

  if (!(await precisaAtualizar("hltv_resultados", CINCO_MIN_MS))) {
    console.log("✅ Cache de resultados ainda válido.");
    return;
  }

  console.log("🔄 Buscando resultados na PandaScore...");

  try {
    const res = await axios.get("https://api.pandascore.co/csgo/matches/past", {
      headers: { Authorization: `Bearer ${PANDASCORE_TOKEN}` },
      params: { per_page: 10, sort: "-scheduled_at" },
    });

    const db = getDb();
    const agora = Date.now();

    await db.run("DELETE FROM hltv_resultados");

    for (const m of res.data) {
      const { t1, t2 } = extrairTimes(m);
      await db.run(
        `INSERT INTO hltv_resultados
          (id, time1, score1, time2, score2, evento, data_jogo, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          t1,
          m.results?.[0]?.score ?? null,
          t2,
          m.results?.[1]?.score ?? null,
          m.league?.name ?? m.tournament?.name ?? "?",
          m.scheduled_at ? new Date(m.scheduled_at).getTime() : null,
          agora,
        ],
      );
    }

    console.log(`✅ Resultados atualizados! ${res.data.length} partidas.`);
  } catch (err) {
    console.error(
      "❌ Erro ao buscar resultados:",
      err.response?.data ?? err.message,
    );
  }
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

async function getJogosTopTier() {
  await atualizarJogos();
  const db = getDb();

  return await db.all(`
    SELECT * FROM hltv_jogos
    ORDER BY ao_vivo DESC, data_jogo ASC
  `);
}

async function getJogosBR() {
  await atualizarJogos();
  const db = getDb();

  const todos = await db.all(`
    SELECT * FROM hltv_jogos
    ORDER BY ao_vivo DESC, data_jogo ASC
  `);

  return todos.filter((j) => ehBR(j.time1, j.time2));
}

async function getResultados() {
  await atualizarResultados();
  const db = getDb();

  return await db.all(`
    SELECT * FROM hltv_resultados ORDER BY data_jogo DESC
  `);
}

module.exports = { getJogosTopTier, getJogosBR, getResultados, ehBR };
