
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ゲームマネージャー
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
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function assignRoles(playerCount) {
    let adventurerCount, guardianCount, extraCard;
    
    switch(playerCount) {
        case 3:
            adventurerCount = 2;
            guardianCount = 2;
            extraCard = true;
            break;
        case 4:
            adventurerCount = 3;
            guardianCount = 2;
            extraCard = true;
            break;
        case 5:
            adventurerCount = 3;
            guardianCount = 2;
            extraCard = false;
            break;
        case 6:
            adventurerCount = 4;
            guardianCount = 2;
            extraCard = false;
            break;
        case 7:
            adventurerCount = 5;
            guardianCount = 3;
            extraCard = true;
            break;
        case 8:
            adventurerCount = 6;
            guardianCount = 3;
            extraCard = true;
            break;
        case 9:
            adventurerCount = 6;
            guardianCount = 3;
            extraCard = false;
            break;
        case 10:
            adventurerCount = 7;
            guardianCount = 4;
            extraCard = true;
            break;
        default:
            adventurerCount = Math.ceil(playerCount * 0.6);
            guardianCount = Math.floor(playerCount * 0.4);
            extraCard = false;
    }

    const totalCards = extraCard ? playerCount + 1 : playerCount;
    const roles = [];
    
    for (let i = 0; i < adventurerCount; i++) {
        roles.push('adventurer');
    }
    for (let i = 0; i < guardianCount; i++) {
        roles.push('guardian');
    }
    
    if (extraCard) {
        roles.push(Math.random() < 0.6 ? 'adventurer' : 'guardian');
    }
    
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    return roles.slice(0, playerCount);
}

function generateAllCards(playerCount) {
    let treasureCount, trapCount, emptyCount;

    switch(playerCount) {
        case 3:
            treasureCount = 5;
            trapCount = 2;
            emptyCount = 8;
            break;
        case 4:
            treasureCount = 6;
            trapCount = 2;
            emptyCount = 12;
            break;
        case 5:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 16;
            break;
        case 6:
            treasureCount = 8;
            trapCount = 2;
            emptyCount = 20;
            break;
        case 7:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 26;
            break;
        case 8:
            treasureCount = 8;
            trapCount = 2;
            emptyCount = 30;
            break;
        case 9:
            treasureCount = 9;
            trapCount = 2;
            emptyCount = 34;
            break;
        case 10:
            treasureCount = 10;
            trapCount = 3;
            emptyCount = 37;
            break;
        default:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 16;
    }

    const cards = [];
    for (let i = 0; i < treasureCount; i++) {
        cards.push({ type: 'treasure', id: `treasure-${i}` });
    }
    for (let i = 0; i < trapCount; i++) {
        cards.push({ type: 'trap', id: `trap-${i}` });
    }
    for (let i = 0; i < emptyCount; i++) {
        cards.push({ type: 'empty', id: `empty-${i}` });
    }
    
    return { cards, treasureCount, trapCount };
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function distributeCards(allCards, playerCount, cardsPerPlayer) {
    const shuffledCards = shuffleArray([...allCards]);
    const playerHands = {};
    
    for (let i = 0; i < playerCount; i++) {
        const hand = shuffledCards.splice(0, cardsPerPlayer);
        playerHands[i] = shuffleArray(hand);
    }
    
    return { playerHands, remainingCards: shuffledCards };
}

// Socket.io イベントハンドラー
io.on('connection', (socket) => {
    console.log('新しい接続:', socket.id);

    // ルーム一覧を送信
    socket.emit('roomList', GameManager.getPublicRoomList());

    socket.on('getRoomList', () => {
        socket.emit('roomList', GameManager.getPublicRoomList());
    });

    socket.on('createRoom', (data) => {
        const { playerName, hasPassword, password } = data;
        const roomId = generateRoomId();
        const game = GameManager.create(roomId, socket.id, playerName, hasPassword, password);
        
        socket.join(roomId);
        socket.roomId = roomId;
        
        socket.emit('roomCreated', { roomId, gameData: game });
        
        // 全員にルーム一覧を更新
        io.emit('roomList', GameManager.getPublicRoomList());
        
        console.log(`ルーム ${roomId} が作成されました`);
    });

    socket.on('joinRoom', (data) => {
        const { roomId, playerName, password } = data;
        const game = GameManager.get(roomId);

        if (!game) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }

        if (game.password && game.password !== password) {
            socket.emit('error', { message: 'パスワードが違います' });
            return;
        }

        if (game.players.length >= 10) {
            socket.emit('error', { message: 'ルームが満員です' });
            return;
        }

        if (game.gameState !== 'waiting') {
            socket.emit('error', { message: 'ゲームが既に開始されています' });
            return;
        }

        const player = game.players.find(p => p.name === playerName);
        if(player){
            player.id = socket.id; // 既存のプレイヤーのIDを更新
        } else {
            game.players.push({
                id: socket.id,
                name: playerName,
                role: null,
                hand: [],
                connected: true
            });
        }

        socket.join(roomId);
        socket.roomId = roomId;

        io.to(roomId).emit('gameUpdate', game);
        
        game.messages.push({
            type: 'system',
            text: `${playerName} が参加しました`,
            timestamp: Date.now()
        });
        
        io.to(roomId).emit('newMessage', game.messages);
        
        // 全員にルーム一覧を更新
        io.emit('roomList', GameManager.getPublicRoomList());
        
        console.log(`${playerName} がルーム ${roomId} に参加`);
    });

    socket.on('sendChat', (data) => {
        const { roomId, playerName, message } = data;
        const game = GameManager.get(roomId);

        game.messages.push({
            type: 'chat',
            text: `${playerName}: ${message}`,
            timestamp: Date.now()
        });
        io.to(roomId).emit('newMessage', game.messages);

    });

    socket.on('startGame', () => {
        const roomId = socket.roomId;
        const game = GameManager.get(roomId);

        if (!game || game.host !== socket.id) {
            return;
        }

        if (game.players.length < 3) {
            socket.emit('error', { message: '3人以上必要です' });
            return;
        }

        const playerCount = game.players.length;
        
        // 役職を割り当て
        const roles = assignRoles(playerCount);
        game.players.forEach((player, index) => {
            player.role = roles[index];
        });

        // カードを生成
        const { cards, treasureCount, trapCount } = generateAllCards(playerCount);
        game.allCards = cards;
        
        // 勝利条件の設定
        game.treasureGoal = 7;
        game.trapGoal = playerCount === 10 ? 3 : 2;

        // 最初のラウンドのカードを配布
        const { playerHands, remainingCards } = distributeCards(cards, playerCount, 5);
        game.playerHands = playerHands;
        game.remainingCards = remainingCards;
        
        // 各プレイヤーにカードを配る
        game.players.forEach((player, index) => {
            player.hand = playerHands[index];
        });

        game.gameState = 'playing';
        game.keyHolderId = game.players[0].id;
        game.currentRound = 1;
        game.cardsFlippedThisRound = 0;

        game.messages.push({
            type: 'system',
            text: 'ゲームが開始されました！ラウンド1',
            timestamp: Date.now()
        });

        io.to(roomId).emit('gameUpdate', game);
        io.to(roomId).emit('newMessage', game.messages);
        
        // 全員にルーム一覧を更新
        io.emit('roomList', GameManager.getPublicRoomList());
        
        console.log(`ルーム ${roomId} でゲーム開始`);
    });

    socket.on('selectCard', (data) => {
        const { targetPlayerId, cardIndex } = data;
        const roomId = socket.roomId;
        const game = GameManager.get(roomId);

        if (!game || game.gameState !== 'playing') {
            return;
        }

        if (game.keyHolderId !== socket.id) {
            socket.emit('error', { message: 'あなたのターンではありません' });
            return;
        }

        if (targetPlayerId === socket.id) {
            socket.emit('error', { message: '自分以外のプレイヤーを選んでください' });
            return;
        }

        const targetPlayer = game.players.find(p => p.id === targetPlayerId);
        if (!targetPlayer || !targetPlayer.hand[cardIndex] || targetPlayer.hand[cardIndex].revealed) {
            return;
        }

        // カードを公開
        const revealedCard = targetPlayer.hand[cardIndex];
        revealedCard.revealed = true;

        let message = `${targetPlayer.name} の`;
        switch (revealedCard.type) {
            case 'treasure':
                game.treasureFound++;
                message += '財宝が発見されました！💎';
                break;
            case 'trap':
                game.trapTriggered++;
                message += '罠が発動しました！💀';
                break;
            case 'empty':
                message += '空き部屋でした 📦';
                break;
        }

        game.messages.push({
            type: 'system',
            text: message,
            timestamp: Date.now()
        });

        // 鍵を渡す
        game.keyHolderId = targetPlayerId;
        game.cardsFlippedThisRound++;

        // 勝利条件をチェック
        if (game.treasureFound >= game.treasureGoal) {
            game.gameState = 'finished';
            game.winningTeam = 'adventurer';
            game.victoryMessage = `${game.treasureGoal}個の財宝を発見しました！探検家チームの勝利です！`;
        } else if (game.trapTriggered >= game.trapGoal) {
            game.gameState = 'finished';
            game.winningTeam = 'guardian';
            game.victoryMessage = `${game.trapGoal}個の罠が発動しました！守護者チームの勝利です！`;
        } else if (game.cardsFlippedThisRound >= game.players.length) {
            // ラウンド終了処理
            endRound(game, roomId);
        }

        io.to(roomId).emit('gameUpdate', game);
        io.to(roomId).emit('newMessage', game.messages);
    });

    function endRound(game, roomId) {
        game.currentRound++;
        game.cardsFlippedThisRound = 0;
        
        if (game.currentRound > game.maxRounds) {
            // ゲーム終了
            game.gameState = 'finished';
            game.winningTeam = 'guardian';
            game.victoryMessage = '4ラウンドが終了しました！財宝を守り切った守護者チームの勝利です！';
        } else {
            // 次のラウンドの準備
            game.cardsPerPlayer = Math.max(1, 6 - game.currentRound);
            
            // カードを回収して再配布
            const allRemainingCards = [];
            
            // プレイヤーの手札から未公開のカードを回収
            game.players.forEach(player => {
                player.hand.forEach(card => {
                    if (!card.revealed) {
                        allRemainingCards.push(card);
                    }
                });
            });
            
            // 残りのカードと合わせる
            allRemainingCards.push(...game.remainingCards);
            
            if (allRemainingCards.length >= game.players.length * game.cardsPerPlayer) {
                const { playerHands, remainingCards } = distributeCards(
                    allRemainingCards, 
                    game.players.length, 
                    game.cardsPerPlayer
                );
                
                game.playerHands = playerHands;
                game.remainingCards = remainingCards;
                
                game.players.forEach((player, index) => {
                    player.hand = playerHands[index];
                });
                
                game.messages.push({
                    type: 'system',
                    text: `ラウンド ${game.currentRound} を開始します！各プレイヤーに${game.cardsPerPlayer}枚配布`,
                    timestamp: Date.now()
                });
            } else {
                // カードが足りない場合もゲーム終了
                game.gameState = 'finished';
                game.winningTeam = 'guardian';
                game.victoryMessage = 'カードが尽きました！守護者チームの勝利です！';
            }
        }
    }

    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        
        const game = GameManager.get(roomId);
        if (!game) return;

        const player = game.players.find(p => p.id === socket.id);
        
        if (player) {
            player.connected = false;
            game.messages.push({
                type: 'system',
                text: `${player.name} が切断しました`,
                timestamp: Date.now()
            });
            
            io.to(roomId).emit('gameUpdate', game);
            io.to(roomId).emit('newMessage', game.messages);
        }

        if (game.players.every(p => !p.connected)) {
            GameManager.delete(roomId);
            io.emit('roomList', GameManager.getPublicRoomList());
            console.log(`ルーム ${roomId} を削除`);
        }
    });

    socket.on('leaveRoom', () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        
        const game = GameManager.get(roomId);
        if (!game) return;

        game.players = game.players.filter(p => p.id !== socket.id);
        
        socket.leave(roomId);
        socket.roomId = null;

        if (game.players.length === 0) {
            GameManager.delete(roomId);
        } else {
            io.to(roomId).emit('gameUpdate', game);
        }
        
        io.emit('roomList', GameManager.getPublicRoomList());
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});
