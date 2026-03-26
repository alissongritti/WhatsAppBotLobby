const { GoogleGenerativeAI } = require("@google/generative-ai");
const partidaService = require("./partidaService");

async function gerarResumoGrupo(chat, mensagensRecentes) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const conversaLimpa = (mensagensRecentes || [])
    .filter((m) => m?.body && !m.body.startsWith("!"))
    .map((m) => {
      const idCurto = m.author ? m.author.split("@")[0] : "Sistema";
      return `${idCurto}: ${m.body}`;
    })
    .join("\n");

  if (!conversaLimpa) return "😴 Nada de novo no front.";

  let contextoLobbies = "Nenhuma lobby aberta.";
  try {
    const lobbies = await partidaService.getPartidasAbertas(
      chat?.id?._serialized,
    );
    if (lobbies?.length > 0) {
      contextoLobbies = lobbies
        .map(
          (l) =>
            `- #${l.numero_lobby}: ${l.titulo} (${l.horario || "s/ hora"})`,
        )
        .join("\n");
    }
  } catch (err) {
    console.error(err);
  }

  // PROMPT AJUSTADO: Foco em brevidade e civilidade
  const prompt = `
    Você é o moderador do grupo Aliados Gaming (CS2). 
    Resuma a resenha de forma MUITO concisa e engraçada.

    REGRAS CRÍTICAS:
    1. PROIBIDO PALAVRÕES OU TERMOS OFENSIVOS.
    2. No máximo 3 tópicos curtos e diretos (estilo "bullet points").
    3. Use gírias: emocionado, arregão, leigo, segurando o shift.
    4. Seja ácido, mas mantenha o nível.

    CONVERSAS:
    ${conversaLimpa}

    LOBBIES:
    ${contextoLobbies}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    return "🤖 Tentei fofocar, mas deu erro na rede.";
  }
}

module.exports = { gerarResumoGrupo };
