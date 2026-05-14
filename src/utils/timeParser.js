/**
 * Parseia uma string de horário e retorna "HH:mm" ou null.
 *
 * Formatos aceitos:
 *   "20h", "20h30", "20:30", "20:30h", "9", "9h", "9:05", "0h", "23:59"
 *   "12:15" (o caso que gerou o bug — hora no meio do título)
 */
function parseHorario(texto) {
  if (!texto) return null;

  let limpo = texto.toLowerCase().trim();

  // Remove sufixos de hora para normalizar
  limpo = limpo.replace(/horas?|hrs?|hs|h/g, ":").replace(/min/g, "");

  // Remove ":" trailing
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
 *
 * Formatos aceitos:
 *   "10/05", "10-05", "10.05", "10/5", "1/5"
 */
function parseData(texto) {
  if (!texto) return null;

  const limpo = texto.trim();
  const match = limpo.match(/^([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])$/);
  if (!match) return null;

  const dia = match[1].padStart(2, "0");
  const mes = match[2].padStart(2, "0");

  return `${dia}/${mes}`;
}

/**
 * Varre TODOS os tokens do parâmetro procurando data e hora em qualquer posição.
 *
 * Exemplos que agora funcionam:
 *   "all mossar 12:15 ANTI-DESUMILDE"  → { data: null, horario: "12:15", titulo: "ALL MOSSAR ANTI-DESUMILDE" }
 *   "14/05 20h Mix Semanal"            → { data: "14/05", horario: "20:00", titulo: "MIX SEMANAL" }
 *   "20h Ranqueada"                    → { data: null, horario: "20:00", titulo: "RANQUEADA" }
 *   "Ranqueada 20h"                    → { data: null, horario: "20:00", titulo: "RANQUEADA" }
 *   "14/05 Mix"                        → { data: "14/05", horario: null,  titulo: "MIX" }
 *   "Mix 14/05 20h"                    → { data: "14/05", horario: "20:00", titulo: "MIX" }
 *
 * Retorna: { data, horario, tituloTokens }
 *   - data: "DD/MM" ou null
 *   - horario: "HH:mm" ou null
 *   - tituloTokens: array de tokens que não eram data nem hora (o título)
 */
function parseDateHorario(parametro) {
  if (!parametro) return { data: null, horario: null, tituloTokens: [] };

  const tokens = parametro.split(" ");
  let data = null;
  let horario = null;
  const tituloTokens = [];

  for (const token of tokens) {
    if (!data) {
      const d = parseData(token);
      if (d) { data = d; continue; }
    }

    if (!horario) {
      const h = parseHorario(token);
      if (h) { horario = h; continue; }
    }

    // Token não é data nem hora — faz parte do título
    tituloTokens.push(token);
  }

  return { data, horario, tituloTokens };
}

/**
 * Valida se a data DD/MM é hoje ou futura, tratando viradas de ano.
 */
function dataEFutura(ddmm) {
  if (!ddmm) return false;
  const [dia, mes] = ddmm.split("/").map(Number);
  const agora = new Date();
  const ano = agora.getFullYear();

  let alvo = new Date(ano, mes - 1, dia);
  if (alvo < new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())) {
    alvo = new Date(ano + 1, mes - 1, dia);
  }

  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return alvo >= hoje;
}

/**
 * Retorna a data atual no formato DD/MM.
 */
function dataDeHoje() {
  const agora = new Date();
  return `${agora.getDate().toString().padStart(2, "0")}/${(agora.getMonth() + 1).toString().padStart(2, "0")}`;
}

/**
 * Calcula a diferença em dias até a data alvo (0 = hoje).
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