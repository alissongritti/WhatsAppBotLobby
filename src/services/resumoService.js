const { GoogleGenerativeAI } = require("@google/generative-ai");
const partidaService = require("./partidaService");

async function gerarResumoGrupo(chat, mensagensRecentes) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // 1. FILTRO CRÍTICO: Ignora mensagens enviadas pelo próprio bot (fromMe)
  // e foca apenas no que os membros escreveram.
  const conversaLimpa = (mensagensRecentes || [])
    .filter((m) => m?.body && !m.body.startsWith("!") && m.fromMe === false) // <--- ADICIONADO: m.fromMe === false
    .map((m) => `${m.author?.split("@")[0] || "Sistema"}: ${m.body}`)
    .join("\n");

  if (!conversaLimpa) return "😴 Silêncio total. Ninguém falou nada útil.";

  // 2. PROMPT COM "BLINDAGEM" DE CONTEXTO
  const prompt = `
    Você é um membro sarcástico do grupo Aliados Gaming.
    Resuma EXCLUSIVAMENTE o comportamento e as falas dos membros abaixo.

    REGRAS DE OURO (NÃO QUEBRE):
    1. PROIBIDO: Não use seu conhecimento sobre patches, atualizações ou notícias do CS2. 
    2. Se não estiver escrito nas "CONVERSAS" abaixo, NÃO invente e NÃO mencione.
    3. FOCO: Zoeiras entre membros, tentativas de lobby, o cara do marketing, etc.
    4. ESTILO: Máximo 3 parágrafos curtos. Sem "Olá" ou introduções.
    5. FORMATAÇÃO: Use apenas um asterisco para negrito (*texto*).
    6. LINGUAGEM: Use 'emocionado', 'arregão', 'leigo'. Sem palavrões.

    CONVERSAS PARA ANALISAR (IGNORE TUDO QUE ESTIVER FORA DISSO):
    ${conversaLimpa}
  `;

  // Função interna para tentar gerar com um modelo específico
  async function tentarGerar(modelName) {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 15000),
      ),
    ]);
    const response = await result.response;
    return response.text();
  }

  // Lógica de Tentativa e Erro (Failover)
  for (const modelName of modelos) {
    try {
      return await tentarGerar(modelName);
    } catch (err) {
      console.log(
        `⚠️ Falha no modelo ${modelName}: ${err.message}. Tentando próximo...`,
      );
      continue; // Pula para o próximo modelo da lista
    }
  }

  return "🤖 O Google tá de sacanagem hoje. Tentei todos os modelos e nenhum respondeu!";
}

module.exports = { gerarResumoGrupo };
