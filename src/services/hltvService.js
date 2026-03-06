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
    cacheJogos = partidas.filter((p) => p.team1 && p.team2 && p.date);
    ultimaAtualizacao = agora;
    console.log("✅ Cache da HLTV atualizado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao buscar dados da HLTV:", error.message);
    // Se der erro (ex: Cloudflare bloqueou), ele mantém o cache antigo para não quebrar o bot
  }
}

async function getJogosTopTier() {
  await atualizarCacheSeNecessario();

  // Filtra apenas jogos do dia de hoje e que tenham 1 ou mais estrelas (Top Tiers)
  const hoje = new Date().setHours(0, 0, 0, 0);

  return cacheJogos.filter((p) => {
    const dataJogo = new Date(p.date).setHours(0, 0, 0, 0);
    return dataJogo === hoje && p.stars >= 1;
  });
}

async function getJogosBR() {
  await atualizarCacheSeNecessario();

  const hoje = new Date().setHours(0, 0, 0, 0);

  return cacheJogos.filter((p) => {
    const dataJogo = new Date(p.date).setHours(0, 0, 0, 0);
    if (dataJogo !== hoje) return false;

    const time1 = p.team1.name.toUpperCase();
    const time2 = p.team2.name.toUpperCase();

    // Retorna true se pelo menos um dos times estiver na nossa lista BR
    return TIMES_BR.some(
      (br) =>
        time1.includes(br.toUpperCase()) || time2.includes(br.toUpperCase()),
    );
  });
}

module.exports = { getJogosTopTier, getJogosBR };
