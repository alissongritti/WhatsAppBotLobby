const { GoogleGenerativeAI } = require("@google/generative-ai");
const partidaService = require("./partidaService");

// Configuração da IA (Mesma lógica do seu rssService)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function gerarResumoGrupo(chat, mensagensRecentes) {
  // 1. Filtro e Limpeza de Mensagens
  // Remove comandos (!) e trata possíveis campos undefined
  const conversaLimpa = mensagensRecentes
    .filter((m) => m.body && !m.body.startsWith("!"))
    .map((m) => {
      const idCurto = m.author ? m.author.split("@")[0] : "Sistema";
      return `${idCurto}: ${m.body}`;
    })
    .join("\n");

  // 2. Busca Contexto das Lobbies Atuais
  const lobbies = await partidaService.getPartidasAbertas(chat.id._serialized);
  const contextoLobbies =
    lobbies.length > 0
      ? lobbies
          .map(
            (l) =>
              `- Lobby #${l.numero_lobby}: ${l.titulo} (${l.horario || "Sem hora definido"})`,
          )
          .join("\n")
      : "Nenhuma lobby aberta no momento.";

  // 3. Prompt de Personalidade (O "Cérebro" do Bot)
  const prompt = `
    Você é o moderador zoeiro de um grupo de CS2 chamado Aliados Gaming.
    Sua tarefa é fazer um resumo curto, engraçado e ácido das conversas abaixo.
    
    DIRETRIZES:
    - Use gírias como 'emocionado', 'arregão', 'leigo' e 'segurando o shift'.
    - Identifique quem está agitando o jogo e quem está enrolando.
    - Se houver conflitos ou zoeiras, destaque isso.
    - O resumo deve ser em tópicos curtos.
    
    CONVERSAS RECENTES:
    ${conversaLimpa}
    
    STATUS DAS LOBBIES:
    ${contextoLobbies}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro na API do Gemini:", error);
    return "Tentei resumir, mas a conversa de vocês está tão sem nexo que meus circuitos fritaram!";
  }
}

module.exports = { gerarResumoGrupo };
