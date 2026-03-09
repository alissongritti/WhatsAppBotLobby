# 🎮 WhatsApp CS2 Matchmaking Bot

Um bot de WhatsApp construído em **Node.js** com a biblioteca `whatsapp-web.js`. Criado para acabar com a bagunça de organizar partidas de Counter-Strike 2 pelo WhatsApp, automatizando filas, gerenciando reservas e notificando a galera sem poluir o grupo.

---

## 🔥 Principais Funcionalidades

- **Fila Dinâmica e Transbordo Inteligente:** Criação de Lobbies (5 vagas) ou Mixes (10 vagas). Se a sala encher, os próximos vão para a fila de espera (suplentes). Se um titular sair (`!sair`), o bot promove o primeiro suplente automaticamente e avisa o grupo.

- **Motor de Tempo Autônomo (Cron Jobs):** O bot monitora o relógio em segundo plano. No horário exato da partida:
  - Se a sala estiver cheia: Dispara o alarme chamando os titulares pro jogo.
  - Se a sala estiver incompleta: Avisa os jogadores e sugere dar `!start` para jogar assim mesmo ou `!cancelar` para liberar a fila.
- **Trator de Salas Abandonadas (Anti-Ghost Lobbies):** Se uma partida não encher e o horário passar, ela não trava o bot. O próximo jogador que criar uma sala nova vai automaticamente "atropelar" a sala morta, cancelando-a por inatividade. Além disso, uma vassoura roda todo dia às 05:00 da manhã limpando qualquer resquício de dados no banco.

- **Central de E-sports (API PandaScore):** Traz jogos futuros e resultados de partidas profissionais de CS2 direto pro grupo. Conta com sistema de cache via banco de dados para evitar estouro de limite de requisições e filtro inteligente de fuso horário.

- **Segurança com Whitelist:** O bot possui um controle rígido de acesso. Se for adicionado a um grupo não autorizado, ele ignora os comandos silenciosamente e envia uma DM de alerta para o Administrador, que pode aprovar o grupo remotamente.

- **Persistência e Alta Concorrência (SQLite):** Suporte a múltiplas partidas simultâneas no mesmo grupo com IDs recicláveis (Lobby #1, #2). Dados protegidos em banco relacional, imunes a quedas do servidor ou reinicializações.

- **Notificações Cirúrgicas (Ghost Mentions):** Avisa os jogadores forçando o celular a apitar de forma invisível (via array de IDs do WhatsApp), sem poluir a tela do chat com dezenas de @numeros.

---

## 🛠️ Tabela de Comandos

| Comando                    | Descrição                                                                                                             |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `!lobby [hora]`            | Abre uma sala com 5 vagas. O horário é opcional (ex: `!lobby 21h`). Se houver uma sala inativa, ela será sobrescrita. |
| `!mix [hora]`              | Abre uma sala 5x5 com 10 vagas. Segue a mesma regra da lobby.                                                         |
| `!eu`                      | Confirma sua presença no time titular ou entra na fila de suplentes.                                                  |
| `!sair`                    | Remove seu nome da partida e passa a vaga pro próximo.                                                                |
| `!meunick [nome]`          | Cadastra ou altera o seu nick exibido nas listas do bot.                                                              |
| `!status`                  | Espia o painel da partida atual sem precisar entrar nela.                                                             |
| `!horario [hora]`          | Altera o horário da partida (Apenas o criador).                                                                       |
| `!titulo [nome]`           | Altera o título da partida (Apenas o criador).                                                                        |
| `!cancelar`                | Derruba a lista atual e reseta a sessão (Apenas o criador).                                                           |
| `!start`                   | Conclui a partida, libera o ID da sala para uso futuro e salva os stats.                                              |
| `!silenciar`               | Remove o jogador das notificações de criação de novas lobbies.                                                        |
| `!notificar`               | Reativa a notificação quando uma lobby for criada.                                                                    |
| `!kick [posição na lista]` | Remove jogador que não compareceu na lobby (Ex: !kick 3).                                                             |
| `!comandos`                | Exibe o menu de ajuda no chat.                                                                                        |
| `!discord`                 | Consulta o discord do grupo.                                                                                          |
| `!setdiscord [link]`       | Configura o link do Discord (Apenas o criador).                                                                       |
| `!jogos`                   | Consulta os jogos profissionais de CS2 que ainda vão acontecer hoje.                                                  |
| `!jogosbr`                 | Filtra apenas os próximos jogos de times brasileiros.                                                                 |
| `!resultados`              | Consulta os resultados e placares dos jogos que já acabaram hoje.                                                     |
| `!resultadosbr`            | Consulta os resultados apenas dos times brasileiros hoje.                                                             |
| `!aprovar [ID]`            | _(Apenas Admin DM)_ Libera o uso do bot em um grupo específico.                                                       |

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
- Conta e Token na API da PandaScore.

### Passo a Passo

1. **Clone este repositório:**

   ```bash
   git clone [https://github.com/alissongritti/WhatsAppBotLobby.git](https://github.com/alissongritti/WhatsAppBotLobby.git)
   cd WhatsAppBotLobby

   ```

2. **Instale as dependências:**

   ```bash
   npm install whatsapp-web.js qrcode-terminal dotenv sqlite3 sqlite axios

   ```

3. **Configure as Variáveis de Ambiente:**
   Crie um arquivo chamado .env na raiz do projeto e adicione o link do seu Discord:

   ```bash
   # Token da API de E-sports
   PANDASCORE_TOKEN=seu_token_aqui

   # ID do WhatsApp do Admin (DDI + DDD + Numero + @c.us)
   # Exemplo: 5511999998888@c.us
   ADMIN_WA_ID=seu_id_de_admin_aqui

   ```

4. **Inicie o bot:**

   ```bash
   node index.js

   ```

5. **Autenticação:**
   O terminal irá gerar um QR Code. Escaneie-o com o WhatsApp (Aparelhos Conectados) e aguarde a mensagem de confirmação no console.

---

## 💻 Rodando em Produção (Linux/VPS)

Se for hospedar em um servidor Linux, recomenda-se o uso do PM2:

- Instale o PM2 globalmente: npm install -g pm2
- Inicie o daemon: pm2 start index.js --name "bot-cs2"
- Salve a inicialização automática: pm2 save e pm2 startup

## 🔒 Segurança e Boas Práticas (Importante)

- **Whitelist de Grupos:** Por padrão, o bot nasce "trancado". Quando adicionado a um grupo novo, ele avisa o administrador no privado. O bot só passará a responder os comandos naquele grupo após o admin enviar !aprovar [ID_DO_GRUPO] via DM.
- **Gitignore:** Se for fazer um fork ou clonar este projeto, certifique-se de manter o arquivo `.gitignore` configurado corretamente para nunca subir as seguintes pastas/arquivos:

- `.wwebjs_auth/` (Contém seu token de sessão do WhatsApp)
- `.env` (Contém seus links e possíveis chaves de API)
- `bot_database.sqlite` e `.sqlite-journal` (Contém a relação de IDs/Telefones reais dos usuários do seu grupo)

## 🚧 Roadmap (Versão 2.0 em breve)

- [ ] Sorteio automático de times CT e TR para o comando `!mix`.
- [ ] Integração com a API das plataformas para puxar Win Rate e K/D médio do lobby.
- [ ] Ranking global de estatísticas de partidas (`!start`).
