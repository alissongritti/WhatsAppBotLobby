# 🎮 Bot Aliados — Gestão de Lobbies para CS2

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_API-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)

O **Bot Aliados** é um sistema automatizado para organização de partidas de Counter-Strike 2 via WhatsApp. Esqueça a bagunça de listas manuais que ninguém respeita: o bot gerencia entradas, saídas, reservas e ainda mantém a rapaziada informada com jogos e resultados profissionais em tempo real.

---

## 🚀 Tecnologias Core

O projeto foi construído com foco em estabilidade e performance para grupos de alta rotatividade:

- **Node.js (CommonJS):** Runtime robusto para processamento assíncrono de mensagens.
- **whatsapp-web.js:** Biblioteca principal para interação com a API do WhatsApp via Puppeteer.
- **SQLite:** Banco de dados relacional para persistência de lobbies, jogadores e estatísticas, garantindo integridade dos dados sem a necessidade de um servidor de BD pesado.
- **Google Gemini API:** Utilizada para resumir automaticamente os Patch Notes oficiais do CS2, traduzindo e formatando as atualizações da Valve em português para todos os grupos.

---

## 🕹️ Sistema de Lobbies: Como funciona?

O coração do bot é o gerenciamento de filas. O sistema entende quem é titular e quem é suplente (reserva) automaticamente.

- **`!eu`**: Entra no lobby ativo. Se o time de 5 estiver cheio, você vai automaticamente para a fila de suplentes. *Sem choro!*
- **`!sair`**: Remove você da partida. Se você era titular e havia um reserva, o bot faz o "promote" automático do reserva para a vaga de titular.
- **`!kick 2` ou `!kick @player`**: Comando de moderador/dono do lobby para remover aquele "emocionado" que kitou ou não vai jogar. Aceita posição na lista ou menção direta.

> **Dica:** O bot centraliza a identidade visual das listas via `listFormatter.js`, garantindo que o status da partida esteja sempre legível e organizado.

---

## 🛠️ Diferenciais Técnicos (O "High-Skill" do Bot)

### 🛡️ Sistema de Debounce (Anti-Race Condition)
Em grupos de WhatsApp, é comum que vários jogadores enviem `!eu` ao mesmo tempo. Sem tratamento, isso geraria uma *Race Condition*, onde 6 pessoas poderiam entrar em uma vaga de 5.
Nossa solução implementa um mecanismo de **Debounce via Set (`jogadoresEmOperacao`)**:
- Bloqueia operações simultâneas do mesmo ID por 3 segundos.
- Garante que a escrita no SQLite seja atômica e sequencial.
- Evita duplicidade de jogadores no banco de dados.

### 🔐 Filtro de Autorização de Grupos
Segurança em primeiro lugar. O bot não responde em qualquer lugar. Existe uma camada de middleware que verifica `isGrupoAutorizado` antes de processar qualquer lógica de negócio. Isso impede que o bot seja usado em grupos não autorizados e economiza recursos de processamento.

### 📰 Patch Notes Automáticos com IA
O bot monitora o feed RSS oficial da Valve a cada 30 minutos. Quando uma atualização é detectada, o conteúdo em inglês é enviado ao Google Gemini, que traduz e resume as mudanças em português com formatação gamer — e distribui automaticamente para todos os grupos autorizados.

---

## 📜 Comandos Principais

| Comando | Descrição |
| :--- | :--- |
| `!lobby [horario] [titulo]` | Cria uma fila para 5 jogadores. |
| `!mix [horario] [titulo]` | Cria um 5x5 para 10 jogadores. |
| `!eu` | Entra no lobby atual (Titular ou Reserva). |
| `!sair` | Sai da partida e libera a vaga. |
| `!status` | Exibe o status atual do lobby com formatação gamer. |
| `!start` | Fecha o lobby e marca o início da gameplay. |
| `!cancelar` | Cancela o lobby e reseta a fila. |
| `!kick [pos] ou !kick @player` | Remove um jogador da lista. |
| `!horario [hora]` | Atualiza o horário da partida. |
| `!titulo [nome]` | Atualiza o título da partida. |
| `!nick [nome]` | Define seu apelido na lista. |
| `!jogos` | Lista os jogos de CS2 do dia. |
| `!jogosbr` | Lista os jogos de times brasileiros do dia. |
| `!resultados` | Resultados dos jogos do dia. |
| `!resultadosbr` | Resultados dos times brasileiros do dia. |
| `!novidades` | Última atualização oficial do CS2 resumida por IA. |
| `!discord` | Exibe o link do Discord do grupo. |
| `!comandos` | Lista todos os comandos disponíveis. |

---

## ⚙️ Instalação e Setup

1. Clone o repositório.
2. Instale as dependências: `npm install`.
3. Configure o `.env` seguindo o `.env.example` (não esqueça sua `GEMINI_API_KEY` e `ADMIN_WA_ID`).
4. Rode o bot: `node index.js`.
5. Escaneie o QR Code no terminal e *bora pro game!*

---

**Desenvolvido para quem não aguenta mais perder tempo organizando mix.**
*Se for pra trollar, nem entra no lobby.* 🔫💨