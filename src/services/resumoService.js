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
    Você é um bot zoeiro do grupo Aliados Gaming (CS2). 
    Sua missão é resumir a "resenha" e as interações entre os membros.

    DIRETRIZES RÍGIDAS:
    1. FOCO TOTAL: Resuma apenas as conversas, piadas, tretas e marcações de jogo entre os usuários.
    2. PROIBIÇÃO: NÃO fale sobre atualizações do CS2, patch notes, notícias da Valve ou eventos externos.
    3. ESTILO: Máximo 3 tópicos curtos, ácidos e engraçados.
    4. ZERO PALAVRÃO: Mantenha a zoeira sem ofensas pesadas.
    5. GÍRIAS: Use 'emocionado', 'arregão', 'leigo', 'segurando o shift'.

    CONVERSAS PARA ANALISAR:
    ${conversaLimpa}

    LOBBIES ATUAIS:
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
