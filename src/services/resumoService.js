const { GoogleGenerativeAI } = require("@google/generative-ai");
const partidaService = require("./partidaService");

async function gerarResumoGrupo(chat, mensagensRecentes) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // 1. DEFINIÇÃO DOS MODELOS (Onde deu o erro antes)
  const listaModelos = ["gemini-2.5-flash", "gemini-1.5-flash"];

  // 2. FILTRO ANTI-RUÍDO:
  // Ignora o que o próprio bot escreveu (fromMe) e ignora comandos (!)
  const conversaLimpa = (mensagensRecentes || [])
    .filter((m) => m?.body && !m.body.startsWith("!") && m.fromMe === false)
    .map((m) => {
      const idCurto = m.author ? m.author.split("@")[0] : "Alguém";
      return `${idCurto}: ${m.body}`;
    })
    .join("\n");

  if (!conversaLimpa)
    return "😴 Silêncio total no grupo. Ninguém abriu o bico.";

  // 3. PROMPT "MURO DE BERLIM": Foco 100% no chat, 0% em notícias externas
  const prompt = `
    Você é um dos membros do grupo Aliados Gaming.
    Resuma EXCLUSIVAMENTE a conversa dos membros abaixo de forma sarcástica.

    REGRAS CRÍTICAS:
    - PROIBIDO: Não mencione atualizações do CS2, patch notes, notícias da Valve ou mudanças no jogo.
    - Se não estiver escrito nas "CONVERSAS" abaixo, IGNORE completamente.
    - Foque apenas em quem está agitando, quem está arregando de jogar e nas piadas internas.
    - Estilo: No máximo 3 tópicos curtos e diretos.
    - Formato: Use apenas um asterisco para negrito (*texto*). 
    - Sem "Olá" ou introduções. Vá direto ao primeiro ponto.
    - Use: emocionado, arregão, leigo, segurando o shift.
    - ZERO PALAVRÃO.

    CONVERSAS PARA ANALISAR:
    ${conversaLimpa}
  `;

  // Função interna de tentativa
  async function tentarGerar(modelName) {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 20000),
      ),
    ]);
    const response = await result.response;
    return response.text();
  }

  // 4. LÓGICA DE FAILOVER (REDUNDÂNCIA)
  for (const nomeDoModelo of listaModelos) {
    try {
      console.log(`--- Tentando gerar resumo com: ${nomeDoModelo} ---`);
      return await tentarGerar(nomeDoModelo);
    } catch (err) {
      console.error(`❌ Falha no modelo ${nomeDoModelo}:`, err.message);
      // Se for o último da lista, ele vai para o catch final lá embaixo
    }
  }

  throw new Error("Nenhum modelo do Gemini respondeu a tempo.");
}

module.exports = { gerarResumoGrupo };
