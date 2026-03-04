function parseHorario(texto) {
  if (!texto) return null;

  // 1. Limpa os espaços e joga tudo para minúsculo
  let limpo = texto.toLowerCase().trim();

  // 2. Troca "horas", "hrs", "hr" ou "h" por dois-pontos ":"
  limpo = limpo.replace(/horas?|hrs?|h/g, ":").replace(/min/g, "");

  // 3. Se o cara digitou só "22h", a limpeza acima deixa "22:". Vamos limpar o ":" do final.
  if (limpo.endsWith(":")) limpo = limpo.slice(0, -1);

  // 4. A Mágica do Regex: Valida se é uma hora real (00 a 23) e minutos reais (00 a 59)
  // Aceita formatos como "22", "22:30", "09:00", etc.
  const regex = /^([01]?[0-9]|2[0-3])(?:[:]?([0-5][0-9]))?$/;
  const match = limpo.match(regex);

  // Se não bater com o Regex (ex: "batata" ou "25h"), retorna nulo
  if (!match) return null;

  // 5. Pega a hora e o minuto (se não tiver minuto, assume 0)
  const hora = parseInt(match[1], 10);
  const minuto = match[2] ? parseInt(match[2], 10) : 0;

  // 6. Formata bonitinho com 2 dígitos. Ex: "9" vira "09", "0" vira "00".
  const horaStr = hora.toString().padStart(2, "0");
  const minStr = minuto.toString().padStart(2, "0");

  // Retorna o formato oficial que vamos salvar no banco (HH:mm)
  return `${horaStr}:${minStr}`;
}

module.exports = { parseHorario };
