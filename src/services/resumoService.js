async function gerarResumoGrupo(chat, mensagensRecentes) {
  // 1. Limpa as mensagens (tira comandos e lixo)
  const conversaLimpa = mensagensRecentes
    .filter(m => !m.body.startsWith('!'))
    .map(m => `${m.author.split('@')[0]}: ${m.body}`)
    .join('\n');

  // 2. Busca dados do banco para enriquecer o resumo
  const lobbies = await partidaService.getPartidasAbertas(chat.id._serialized);
  const contextoLobbies = lobbies.map(l => `- Lobby #${l.numero_lobby}: ${l.titulo} (${l.horario || 'Sem hora'})`).join('\n');

  // 3. Prompt para o Gemini
  const prompt = `Aqui estão as mensagens recentes do grupo:\n${conversaLimpa}\n\nStatus das Lobbies:\n${contextoLobbies}\n\nResuma a situação atual do grupo de forma zoeira.`;

  // 4. Chama sua função existente do Gemini
  return await gemini.perguntar(prompt); 
}