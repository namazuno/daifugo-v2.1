
        const express = require("express");
        const socketIO = require("socket.io");

        const app = express();
        const server = app.listen(3000, () => {
            console.log("Server running on port 3000");
        });

        const io = socketIO(server);

        let players = [];

        io.on("connection", (socket) => {
            console.log("a user connected");

            socket.on("joinGame", (name) => {
                players.push({ id: socket.id, name });
                io.emit("updatePlayers", players);
            });

            socket.on("startTurn", (turnPlayerId) => {
                const turnPlayer = players.find(p => p.id === turnPlayerId);
                if (turnPlayer) {
                    io.emit("turnStarted", turnPlayer);
                }
            });

            socket.on("disconnect", () => {
                console.log("a user disconnected");
                players = players.filter(p => p.id !== socket.id);
                io.emit("updatePlayers", players);
            });
        });
    