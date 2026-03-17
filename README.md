<p align="center">
  <a href="#-bot-aliados--gestão-de-lobbies-para-cs2">🇧🇷 Português</a> &nbsp;|&nbsp;
  <a href="#-bot-aliados--cs2-lobby-manager-for-whatsapp">🇺🇸 English</a>
</p>

---

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

## 🕹️ Sistema de Lobbies

O coração do bot é o gerenciamento de filas. O sistema entende quem é titular e quem é suplente automaticamente.

- **`!eu`** — Entra no lobby ativo. Se o time de 5 estiver cheio, você vai automaticamente para a fila de suplentes.
- **`!sair`** — Remove você da partida. Se você era titular e havia um reserva, o bot faz o promote automático do reserva para a vaga.
- **`!kick [pos] ou !kick @player`** — Comando de moderador para remover um jogador da lista.

> A identidade visual das listas é centralizada via `listFormatter.js`, garantindo que o status da partida esteja sempre legível e organizado.

---

## 🛠️ Diferenciais Técnicos

### 🛡️ Sistema de Debounce (Anti-Race Condition)
Em grupos de WhatsApp, é comum que vários jogadores enviem `!eu` ao mesmo tempo. Sem tratamento, isso geraria uma race condition onde 6 pessoas poderiam entrar em uma vaga de 5.

A solução implementa um **debounce via `Set` (`jogadoresEmOperacao`)**:
- Bloqueia operações simultâneas do mesmo ID por 3 segundos.
- Garante que a escrita no SQLite seja atômica e sequencial.
- Evita duplicidade de jogadores no banco de dados.

### 🔐 Filtro de Autorização de Grupos
O bot não responde em qualquer lugar. Uma camada de middleware valida `isGrupoAutorizado` antes de processar qualquer lógica de negócio, impedindo uso não autorizado e economizando recursos de processamento.

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
| `!status` | Exibe o status atual do lobby. |
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

## ⚙️ Instalação

1. Clone o repositório.
2. Instale as dependências: `npm install`.
3. Configure o `.env` seguindo o `.env.example` (não esqueça sua `GEMINI_API_KEY` e `ADMIN_WA_ID`).
4. Rode o bot: `node index.js`.
5. Escaneie o QR Code no terminal e bora pro game!

---

*Desenvolvido para quem não aguenta mais perder tempo organizando mix. Se for pra trollar, nem entra no lobby.* 🔫💨

---
---

# 🎮 Bot Aliados — CS2 Lobby Manager for WhatsApp

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_API-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)

**Bot Aliados** is an automated lobby management system for Counter-Strike 2, built on top of WhatsApp. No more chaotic manual lists that nobody respects — the bot handles player queues, reserves, automatic promotions, and keeps everyone up to date with live professional match results and AI-powered patch notes.

---

## 🚀 Tech Stack

Built for stability and performance in high-traffic group chats:

- **Node.js (CommonJS):** Asynchronous message processing runtime.
- **whatsapp-web.js:** Core library for WhatsApp interaction via Puppeteer.
- **SQLite:** Relational database for persisting lobby state, players, and stats — no heavy DB server required.
- **Google Gemini API:** Automatically summarizes official CS2 Patch Notes from English into Portuguese, formatted for a gaming audience and distributed to all authorized groups.

---

## 🕹️ Lobby System

The core of the bot is its queue management engine. It automatically distinguishes starters from substitutes.

- **`!eu`** — Joins the active lobby. If the 5-player slot is full, you're automatically queued as a substitute.
- **`!sair`** — Leaves the match and frees your slot. If you were a starter, the first substitute is automatically promoted.
- **`!kick [pos] or !kick @player`** — Moderator command to remove a player by position or mention.

> All list formatting is centralized in `listFormatter.js`, ensuring consistent and readable lobby status across all interactions.

---

## 🛠️ Technical Highlights

### 🛡️ Debounce System (Anti-Race Condition)
In WhatsApp groups, multiple players often send `!eu` simultaneously. Without proper handling, this causes a race condition where 6 players could join a 5-player slot.

The solution implements a **debounce mechanism via a JavaScript `Set` (`jogadoresEmOperacao`)**:
- Blocks concurrent operations from the same user ID for 3 seconds.
- Ensures SQLite writes are atomic and sequential.
- Prevents duplicate player entries in the database.

### 🔐 Group Authorization Middleware
The bot doesn't respond just anywhere. A middleware layer validates `isGrupoAutorizado` before processing any business logic — preventing unauthorized usage and saving unnecessary compute.

### 📰 AI-Powered Patch Notes
The bot polls the official Valve RSS feed every 30 minutes. When an update is detected, the English content is sent to Google Gemini, which translates and summarizes the changes in Portuguese with gamer-friendly formatting — then automatically broadcasts to all authorized groups.

---

## 📜 Commands

| Command | Description |
| :--- | :--- |
| `!lobby [time] [title]` | Creates a 5-player queue. |
| `!mix [time] [title]` | Creates a 5v5 queue for 10 players. |
| `!eu` | Joins the lobby (starter or substitute). |
| `!sair` | Leaves the match and frees the slot. |
| `!status` | Shows current lobby status. |
| `!start` | Closes the lobby and marks game start. |
| `!cancelar` | Cancels the lobby and resets the queue. |
| `!kick [pos] or !kick @player` | Removes a player from the list. |
| `!horario [time]` | Updates the match time. |
| `!titulo [name]` | Updates the match title. |
| `!nick [name]` | Sets your display name in the list. |
| `!jogos` | Lists today's CS2 professional matches. |
| `!jogosbr` | Lists today's Brazilian team matches. |
| `!resultados` | Today's match results. |
| `!resultadosbr` | Today's Brazilian team results. |
| `!novidades` | Latest CS2 update summarized by AI. |
| `!discord` | Displays the group's Discord link. |
| `!comandos` | Lists all available commands. |

---

## ⚙️ Setup

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Configure your `.env` based on `.env.example` (don't forget your `GEMINI_API_KEY` and `ADMIN_WA_ID`).
4. Start the bot: `node index.js`.
5. Scan the QR code in the terminal and queue up.

---

*Built for people who are tired of wasting 10 minutes organizing a lobby before every match.* 🔫
