# 🎮 WhatsApp CS2 Matchmaking Bot

Um bot de WhatsApp construído em **Node.js** com a biblioteca `whatsapp-web.js`. Criado para acabar com a bagunça de organizar partidas de Counter-Strike 2 pelo WhatsApp, automatizando filas, gerenciando reservas e notificando a galera sem poluir o grupo.

---

## 🔥 Principais Funcionalidades

* **Sistema de Filas Dinâmico:** Crie filas para Lobbies (5 vagas) ou Mixes internos (10 vagas) com um único comando.
* **Banco de Reservas Inteligente:** A fila encheu? Os próximos jogadores vão automaticamente para a lista de suplentes. Se um titular arregou (`!sair`), o bot promove o primeiro suplente para o time principal e notifica o grupo.
* **Ghost Mentions (Marcação Fantasma):** Notifica todos os participantes da partida forçando o celular a apitar (usando a tag `@todos` de forma invisível via array de IDs), mantendo o chat visualmente limpo.
* **Sistema de Nicks Customizados:** Chega de nomes de perfil esquisitos no WhatsApp. Os jogadores podem definir seus nicks in-game (`!meunick`), e o bot salva essas preferências localmente em um arquivo JSON.
* **Gestão de Sessão Viva:** O criador da partida pode alterar o horário e o título da sala em tempo real, e o bot atualiza o painel para todos os confirmados.
* **Integração Segura de Links:** Cospe o link do Discord automaticamente quando a sala fecha, puxando a URL de um arquivo `.env` protegido.

---

## 🛠️ Tabela de Comandos

| Comando | Descrição |
| :--- | :--- |
| `!lobby [hora]` | Abre uma sala com 5 vagas. O horário é opcional (ex: `!lobby 21h`). |
| `!mix [hora]` | Abre uma sala 5x5 com 10 vagas. |
| `!eu` | Confirma sua presença no time titular ou entra na fila de suplentes. |
| `!sair` | Remove seu nome da partida e passa a vaga pro próximo. |
| `!meunick [nome]` | Cadastra ou altera o seu nick exibido nas listas do bot. |
| `!status` | Espia o painel da partida atual sem precisar entrar nela. |
| `!horario [hora]` | Altera o horário da partida (Apenas o criador). |
| `!titulo [nome]` | Altera o título da partida (Apenas o criador). |
| `!cancelar` | Derruba a lista atual e reseta a sessão (Apenas o criador). |
| `!comandos` | Exibe o menu de ajuda no chat. |

*(Nota: O bot possui tratamento de strings para aceitar variações naturais como `!horas`, `!hrs`, `!horário`, `!título`, etc).*

---

## 🚀 Como instalar e rodar na sua máquina

### Pré-requisitos
* [Node.js](https://nodejs.org/) instalado.
* Um número de WhatsApp (preferencialmente usando o WhatsApp Business) para servir como o bot.

### Passo a Passo

1. **Clone este repositório:**
   ```bash
   git clone [https://github.com/alissongritti/WhatsAppBotLobby.git](https://github.com/alissongritti/WhatsAppBotLobby.git)
   cd WhatsAppBotLobby
   
2. **Instale as dependências:**
   ```bash
   npm install

3. **Configure as Variáveis de Ambiente:**
   Crie um arquivo chamado .env na raiz do projeto e adicione o link do seu Discord:
   ```bash
   DISCORD_LINK=[https://discord.gg/seu-link-aqui](https://discord.gg/seu-link-aqui)

4. **Inicie o bot:**
   ```bash
   node index.js
   
5. **Autenticação:**
   O terminal irá gerar um QR Code. Escaneie-o com o WhatsApp (Aparelhos Conectados) e aguarde a mensagem de confirmação no console.

---

## 🔒 Segurança e Boas Práticas (Importante)
Se for fazer um fork ou clonar este projeto, certifique-se de manter o arquivo .gitignore configurado corretamente para nunca subir as seguintes pastas/arquivos para repositórios públicos:

- .wwebjs_auth/ (Contém seu token de sessão do WhatsApp)
- .env (Contém seus links e possíveis chaves de API)
- nicks.json (Contém a relação de IDs/Telefones reais dos usuários)

## 🚧 Roadmap (Versão 2.0 em breve)
- [ ] Sorteio automático de times CT e TR para o comando !mix.
- [ ] Log de estatísticas (Contador de partidas jogadas e ranking de "maiores arregões").
- [ ] Integração com a API da Faceit/Gamers Club para puxar Win Rate e K/D médio do lobby.

