# 🎮 WhatsApp CS2 Matchmaking Bot

Um bot de WhatsApp construído em **Node.js** com a biblioteca `whatsapp-web.js`. Criado para acabar com a bagunça de organizar partidas de Counter-Strike 2 pelo WhatsApp, automatizando filas, gerenciando reservas e notificando a galera sem poluir o grupo.

---

## 🔥 Principais Funcionalidades

- **Sistema de Filas Dinâmico:** Crie filas para Lobbies (5 vagas) ou Mixes internos (10 vagas) com um único comando.
- **Banco de Reservas Inteligente:** A fila encheu? Os próximos jogadores vão automaticamente para a lista de suplentes. Se um titular arregou (`!sair`), o bot promove o primeiro suplente para o time principal e notifica o grupo.
- **Ghost Mentions (Marcação Fantasma):** Notifica todos os participantes da partida forçando o celular a apitar (usando a tag `@todos` de forma invisível via array de IDs), mantendo o chat visualmente limpo.
- **Sistema de Nicks Customizados:** Chega de nomes de perfil esquisitos no WhatsApp. Os jogadores podem definir seus nicks in-game (`!meunick`), e o bot salva essas preferências de forma persistente no banco de dados.
- **Gestão de Sessão Viva:** O criador da partida pode alterar o horário e o título da sala em tempo real, e o bot atualiza o painel para todos os confirmados.
- **Integração Segura de Links:** Cospe o link do Discord automaticamente quando a sala fecha, puxando a URL de um arquivo `.env` protegido.

## 🚀 Novidades da Versão Atual (v1.5)

- **Persistência de Dados (SQLite):** O bot agora utiliza um banco de dados relacional. Se o servidor reiniciar ou a energia cair, nenhuma lobby em andamento é perdida.
- **Múltiplas Partidas Simultâneas:** Suporte para gerenciar várias lobbies ao mesmo tempo no mesmo grupo, utilizando um sistema de IDs visuais recicláveis (Ex: Lobby #1, Lobby #2).
- **Sistema Inteligente de Suplentes (Transbordo):** Jogadores na fila de espera são notificados automaticamente quando uma nova lobby é aberta.
- **Passagem de Coroa Automática:** Se o criador (Admin) da partida sair, a liderança é transferida automaticamente para o próximo titular da lista.
- **Estatísticas Iniciais:** Preparação de terreno para o ranking, contabilizando partidas jogadas no banco de dados através do comando `!start`.

---

## 🛠️ Tabela de Comandos

| Comando           | Descrição                                                                                                    |
| :---------------- | :----------------------------------------------------------------------------------------------------------- |
| `!lobby [hora]`   | Abre uma sala com 5 vagas. O horário é opcional (ex: `!lobby 21h`).                                          |
| `!mix [hora]`     | Abre uma sala 5x5 com 10 vagas.                                                                              |
| `!eu`             | Confirma sua presença no time titular ou entra na fila de suplentes.                                         |
| `!sair`           | Remove seu nome da partida e passa a vaga pro próximo.                                                       |
| `!meunick [nome]` | Cadastra ou altera o seu nick exibido nas listas do bot.                                                     |
| `!status`         | Espia o painel da partida atual sem precisar entrar nela.                                                    |
| `!horario [hora]` | Altera o horário da partida (Apenas o criador).                                                              |
| `!titulo [nome]`  | Altera o título da partida (Apenas o criador).                                                               |
| `!cancelar`       | Derruba a lista atual e reseta a sessão (Apenas o criador).                                                  |
| `!start`          | Conclui a partida, libera o ID da sala para uso futuro e contabiliza +1 jogo nas estatísticas dos titulares. |
| `!silenciar`      | Não receberá notificação quando uma lobby for criada.                                                        |
| `!notificar`      | Reativa a notificação quando uma lobby for criada.                                                           |
| `!comandos`       | Exibe o menu de ajuda no chat.                                                                               |

_(Nota: O bot possui tratamento de strings para aceitar variações naturais como `!horas`, `!hrs`, `!horário`, `!título`, etc)._

---

## 🛠️ Tecnologias Utilizadas

- Node.js
- [whatsapp-web.js](https://wwebjs.dev/) (Integração com o WhatsApp)
- SQLite (Banco de dados leve e rápido)
- qrcode-terminal (Geração do QR Code de autenticação no terminal)

## 🚀 Como instalar e rodar na sua máquina

### Pré-requisitos

- [Node.js](https://nodejs.org/) instalado.
- Um número de WhatsApp (preferencialmente usando o WhatsApp Business) para servir como o bot.

### Passo a Passo

1. **Clone este repositório:**

   ```bash
   git clone [https://github.com/alissongritti/WhatsAppBotLobby.git](https://github.com/alissongritti/WhatsAppBotLobby.git)
   cd WhatsAppBotLobby

   ```

2. **Instale as dependências:**

   ```bash
   npm install whatsapp-web.js qrcode-terminal dotenv sqlite3 sqlite

   ```

3. **Configure as Variáveis de Ambiente:**
   Crie um arquivo chamado .env na raiz do projeto e adicione o link do seu Discord:

   ```bash
   DISCORD_LINK=[https://discord.gg/seu-link-aqui](https://discord.gg/seu-link-aqui)

   ```

4. **Inicie o bot:**

   ```bash
   node index.js

   ```

5. **Autenticação:**
   O terminal irá gerar um QR Code. Escaneie-o com o WhatsApp (Aparelhos Conectados) e aguarde a mensagem de confirmação no console.

---

## 🔒 Segurança e Boas Práticas (Importante)

Se for fazer um fork ou clonar este projeto, certifique-se de manter o arquivo .gitignore configurado corretamente para nunca subir as seguintes pastas/arquivos para repositórios públicos:

- .wwebjs_auth/ (Contém seu token de sessão do WhatsApp)
- .env (Contém seus links e possíveis chaves de API)
- .sqlite e .sqlite-journal (Contém a relação de IDs/Telefones reais dos usuários do seu grupo)

## 🚧 Roadmap (Versão 2.0 em breve)

- [ ] Sorteio automático de times CT e TR para o comando !mix.
- [ ] Log de estatísticas (Contador de partidas jogadas e ranking de "maiores arregões").
- [ ] Integração com a API da Faceit/Gamers Club para puxar Win Rate e K/D médio do lobby.
