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
    Você é um dos membros do grupo Aliados Gaming. 
    Sua tarefa é resumir o que rolou no chat de forma direta e sarcástica.

    REGRAS DE OURO:
    1. ZERO INTRODUÇÃO: Não diga "Olá", "Sou o moderador" ou "Aqui está o resumo". Vá direto ao primeiro tópico.
    2. FORMATAÇÃO: Use apenas um asterisco para negrito (ex: *texto*). Evite listas aninhadas ou excesso de símbolos.
    3. SEM "BOT": Não se refira a si mesmo como robô, IA ou moderador. Fale como um jogador.
    4. FOCO HUMANO: Ignore notícias de CS2. Foque em quem está agitando, quem está arregando e nas conversas aleatórias (tipo o cara do marketing).
    5. CURTO: No máximo 3 parágrafos ou tópicos pequenos.
    6. LOBBIES: Se citar lobbies, seja breve.
    7. SEM PALAVRÃO: Mantenha o nível, mas pode ser ácido.

    GÍRIAS OBRIGATÓRIAS (use naturalmente): emocionado, arregão, leigo, segurando o shift.

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
