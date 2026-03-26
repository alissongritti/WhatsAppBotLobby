const { GoogleGenerativeAI } = require("@google/generative-ai");
const partidaService = require("./partidaService");

async function gerarResumoGrupo(chat, mensagensRecentes) {
  // Inicializa dentro da função (igual seu RSS)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // 1. Limpeza das mensagens
  const conversaLimpa = (mensagensRecentes || [])
    .filter((m) => m?.body && !m.body.startsWith("!"))
    .map((m) => {
      const idCurto = m.author ? m.author.split("@")[0] : "Sistema";
      return `${idCurto}: ${m.body}`;
    })
    .join("\n");

  if (!conversaLimpa) {
    return "😴 Não teve conversa suficiente pra eu fofocar hoje.";
  }

  // 2. Contexto das lobbies
  let contextoLobbies = "Nenhuma lobby aberta no momento.";

  try {
    const lobbies = await partidaService.getPartidasAbertas(
      chat?.id?._serialized,
    );

    if (lobbies?.length > 0) {
      contextoLobbies = lobbies
        .map(
          (l) =>
            `- Lobby #${l.numero_lobby}: ${l.titulo} (${l.horario || "Sem horário"})`,
        )
        .join("\n");
    }
  } catch (err) {
    console.error("Erro ao buscar lobbies:", err);
  }

  // 3. Prompt
  const prompt = `
Você é o moderador zoeiro de um grupo de CS2 chamado Aliados Gaming.
Faça um resumo curto, engraçado e ácido.

REGRAS:
- Use gírias tipo: emocionado, arregão, leigo, segurando o shift
- Destaque tretas e zoeiras
- Liste em tópicos

CONVERSAS:
${conversaLimpa}

LOBBIES:
${contextoLobbies}
`;

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout Gemini")), 30000),
      ),
    ]);

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("❌ Erro no Gemini:", error.message);
    return "🤖 Tentei resumir, mas deu ruim aqui... tenta de novo mais tarde!";
  }
}

module.exports = { gerarResumoGrupo };
