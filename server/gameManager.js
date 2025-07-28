class GameManager {
    static games = {};

    static create(roomId, hostId, hostName, hasPassword = false, password = '') {
        const game = {
            id: roomId,
            host: hostId,
            password: hasPassword ? password : null,
            players: [{
                id: hostId,
                name: hostName,
                role: null,
                hand: [],
                connected: true
            }],
            gameState: 'waiting',
            currentRound: 1,
            treasureFound: 0,
            trapTriggered: 0,
            allCards: [],
            playerHands: {},
            remainingCards: [],
            cardsPerPlayer: 5,
            messages: [],
            treasureGoal: 7,
            trapGoal: 2,
            totalTreasures: 7,
            totalTraps: 2,
            keyHolderId: null,
            turnInRound: 0,
            maxRounds: 4,
            cardsFlippedThisRound: 0
        };
        
        this.games[roomId] = game;
        return game;
    }

    static get(roomId) {
        return this.games[roomId];
    }

    static delete(roomId) {
        delete this.games[roomId];
    }

    static getPublicRoomList() {
        return Object.values(this.games)
            .filter(game => game.gameState === 'waiting')
            .map(game => ({
                id: game.id,
                hostName: game.players.find(p => p.id === game.host)?.name || 'Unknown',
                playerCount: game.players.length,
                hasPassword: !!game.password
            }));
    }

    static addPlayer(roomId, playerId, playerName) {
        const game = this.games[roomId];
        if (!game) return null;

        const existingPlayer = game.players.find(p => p.name === playerName);
        if (existingPlayer) {
            // 既存プレイヤーの再接続
            existingPlayer.id = playerId;
            existingPlayer.connected = true;
            return existingPlayer;
        }

        // 新規プレイヤー
        const newPlayer = {
            id: playerId,
            name: playerName,
            role: null,
            hand: [],
            connected: true
        };
        game.players.push(newPlayer);
        return newPlayer;
    }

    static removePlayer(roomId, playerId) {
        const game = this.games[roomId];
        if (!game) return;

        const player = game.players.find(p => p.id === playerId);
        if (player) {
            player.connected = false;
        }

        // 全員が切断したらルームを削除
        if (game.players.every(p => !p.connected)) {
            delete this.games[roomId];
            return true; // ルームが削除された
        }
        return false;
    }

    static setGameState(roomId, state) {
        const game = this.games[roomId];
        if (game) {
            game.gameState = state;
        }
    }

    static updateGameData(roomId, updates) {
        const game = this.games[roomId];
        if (game) {
            Object.assign(game, updates);
        }
    }
}

module.exports = GameManager;