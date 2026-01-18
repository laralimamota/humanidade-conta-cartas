const { io } = require("socket.io-client");
const readline = require("readline");

const API = "http://localhost:3000";
let token = null;
let socket = null;
let sala = null;
let mao = [];
let submissoes = [];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pergunta = (q) => new Promise((r) => rl.question(q, r));

async function http(method, path, body) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method, headers: h, body: body ? JSON.stringify(body) : null
  });
  return res.json();
}

function conectar() {
  if (!token) return console.log("Faça login primeiro!");

  socket = io(`${API}/game`, { auth: { token } });

  socket.on("connect", () => console.log("\n✓ Conectado!"));
  socket.on("error", (e) => console.log("Erro:", e.message));

  socket.on("lobby:created", (d) => {
    sala = d.code;
    console.log(`\n✓ Sala criada: ${d.code}`);
    console.log(`Jogadores: ${d.players.map(p => p.username).join(", ")}`);
  });

  socket.on("lobby:joined", (d) => {
    sala = d.code;
    console.log(`\n✓ Entrou na sala ${d.code}`);
  });

  socket.on("lobby:updated", (d) => {
    console.log(`\nLobby: ${d.players.map(p => `${p.username}${p.isReady ? '✓' : ''}`).join(", ")}`);
  });

  socket.on("game:started", (d) => {
    console.log("\n══════ JOGO COMEÇOU ══════");
    console.log(`Carta: "${d.blackCard.text}"`);
  });

  socket.on("game:hand", (d) => {
    mao = d.hand;
    console.log("\n─── SUAS CARTAS ───");
    d.hand.forEach((c, i) => console.log(`  ${i + 1}. ${c.text}`));
  });

  socket.on("game:new_round", (d) => {
    console.log(`\n══════ RODADA ${d.roundNumber} ══════`);
    console.log(`Carta: "${d.blackCard.text}"`);
  });

  socket.on("game:card_submitted", () => console.log("→ Alguém jogou"));

  socket.on("game:all_submitted", (d) => {
    submissoes = d.submissions;
    console.log("\n─── SUBMISSÕES ───");
    d.submissions.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.cards.map(c => c.text).join(" | ")}`);
    });
    console.log("\nCzar: use 'julgar <numero>' para escolher (ex: julgar 1)");
  });

  socket.on("game:round_winner", (d) => {
    console.log(`\n★ VENCEDOR: ${d.winnerUsername}`);
    if (d.gameEnded) console.log(`\n🏆 FIM DE JOGO! Vencedor: ${d.winnerUsername}`);
  });
}

async function main() {
  console.log(`
╔═══════════════════════════════════════╗
║     HUMANIDADE CONTA CARTAS           ║
╠═══════════════════════════════════════╣
║ registrar <email> <user> <senha>      ║
║ login <email> <senha>                 ║
║ conectar                              ║
║ criar                                 ║
║ entrar <CODIGO>                       ║
║ pronto                                ║
║ iniciar                               ║
║ jogar <numero>                        ║
║ julgar <id>                           ║
║ proxima                               ║
║ sair                                  ║
╚═══════════════════════════════════════╝
`);

  while (true) {
    const input = await pergunta("\n> ");
    const [cmd, ...args] = input.trim().split(" ");

    switch (cmd) {
      case "registrar":
        const reg = await http("POST", "/auth/register", {
          email: args[0], username: args[1], password: args[2]
        });
        if (reg.accessToken) { token = reg.accessToken; console.log(`✓ Registrado: ${reg.user.username}`); }
        else console.log("Erro:", reg.message);
        break;

      case "login":
        const log = await http("POST", "/auth/login", { email: args[0], password: args[1] });
        if (log.accessToken) { token = log.accessToken; console.log(`✓ Logado: ${log.user.username}`); }
        else console.log("Erro:", log.message);
        break;

      case "conectar": conectar(); break;
      case "criar": socket?.emit("lobby:create", { pointsToWin: 5 }); break;
      case "entrar": socket?.emit("lobby:join", { code: args[0]?.toUpperCase() }); break;
      case "pronto": socket?.emit("lobby:ready", { code: sala, isReady: true }); break;
      case "iniciar": socket?.emit("lobby:start", { code: sala }); break;

      case "jogar":
        const carta = mao[parseInt(args[0]) - 1];
        if (carta) {
          socket?.emit("game:pick_cards", { gameCode: sala, cardIds: [carta.id] });
          console.log(`Jogou: "${carta.text}"`);
        }
        break;

      case "julgar":
        const sub = submissoes[parseInt(args[0]) - 1];
        if (sub) {
          socket?.emit("game:judge_pick", { gameCode: sala, submissionId: sub.id });
        } else {
          console.log("Número inválido");
        }
        break;

      case "proxima":
        socket?.emit("game:next_round", { gameCode: sala });
        break;

      case "sair": process.exit(0);
    }
  }
}

main();
