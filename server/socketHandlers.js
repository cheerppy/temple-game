const GameManager = require('./gameManager');
const {
    generateRoomId,
    assignRoles,
    generateAllCards,
    distributeCards,
    calculateVictoryGoal
} = require('./gameLogic');

function setupSocketHandlers(io) {
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

            // 再接続または新規参加をチェック
            const existingPlayer = game.players.find(p => p.name === playerName);
            
            if (!existingPlayer && game.players.length >= 10) {
                socket.emit('error', { message: 'ルームが満員です' });
                return;
            }

            if (!existingPlayer && game.gameState !== 'waiting') {
                socket.emit('error', { message: 'ゲームが既に開始されています' });
                return;
            }

            // プレイヤーを追加または更新
            GameManager.addPlayer(roomId, socket.id, playerName);
            
            socket.join(roomId);
            socket.roomId = roomId;

            io.to(roomId).emit('gameUpdate', game);
            
            game.messages.push({
                type: 'system',
                text: `${playerName} が${existingPlayer ? '再' : ''}参加しました`,
                timestamp: Date.now()
            });
            
            io.to(roomId).emit('newMessage', game.messages);
            
            // 全員にルーム一覧を更新
            io.emit('roomList', GameManager.getPublicRoomList());
            
            console.log(`${playerName} がルーム ${roomId} に参加`);
        });

        socket.on('sendChat', (message) => {
            const roomId = socket.roomId;
            const game = GameManager.get(roomId);
            
            if (!game || !message || message.length > 100) return;
            
            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;
            
            const chatMessage = {
                type: 'player',
                playerId: socket.id,
                playerName: player.name,
                text: message,
                timestamp: Date.now()
            };
            
            game.messages.push(chatMessage);
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
            game.totalTreasures = treasureCount;
            game.totalTraps = trapCount;
            
            // 勝利条件の設定
            const { treasureGoal, trapGoal } = calculateVictoryGoal(playerCount);
            game.treasureGoal = treasureGoal;
            game.trapGoal = trapGoal;

            // 最初のラウンドのカードを配布
            const { playerHands, remainingCards } = distributeCards(cards, playerCount, 5);
            game.playerHands = playerHands;
            game.remainingCards = remainingCards;
            
            // 各プレイヤーにカードを配る
            game.players.forEach((player, index) => {
                player.hand = playerHands[index];
            });

            game.gameState = 'playing';
            
            // ランダムなプレイヤーが最初の鍵を持つ
            const randomIndex = Math.floor(Math.random() * game.players.length);
            game.keyHolderId = game.players[randomIndex].id;
            game.currentRound = 1;
            game.cardsFlippedThisRound = 0;

            game.messages.push({
                type: 'system',
                text: 'ゲームが開始されました！',
                timestamp: Date.now()
            });

            io.to(roomId).emit('gameUpdate', game);
            io.to(roomId).emit('newMessage', game.messages);
            io.to(roomId).emit('roundStart', 1);
            
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
                endRound(game, roomId, io);
            }

            io.to(roomId).emit('gameUpdate', game);
            io.to(roomId).emit('newMessage', game.messages);
        });

        socket.on('disconnect', () => {
            const roomId = socket.roomId;
            if (!roomId) return;
            
            const roomDeleted = GameManager.removePlayer(roomId, socket.id);
            const game = GameManager.get(roomId);
            
            if (game) {
                const player = game.players.find(p => p.id === socket.id);
                if (player) {
                    game.messages.push({
                        type: 'system',
                        text: `${player.name} が切断しました`,
                        timestamp: Date.now()
                    });
                    
                    io.to(roomId).emit('gameUpdate', game);
                    io.to(roomId).emit('newMessage', game.messages);
                }
            }

            if (roomDeleted) {
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
}

function endRound(game, roomId, io) {
    game.currentRound++;
    game.cardsFlippedThisRound = 0;
    
    // 3秒後の処理を通知
    game.messages.push({
        type: 'system',
        text: `ラウンド ${game.currentRound - 1} 終了！3秒後に次のラウンドが始まります...`,
        timestamp: Date.now()
    });
    
    io.to(roomId).emit('gameUpdate', game);
    io.to(roomId).emit('newMessage', game.messages);
    
    // 3秒待機
    setTimeout(() => {
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
                    text: `ラウンド ${game.currentRound} 開始！各プレイヤーに${game.cardsPerPlayer}枚配布`,
                    timestamp: Date.now()
                });
                
                // ラウンド開始通知
                io.to(roomId).emit('roundStart', game.currentRound);
            } else {
                // カードが足りない場合もゲーム終了
                game.gameState = 'finished';
                game.winningTeam = 'guardian';
                game.victoryMessage = 'カードが尽きました！守護者チームの勝利です！';
            }
        }
        io.to(roomId).emit('gameUpdate', game);
    }, 3000);
}

module.exports = { setupSocketHandlers }