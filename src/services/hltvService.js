const { HLTV } = require("hltv");

// Variáveis globais para o Cache em Memória
let cacheJogos = [];
let ultimaAtualizacao = 0;
const TEMPO_CACHE_MS = 60 * 60 * 1000; // 1 hora em milissegundos

// Lista de times BR relevantes (você pode adicionar mais depois)
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

async function atualizarCacheSeNecessario() {
  const agora = Date.now();

  // Se o cache ainda for válido (menos de 1 hora), não faz nada! (Proteção Anti-Ban)
  if (agora - ultimaAtualizacao < TEMPO_CACHE_MS && cacheJogos.length > 0) {
    return;
  }

  try {
    console.log("🔄 Buscando partidas na HLTV...");
    const partidas = await HLTV.getMatches();

    // Filtra apenas partidas que ainda não acabaram e que têm os dois times definidos
    cacheJogos = partidas.filter((p) => p.team1 && p.team2);
    ultimaAtualizacao = agora;
    console.log("✅ Cache da HLTV atualizado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao buscar dados da HLTV:", error.message);
    // Se der erro (ex: Cloudflare bloqueou), ele mantém o cache antigo para não quebrar o bot
  }
}

async function atualizarCacheSeNecessario() {
  const agora = Date.now();
  if (agora - ultimaAtualizacao < TEMPO_CACHE_MS && cacheJogos.length > 0)
    return;

  try {
    console.log("🔄 Buscando partidas na HLTV...");
    const partidas = await HLTV.getMatches();

    // Removido o filtro por `p.date` — jogos ao vivo podem ter date null!
    cacheJogos = partidas.filter((p) => p.team1 && p.team2);
    ultimaAtualizacao = agora;
    console.log(
      `✅ Cache atualizado! ${cacheJogos.length} partidas encontradas.`,
    );
  } catch (error) {
    console.error("❌ Erro ao buscar dados da HLTV:", error.message);
  }
}

async function getJogosTopTier() {
  await atualizarCacheSeNecessario();

  const agora = Date.now();
  const janelaInicio = agora - 4 * 60 * 60 * 1000;
  const janelaFim = agora + 24 * 60 * 60 * 1000;

  return cacheJogos.filter((p) => {
    const dataJogo = p.date ?? agora; // null = ao vivo agora
    const stars = p.stars ?? 0;
    return dataJogo >= janelaInicio && dataJogo <= janelaFim && stars >= 1;
  });
}

async function getJogosBR() {
  await atualizarCacheSeNecessario();

  const agora = Date.now();
  const janelaInicio = agora - 4 * 60 * 60 * 1000;
  const janelaFim = agora + 24 * 60 * 60 * 1000;

  return cacheJogos.filter((p) => {
    const dataJogo = p.date ?? agora; // null = ao vivo agora
    if (dataJogo < janelaInicio || dataJogo > janelaFim) return false;

    const time1 = p.team1.name.toUpperCase();
    const time2 = p.team2.name.toUpperCase();

    return TIMES_BR.some(
      (br) =>
        time1.includes(br.toUpperCase()) || time2.includes(br.toUpperCase()),
    );
  });
}

module.exports = { getJogosTopTier, getJogosBR };
