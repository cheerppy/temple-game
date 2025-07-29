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

        socket.emit('roomList', GameManager.getPublicRoomList());

        socket.on('getRoomList', () => {
            socket.emit('roomList', GameManager.getPublicRoomList());
        });

        // 再接続処理を追加
        socket.on('reconnectToRoom', (data) => {
            const { roomId, playerName } = data;
            console.log(`再接続試行: ${playerName} -> ${roomId}`);
            
            const game = GameManager.get(roomId);
            if (!game) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }

            const player = game.players.find(p => p.name === playerName);
            if (!player) {
                socket.emit('error', { message: 'プレイヤーが見つかりません' });
                return;
            }

            // プレイヤー情報を更新
            player.id = socket.id;
            player.connected = true;
            
            socket.join(roomId);
            socket.roomId = roomId;

            // 再接続成功を通知
            socket.emit('reconnectSuccess', { 
                roomId, 
                gameData: game,
                isHost: game.host === player.id || game.host === playerName
            });

            // 他のプレイヤーに再接続を通知
            game.messages.push({
                type: 'system',
                text: `${playerName} が再接続しました`,
                timestamp: Date.now()
            });

            io.to(roomId).emit('gameUpdate', game);
            io.to(roomId).emit('newMessage', game.messages);
            
            console.log(`${playerName} が ${roomId} に再接続しました`);
        });

        socket.on('createRoom', (data) => {
            const { playerName, hasPassword, password } = data;
            const roomId = generateRoomId();
            const game = GameManager.create(roomId, socket.id, playerName, hasPassword, password);
            
            socket.join(roomId);
            socket.roomId = roomId;
            
            // ローカルストレージ用の情報を保存
            socket.emit('roomCreated', { 
                roomId, 
                gameData: game,
                playerInfo: { roomId, playerName, isHost: true }
            });
            
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

            const existingPlayer = game.players.find(p => p.name === playerName);
            
            if (!existingPlayer && game.players.length >= 10) {
                socket.emit('error', { message: 'ルームが満員です' });
                return;
            }

            if (!existingPlayer && game.gameState !== 'waiting') {
                socket.emit('error', { message: 'ゲームが既に開始されています' });
                return;
            }

            GameManager.addPlayer(roomId, socket.id, playerName);
            
            socket.join(roomId);
            socket.roomId = roomId;

            // 参加成功を通知（再接続情報付き）
            socket.emit('joinSuccess', {
                roomId,
                gameData: game,
                playerInfo: { roomId, playerName, isHost: game.host === socket.id }
            });

            io.to(roomId).emit('gameUpdate', game);
            
            game.messages.push({
                type: 'system',
                text: `${playerName} が${existingPlayer ? '再' : ''}参加しました`,
                timestamp: Date.now()
            });
            
            io.to(roomId).emit('newMessage', game.messages);
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
            
            const roles = assignRoles(playerCount);
            game.players.forEach((player, index) => {
                player.role = roles[index];
            });

            const { cards, treasureCount, trapCount } = generateAllCards(playerCount);
            game.allCards = cards;
            game.totalTreasures = treasureCount;
            game.totalTraps = trapCount;
            
            const { treasureGoal, trapGoal } = calculateVictoryGoal(playerCount);
            game.treasureGoal = treasureGoal;
            game.trapGoal = trapGoal;

            console.log(`ゲーム開始: ${playerCount}人, 財宝目標:${treasureGoal}, 罠目標:${trapGoal}`);

            const { playerHands, remainingCards } = distributeCards(cards, playerCount, 5);
            game.playerHands = playerHands;
            game.remainingCards = remainingCards;
            
            game.players.forEach((player, index) => {
                player.hand = playerHands[index];
            });

            game.gameState = 'playing';
            
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

            game.keyHolderId = targetPlayerId;
            game.cardsFlippedThisRound++;

            console.log(`カード公開: ${revealedCard.type}, 財宝発見:${game.treasureFound}/${game.treasureGoal}, 罠発動:${game.trapTriggered}/${game.trapGoal}`);

            if (game.treasureFound >= game.treasureGoal) {
                game.gameState = 'finished';
                game.winningTeam = 'adventurer';
                game.victoryMessage = `${game.treasureGoal}個の財宝を発見しました！探検家チームの勝利です！`;
                console.log('探検家チーム勝利！');
            } else if (game.trapTriggered >= game.trapGoal) {
                game.gameState = 'finished';
                game.winningTeam = 'guardian';
                game.victoryMessage = `${game.trapGoal}個の罠が発動しました！守護者チームの勝利です！`;
                console.log('守護者チーム勝利！');
            } else if (game.cardsFlippedThisRound >= game.players.length) {
                endRound(game, roomId, io);
            }

            io.to(roomId).emit('gameUpdate', game);
            io.to(roomId).emit('newMessage', game.messages);
        });

        socket.on('disconnect', () => {
            const roomId = socket.roomId;
            if (!roomId) return;
            
            const game = GameManager.get(roomId);
            if (game) {
                const player = game.players.find(p => p.id === socket.id);
                if (player) {
                    // 完全に削除するのではなく、切断状態にマーク
                    player.connected = false;
                    
                    game.messages.push({
                        type: 'system',
                        text: `${player.name} が切断しました（再接続可能）`,
                        timestamp: Date.now()
                    });
                    
                    io.to(roomId).emit('gameUpdate', game);
                    io.to(roomId).emit('newMessage', game.messages);
                }
            }

            // 5分後に完全にプレイヤーを削除
            setTimeout(() => {
                const gameAfterTimeout = GameManager.get(roomId);
                if (gameAfterTimeout) {
                    const disconnectedPlayer = gameAfterTimeout.players.find(p => p.id === socket.id && !p.connected);
                    if (disconnectedPlayer) {
                        gameAfterTimeout.players = gameAfterTimeout.players.filter(p => p.id !== socket.id);
                        
                        if (gameAfterTimeout.players.length === 0) {
                            GameManager.delete(roomId);
                            console.log(`ルーム ${roomId} を削除`);
                        } else {
                            io.to(roomId).emit('gameUpdate', gameAfterTimeout);
                        }
                        io.emit('roomList', GameManager.getPublicRoomList());
                    }
                }
            }, 5 * 60 * 1000); // 5分
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
    
    game.messages.push({
        type: 'system',
        text: `ラウンド ${game.currentRound - 1} 終了！3秒後に次のラウンドが始まります...`,
        timestamp: Date.now()
    });
    
    io.to(roomId).emit('gameUpdate', game);
    io.to(roomId).emit('newMessage', game.messages);
    
    setTimeout(() => {
        if (game.currentRound > game.maxRounds) {
            game.gameState = 'finished';
            game.winningTeam = 'guardian';
            game.victoryMessage = '4ラウンドが終了しました！財宝を守り切った守護者チームの勝利です！';
        } else {
            game.cardsPerPlayer = Math.max(1, 6 - game.currentRound);
            
            const allRemainingCards = [];
            
            game.players.forEach(player => {
                player.hand.forEach(card => {
                    if (!card.revealed) {
                        allRemainingCards.push(card);
                    }
                });
            });
            
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
                
                io.to(roomId).emit('roundStart', game.currentRound);
            } else {
                game.gameState = 'finished';
                game.winningTeam = 'guardian';
                game.victoryMessage = 'カードが尽きました！守護者チームの勝利です！';
            }
        }
        io.to(roomId).emit('gameUpdate', game);
    }, 3000);
}

module.exports = { setupSocketHandlers };
