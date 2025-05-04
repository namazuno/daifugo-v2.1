const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const suits = ['♠', '♥', '♦', '♣'];
const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A', 2];
let players = [];
let hands = {};
let field = [];
let currentPlayerIndex = 0;
let gameStarted = false;
let passCount = 0;
let reversed = false;

function shuffleDeck() {
  const deck = [];
  for (let suit of suits) {
    for (let rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function dealCards() {
  const deck = shuffleDeck();
  const chunkSize = Math.floor(deck.length / players.length);
  players.forEach((p, index) => {
    hands[p.id] = deck.slice(index * chunkSize, (index + 1) * chunkSize);
  });
}

function getRankIndex(rank) {
  return ranks.indexOf(rank);
}

function compareCards(a, b) {
  const aIndex = getRankIndex(a.rank);
  const bIndex = getRankIndex(b.rank);
  return reversed ? aIndex < bIndex : aIndex > bIndex;
}

function canPlay(card) {
  if (field.length === 0) return true;
  const top = field[field.length - 1];
  return compareCards(card, top);
}

function checkVictory(id) {
  if (hands[id].length === 0) {
    const player = players.find(p => p.id === id);
    io.to(id).emit('message', '🎉 あがり！');
    io.emit('message', `🪄 ${player?.name || id} があがりました`);
    players = players.filter(p => p.id !== id);
    if (players.length <= 1) {
      io.emit('message', '🎊 ゲーム終了！');
      gameStarted = false;
      return;
    }
    if (currentPlayerIndex >= players.length) {
      currentPlayerIndex = 0;
    }
    const turnPlayerA = players.find(p => p.id === turn);
  io.emit('turn', turn, turnPlayerA ? turnPlayerA.name : '');
  }
}

io.on('connection', (socket) => {
  socket.on('registerName', (name) => {
    if (gameStarted) {
      socket.emit('message', 'ゲーム中です。次回をお待ちください。');
      return;
    }

    players.push({ id: socket.id, name });
    io.emit('message', `${name} が参加しました (${players.length}人)`);

    if (players.length >= 3 && !gameStarted) {
      gameStarted = true;
      dealCards();
      players.forEach(p => {
        io.to(p.id).emit('hand', hands[p.id]);
      });
      io.emit('fieldUpdate', field);
      const turnPlayerB = players.find(p => p.id === turn);
  io.emit('turn', turn, turnPlayerB ? turnPlayerB.name : '');
    }
  });

  socket.on('playCard', (card) => {
    const turnPlayerAlt = players[currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) return;
    if (!hands[socket.id].some(c => c.suit === card.suit && c.rank === card.rank)) return;
    if (!canPlay(card)) return;

    field.push(card);
    hands[socket.id] = hands[socket.id].filter(c => !(c.suit === card.suit && c.rank === card.rank));
    io.emit('fieldUpdate', field);
    io.to(socket.id).emit('hand', hands[socket.id]);

    // 特殊ルール処理
    if (card.rank === 8) {
      field = [];
      io.emit('message', '💥 8切り！場が流れます');
      io.emit('fieldUpdate', field);
    } else if (card.rank === 11) {
      reversed = !reversed;
      io.emit('message', '🔄 11バック！強さが逆転');
    }

    const count = hands[socket.id].filter(c => c.rank === card.rank).length + 1;
    if (count >= 4) {
      reversed = !reversed;
      io.emit('message', '🌀 革命発生！強弱逆転！');
    }

    passCount = 0;
    checkVictory(socket.id);

    if (gameStarted) {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      const turnPlayerB = players.find(p => p.id === turn);
  io.emit('turn', turn, turnPlayerB ? turnPlayerB.name : '');
    }
  });

  socket.on('pass', () => {
    const turnPlayerAlt = players[currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) return;

    io.emit('message', `${turnPlayerAlt.name} はパスしました`);
    passCount++;
    if (passCount >= players.length - 1) {
      field = [];
      io.emit('message', '🔁 全員パス。場が流れました');
      io.emit('fieldUpdate', field);
      passCount = 0;
    }

    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    const turnPlayerB = players.find(p => p.id === turn);
  io.emit('turn', turn, turnPlayerB ? turnPlayerB.name : '');
  });

  socket.on('disconnect', () => {
  const player = players.find(p => p.id === socket.id);
  if (player && player.name && gameStarted) {
    io.emit('reset');
    players = [];
    gameStarted = false;
  }
});
});

server.listen(3000, () => {
  console.log('サーバ起動：http://localhost:3000');
});