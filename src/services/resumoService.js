const { GoogleGenerativeAI } = require("@google/generative-ai");
const partidaService = require("./partidaService");

async function gerarResumoGrupo(chat, mensagensRecentes) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Lista de modelos por prioridade
  const modelos = ["gemini-2.5-flash", "gemini-1.5-flash"];

  const conversaLimpa = (mensagensRecentes || [])
    .filter((m) => m?.body && !m.body.startsWith("!"))
    .map((m) => `${m.author?.split("@")[0] || "Sistema"}: ${m.body}`)
    .join("\n");

  if (!conversaLimpa)
    return "😴 Silêncio total no grupo hoje. Ninguém abriu o bico.";

  const prompt = `
    Você é um dos membros do grupo Aliados Gaming. Resuma a resenha de forma sarcástica.
    REGRAS: 
    - Sem introduções ("Olá", "Aqui está"). Vá direto ao ponto.
    - Use um asterisco para negrito (*texto*). 
    - Sem referências a robô/IA. Fale como um jogador.
    - No máximo 3 parágrafos ou tópicos curtos.
    - Use: emocionado, arregão, leigo, segurando o shift.
    - ZERO PALAVRÃO.

    CONVERSAS: ${conversaLimpa}
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
