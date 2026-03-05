# 🎮 WhatsApp CS2 Matchmaking Bot

Um bot de WhatsApp construído em **Node.js** com a biblioteca `whatsapp-web.js`. Criado para acabar com a bagunça de organizar partidas de Counter-Strike 2 pelo WhatsApp, automatizando filas, gerenciando reservas e notificando a galera sem poluir o grupo.

---

## 🔥 Principais Funcionalidades

- **Fila Dinâmica e Transbordo Inteligente:** Criação de Lobbies (5 vagas) ou Mixes (10 vagas). Se a sala encher, os próximos vão para a fila de espera (suplentes). Se um titular sair (!sair), o bot promove o primeiro suplente automaticamente e avisa o grupo.

- **Motor de Tempo Autônomo (Cron Jobs):** O bot monitora o relógio em segundo plano e dispara um alarme marcando os titulares no minuto exato marcado para a partida.

- **Auto-manutenção (Vassoura Inteligente):** Para evitar lixo no banco de dados, uma rotina roda automaticamente todos os dias às 05:00 da manhã para cancelar salas esquecidas abertas no dia anterior.

- **Time Parser e Fallbacks:** Compreensão tolerante a falhas. O bot entende variações de tempo (22h, 22:30, 22hrs) e converte para o banco. Se o usuário digitar texto no lugar da hora (ex: !lobby Corujão), o bot compreende o contexto e transforma o input no título da sala.

- **Persistência e Alta Concorrência (SQLite):** Suporte a múltiplas partidas simultâneas no mesmo grupo com IDs recicláveis (Lobby #1, #2). Dados protegidos em banco relacional, imunes a quedas do servidor ou reinicializações.

- **Notificações Cirúrgicas (Ghost Mentions):** Avisa os jogadores forçando o celular a apitar de forma invisível (via array de IDs do WhatsApp), sem poluir a tela do chat com dezenas de @numeros.

- **Passagem de Coroa e Gestão de Sessão:** O dono da sala pode alterar título e horário em tempo real. Caso o líder desista e saia da fila, o bot transfere os privilégios de "Admin" automaticamente para o próximo titular da lista.

---

## 🛠️ Tabela de Comandos

| Comando                    | Descrição                                                                                                    |
| :------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `!lobby [hora]`            | Abre uma sala com 5 vagas. O horário é opcional (ex: `!lobby 21h`).                                          |
| `!mix [hora]`              | Abre uma sala 5x5 com 10 vagas.                                                                              |
| `!eu`                      | Confirma sua presença no time titular ou entra na fila de suplentes.                                         |
| `!sair`                    | Remove seu nome da partida e passa a vaga pro próximo.                                                       |
| `!meunick [nome]`          | Cadastra ou altera o seu nick exibido nas listas do bot.                                                     |
| `!status`                  | Espia o painel da partida atual sem precisar entrar nela.                                                    |
| `!horario [hora]`          | Altera o horário da partida (Apenas o criador).                                                              |
| `!titulo [nome]`           | Altera o título da partida (Apenas o criador).                                                               |
| `!cancelar`                | Derruba a lista atual e reseta a sessão (Apenas o criador).                                                  |
| `!start`                   | Conclui a partida, libera o ID da sala para uso futuro e contabiliza +1 jogo nas estatísticas dos titulares. |
| `!silenciar`               | Não receberá notificação quando uma lobby for criada.                                                        |
| `!notificar`               | Reativa a notificação quando uma lobby for criada.                                                           |
| `!kick [posição na lista]` | Remove jogador que não compareceu na lobby.                                                                  |
| `!comandos`                | Exibe o menu de ajuda no chat.                                                                               |

_(Nota: O bot possui tratamento de strings para aceitar variações naturais como `!horas`, `!hrs`, `!horário`, `!título`, etc)._

---

## 🛠️ Tecnologias Utilizadas

- Node.js
- [whatsapp-web.js](https://wwebjs.dev/) (Integração com o WhatsApp)
- SQLite (Banco de dados leve e rápido)
- qrcode-terminal (Geração do QR Code de autenticação no terminal)
- Linux/Ubuntu (Ambiente)

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

No meu caso o projeto esta rodando de forma autônoma em um server Linux utilizando o **PM2**.

1. Instale o PM2 globalmente: `npm install -g pm2`
2. Inicie o daemon: `pm2 start index.js --name "bot-cs2"`
3. Salve a inicialização automática: `pm2 save`

## 🔒 Segurança e Boas Práticas (Importante)

Se for fazer um fork ou clonar este projeto, certifique-se de manter o arquivo .gitignore configurado corretamente para nunca subir as seguintes pastas/arquivos para repositórios públicos:

- .wwebjs_auth/ (Contém seu token de sessão do WhatsApp)
- .env (Contém seus links e possíveis chaves de API)
- .sqlite e .sqlite-journal (Contém a relação de IDs/Telefones reais dos usuários do seu grupo)

## 🚧 Roadmap (Versão 2.0 em breve)

- [ ] Sorteio automático de times CT e TR para o comando !mix.
- [ ] Integração com a API das plataformas para puxar Win Rate e K/D médio do lobby.
