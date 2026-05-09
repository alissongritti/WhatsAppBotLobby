/**
 * Parseia uma string de horário e retorna "HH:mm" ou null.
 * Aceita: "20h", "20:30", "20h30", "9", etc.
 */
function parseHorario(texto) {
  if (!texto) return null;

  let limpo = texto.toLowerCase().trim();
  limpo = limpo.replace(/horas?|hrs?|hs|h/g, ":").replace(/min/g, "");
  if (limpo.endsWith(":")) limpo = limpo.slice(0, -1);

  const regex = /^([01]?[0-9]|2[0-3])(?:[:]?([0-5][0-9]))?$/;
  const match = limpo.match(regex);
  if (!match) return null;

  const hora = parseInt(match[1], 10);
  const minuto = match[2] ? parseInt(match[2], 10) : 0;

  return `${hora.toString().padStart(2, "0")}:${minuto.toString().padStart(2, "0")}`;
}

/**
 * Parseia uma string de data e retorna "DD/MM" ou null.
 * Aceita: "10/05", "10-05", "10.05"
 */
function parseData(texto) {
  if (!texto) return null;

  const limpo = texto.trim();
  const match = limpo.match(/^([0-2]?[0-9]|3[01])[\/\-\.]([0][1-9]|1[0-2])$/);
  if (!match) return null;

  const dia = match[1].padStart(2, "0");
  const mes = match[2].padStart(2, "0");

  return `${dia}/${mes}`;
}

/**
 * Parseia um token que pode ser:
 * - Só data:    "10/05"       → { data: "10/05", horario: null }
 * - Só hora:    "20h"         → { data: null, horario: "20:00" }
 * - Data+hora:  "10/05 20h"   → { data: "10/05", horario: "20:00" }  (dois tokens separados)
 *
 * Uso em criarLobby: chame parseDateHorario(palavras[0], palavras[1])
 */
function parseDateHorario(token1, token2) {
  const data1 = parseData(token1);
  const hora1 = parseHorario(token1);

  // Token1 é uma data
  if (data1) {
    const hora2 = token2 ? parseHorario(token2) : null;
    return { data: data1, horario: hora2, tokensConsumidos: hora2 ? 2 : 1 };
  }

  // Token1 é uma hora
  if (hora1) {
    return { data: null, horario: hora1, tokensConsumidos: 1 };
  }

  return { data: null, horario: null, tokensConsumidos: 0 };
}

/**
 * Retorna true se a data "DD/MM" é hoje ou no futuro (ano corrente ou próximo).
 */
function dataEFutura(ddmm) {
  if (!ddmm) return false;
  const [dia, mes] = ddmm.split("/").map(Number);
  const agora = new Date();
  const ano = agora.getFullYear();

  // Tenta este ano; se já passou, considera ano que vem
  let alvo = new Date(ano, mes - 1, dia);
  if (alvo < new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())) {
    alvo = new Date(ano + 1, mes - 1, dia);
  }

  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return alvo >= hoje;
}

/**
 * Retorna a data de hoje no formato "DD/MM".
 */
function dataDeHoje() {
  const agora = new Date();
  return `${agora.getDate().toString().padStart(2, "0")}/${(agora.getMonth() + 1).toString().padStart(2, "0")}`;
}

/**
 * Retorna quantos dias faltam até "DD/MM" (0 = hoje, 1 = amanhã, etc.).
 * Assume ano corrente; se já passou, assume ano seguinte.
 */
function diasAteData(ddmm) {
  if (!ddmm) return 0;
  const [dia, mes] = ddmm.split("/").map(Number);
  const agora = new Date();
  const ano = agora.getFullYear();
  let alvo = new Date(ano, mes - 1, dia);
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (alvo < hoje) alvo = new Date(ano + 1, mes - 1, dia);
  return Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));
}

module.exports = {
  parseHorario,
  parseData,
  parseDateHorario,
  dataEFutura,
  dataDeHoje,
  diasAteData,
};
