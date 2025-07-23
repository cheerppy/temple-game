updateGameUI() {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('room-info').style.display = 'none';
        document.getElementById('game-board').style.display = 'block';

        // 役職可能性とカード内訳を表示
        this.updateGameOverview();

        // 進捗バーを更新
        this.updateProgressBars();

        // ゲーム情報の更新
        document.getElementById('current-round').textContent = this.gameData.currentRound;
        document.getElementById('treasure-found').textContent = this.gameData.treasureFound || 0;
        document.getElementById('trap-triggered').textContent = this.gameData.trapTriggered || 0;
        document.getElementById('trap-goal').textContent = this.gameData.trapGoal || 2;
        document.getElementById('cards-per-player').textContent = this.gameData.cardsPerPlayer || 5;
        document.getElementById('cards-flipped').textContent = this.gameData.cardsFlippedThisRound || 0;

        // 鍵を持っているプレイヤー
        const keyHolder = this.gameData.players.find(p => p.id === this.gameData.keyHolderId);
        document.getElementById('key-holder-name').textContent = keyHolder?.name || '不明';
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        document.getElementById('turn-message').textContent = 
            isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...';

        // 役職表示
        this.showPlayerRole();

        // 自分のカード表示
        this.renderMyCards();

        // 他のプレイヤー表示
        this.renderOtherPlayers(isMyTurn);
    }

    updateGameOverview() {
        const playerCount = this.gameData.players.length;
        let roleText = '';
        let cardText = '';

        // 役職可能性
        switch(playerCount) {
            case 3:
                roleText = '探検家 1-2人、守護者 1-2人';
                cardText = '財宝5枚、罠2枚、空き部屋8枚';
                break;
            case 4:
                roleText = '探検家 2-3人、守護者 1-2人';
                cardText = '財宝6枚、罠2枚、空き部屋12枚';
                break;
            case 5:
                roleText = '探検家 3人、守護者 2人';
                cardText = '財宝7枚、罠2枚、空き部屋16枚';
                break;
            case 6:
                roleText = '探検家 4人、守護者 2人';
                cardText = '財宝8枚、罠2枚、空き部屋20枚';
                break;
            case 7:
                roleText = '探検家 4-5人、守護者 2-3人';
                cardText = '財宝7枚、罠2枚、空き部屋26枚';
                break;
            case 8:
                roleText = '探検家 5-6人、守護者 2-3人';
                cardText = '財宝8枚、罠2枚、空き部屋30枚';
                break;
            case 9:
                roleText = '探検家 6人、守護者 3人';
                cardText = '財宝9枚、罠2枚、空き部屋34枚';
                break;
            case 10:
                roleText = '探検家 6-7人、守護者 3-4人';
                cardText = '財宝10枚、罠3枚、空き部屋37枚';
                break;
        }

        document.getElementById('role-possibility-text').textContent = roleText;
        document.getElementById('card-distribution-text').textContent = cardText;
    }

    updateProgressBars() {
        const treasureTotal = this.gameData.treasureGoal || 7;
        const trapTotal = this.gameData.trapGoal || 2;
        const treasureFound = this.gameData.treasureFound || 0;
        const trapTriggered = this.gameData.trapTriggered || 0;

        // 財宝の進捗バー
        const treasureContainer = document.getElementById('treasure-icons');
        treasureContainer.innerHTML = '';
        for (let i = 0; i < treasureTotal; i++) {
            const icon = document.createElement('div');
            icon.className = 'progress-icon treasure';
            if (i < treasureFound) {
                icon.classList.add('used');
            }
            treasureContainer.appendChild(icon);
        }

        // 罠の進捗バー
        const trapContainer = document.getElementById('trap-icons');
        trapContainer.innerHTML = '';
        for (let i = 0; i < trapTotal; i++) {
            const icon = document.createElement('div');
            icon.className = 'progress-icon trap';
            if (i < trapTriggered) {
                icon.classList.add('used');
            }
               trapContainer.appendChild(icon);
        }  // for の終わり
    }  // ✅ ← 追加！関数の終わり

 } 
    class TreasureTempleGame {

    class TreasureTempleGame {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        
        this.initializeSocket();
        this.initializeEventListeners();
    }

    initializeSocket() {
        // Socket.io接続設定（修正版）
        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        });

        // 接続イベント
        this.socket.on('connect', () => {
            this.mySocketId = this.socket.id;
            this.showConnectionStatus('connected');
            console.log('サーバーに接続しました');
        });

        // 切断イベント
        this.socket.on('disconnect', () => {
            this.showConnectionStatus('disconnected');
            console.log('サーバーから切断されました');
        });

        // ルーム一覧受信
        this.socket.on('roomList', (rooms) => {
            this.updateRoomList(rooms);
        });

        // ルーム作成完了
        this.socket.on('roomCreated', (data) => {
            this.roomId = data.roomId;
            this.gameData = data.gameData;
            this.isHost = true;
            this.showRoomInfo();
        });

        // ゲーム状態更新
        this.socket.on('gameUpdate', (gameData) => {
            this.gameData = gameData;
            this.updateUI();
        });

        // メッセージ受信
        this.socket.on('newMessage', (messages) => {
            this.updateMessages(messages);
        });

        // エラー処理
        this.socket.on('error', (error) => {
            this.showError(error.message);
        });

        // 接続エラー処理
        this.socket.on('connect_error', (error) => {
            console.error('接続エラー:', error);
            this.showError('サーバーに接続できません');
        });
    }

    initializeEventListeners() {
        // パスワード使用チェックボックス
        document.getElementById('use-password').addEventListener('change', (e) => {
            document.getElementById('password-group').style.display = 
                e.target.checked ? 'block' : 'none';
        });

        // 各種ボタンのイベント
        document.getElementById('create-room').addEventListener('click', () => this.createRoom());
        document.getElementById('join-room').addEventListener('click', () => this.joinRoom());
        document.getElementById('leave-room').addEventListener('click', () => this.leaveRoom());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('return-to-lobby').addEventListener('click', () => this.returnToLobby());
        document.getElementById('refresh-rooms').addEventListener('click', () => {
            this.socket.emit('getRoomList');
        });

        // チャット機能
        document.getElementById('send-chat').addEventListener('click', () => this.sendChat());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });
    }

    showConnectionStatus(status) {
        const statusEl = document.getElementById('connection-status');
        if (status === 'connected') {
            statusEl.textContent = '🟢 接続済み';
            statusEl.className = 'connection-status connected';
        } else {
            statusEl.textContent = '🔴 切断';
            statusEl.className = 'connection-status disconnected';
        }
    }

    showError(message) {
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }

    updateRoomList(rooms) {
        const container = document.getElementById('room-list-container');
        container.innerHTML = '';

        if (rooms.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #87CEEB;">現在開設中のルームはありません</p>';
            return;
        }

        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'room-item-info';
            infoDiv.innerHTML = `
                <strong>ID: ${room.id}</strong>
                ${room.hasPassword ? '<span class="password-icon">🔒</span>' : ''}
                <br>
                ホスト: ${room.hostName} | プレイヤー: ${room.playerCount}/10
            `;
            
            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn';
            joinBtn.textContent = '参加';
            joinBtn.onclick = () => {
                document.getElementById('room-id-input').value = room.id;
                if (room.hasPassword) {
                    document.getElementById('join-password-group').style.display = 'block';
                }
            };
            
            roomDiv.appendChild(infoDiv);
            roomDiv.appendChild(joinBtn);
            container.appendChild(roomDiv);
        });
    }

    createRoom() {
        const nameInput = document.getElementById('player-name-create');
        const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const hasPassword = document.getElementById('use-password').checked;
        const password = hasPassword ? document.getElementById('room-password').value : '';
        
        this.myName = playerName;
        this.showPlayerName();
        
        this.socket.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom() {
        const nameInput = document.getElementById('player-name-join');
        const roomInput = document.getElementById('room-id-input');
        const passwordInput = document.getElementById('join-password');
        
        const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput.value.trim().toUpperCase();
        const password = passwordInput.value;

        if (!roomId) {
            this.showError('ルームIDを入力してください');
            return;
        }

        this.myName = playerName;
        this.showPlayerName();
        this.roomId = roomId;
        
        this.socket.emit('joinRoom', { roomId, playerName, password });
    }

    showPlayerName() {
        document.getElementById('player-name-display').style.display = 'block';
        document.getElementById('my-name').textContent = this.myName;
    }

    showRoomInfo() {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('room-info').style.display = 'block';
        document.getElementById('game-board').style.display = 'none';
        document.getElementById('room-id-display').textContent = this.roomId;
    }

    updateUI() {
        if (!this.gameData) return;

        this.updatePlayersList();

        if (this.gameData.gameState === 'waiting') {
            this.updateLobbyUI();
        } else if (this.gameData.gameState === 'playing') {
            this.updateGameUI();
        } else if (this.gameData.gameState === 'finished') {
            this.showVictoryScreen();
        }
    }

    updatePlayersList() {
        const container = document.getElementById('players-list');
        const players = this.gameData.players || [];
        const count = players.filter(p => p.connected).length;
        
        document.getElementById('player-count').textContent = count;
        
        container.innerHTML = '';
        players.forEach((player) => {
            const div = document.createElement('div');
            div.className = 'player-item';
            if (player.id === this.gameData.host) {
                div.classList.add('host');
            }
            
            const status = player.connected ? '🟢' : '🔴';
            div.textContent = `${status} ${player.name}`;
            
            container.appendChild(div);
        });

        const startButton = document.getElementById('start-game');
        if (this.isHost && count >= 3) {
            startButton.style.display = 'block';
        } else {
            startButton.style.display = 'none';
        }
    }

    updateLobbyUI() {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('room-info').style.display = 'block';
        document.getElementById('game-board').style.display = 'none';
    }

    updateGameUI() {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('room-info').style.display = 'none';
        document.getElementById('game-board').style.display = 'block';

        // ゲーム情報の更新
        document.getElementById('current-round').textContent = this.gameData.currentRound;
        document.getElementById('treasure-found').textContent = this.gameData.treasureFound || 0;
        document.getElementById('trap-triggered').textContent = this.gameData.trapTriggered || 0;
        document.getElementById('trap-goal').textContent = this.gameData.trapGoal || 2;
        document.getElementById('cards-per-player').textContent = this.gameData.cardsPerPlayer || 5;
        document.getElementById('cards-flipped').textContent = this.gameData.cardsFlippedThisRound || 0;

        // 鍵を持っているプレイヤー
        const keyHolder = this.gameData.players.find(p => p.id === this.gameData.keyHolderId);
        document.getElementById('key-holder-name').textContent = keyHolder?.name || '不明';
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        document.getElementById('turn-message').textContent = 
            isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...';

        // 役職表示
        this.showPlayerRole();

        // 自分のカード表示
        this.renderMyCards();

        // 他のプレイヤー表示
        this.renderOtherPlayers(isMyTurn);
    }

    showPlayerRole() {
        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        const myRole = myPlayer?.role;
        const roleCard = document.getElementById('role-reveal');
        const roleText = document.getElementById('player-role');
        const roleDesc = document.getElementById('role-description');
        const roleImage = document.getElementById('role-image');

        if (myRole === 'adventurer') {
            roleCard.className = 'role-card role-adventurer';
            roleText.textContent = '⛏️ 探検家 (Adventurer)';
            roleDesc.textContent = '財宝を7個すべて見つけることが目標です！';
            roleImage.src = 'images/role-adventurer.png';
            roleImage.alt = '探検家';
        } else if (myRole === 'guardian') {
            roleCard.className = 'role-card role-guardian';
            roleText.textContent = '🛡️ 守護者 (Guardian)';
            roleDesc.textContent = '罠をすべて発動させるか、4ラウンド終了まで財宝を守ることが目標です！';
            roleImage.src = 'images/role-guardian.png';
            roleImage.alt = '守護者';
        }
    }

    renderMyCards() {
        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        if (!myPlayer || !myPlayer.hand) return;

        const container = document.getElementById('my-cards-grid');
        container.innerHTML = '';

        let treasureCount = 0, trapCount = 0, emptyCount = 0;
        
        myPlayer.hand.forEach((card, index) => {
            const div = document.createElement('div');
            div.className = 'card';
            
            if (card.revealed) {
                div.classList.add('revealed', card.type);
                switch (card.type) {
                    case 'treasure':
                        div.textContent = '💎';
                        break;
                    case 'trap':
                        div.textContent = '💀';
                        break;
                    case 'empty':
                        div.textContent = '📦';
                        break;
                }
            } else {
                div.textContent = '?';
                switch (card.type) {
                    case 'treasure':
                        treasureCount++;
                        break;
                    case 'trap':
                        trapCount++;
                        break;
                    case 'empty':
                        emptyCount++;
                        break;
                }
            }
            
            container.appendChild(div);
        });

        document.getElementById('my-treasure').textContent = treasureCount;
        document.getElementById('my-trap').textContent = trapCount;
        document.getElementById('my-empty').textContent = emptyCount;
    }

    renderOtherPlayers(isMyTurn) {
        const container = document.getElementById('other-players-container');
        container.innerHTML = '';

        this.gameData.players.forEach((player) => {
            if (player.id === this.mySocketId) return;

            const playerBox = document.createElement('div');
            playerBox.className = 'other-player-box';
            if (player.id === this.gameData.keyHolderId) {
                playerBox.classList.add('has-key');
            }

            const header = document.createElement('h4');
            header.textContent = player.name;
            if (player.id === this.gameData.keyHolderId) {
                header.textContent += ' 🗝️';
            }
            playerBox.appendChild(header);

            const cardsGrid = document.createElement('div');
            cardsGrid.className = 'other-player-cards';

            player.hand.forEach((card, index) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'other-card';
                
                if (card.revealed) {
                    cardDiv.classList.add('revealed', card.type);
                    switch (card.type) {
                        case 'treasure':
                            cardDiv.textContent = '💎';
                            break;
                        case 'trap':
                            cardDiv.textContent = '💀';
                            break;
                        case 'empty':
                            cardDiv.textContent = '📦';
                            break;
                    }
                } else {
                    cardDiv.textContent = '❓';
                    if (isMyTurn && !card.revealed) {
                        cardDiv.addEventListener('click', () => {
                            this.selectCard(player.id, index);
                        });
                    } else {
                        cardDiv.classList.add('disabled');
                    }
                }
                
                cardsGrid.appendChild(cardDiv);
            });

            playerBox.appendChild(cardsGrid);
            container.appendChild(playerBox);
        });
    }

    selectCard(targetPlayerId, cardIndex) {
        this.socket.emit('selectCard', { targetPlayerId, cardIndex });
    }

    updateMessages(messages) {
        const container = document.getElementById('chat-container');
        const recentMessages = messages.slice(-20);
        
        container.innerHTML = '';
        recentMessages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.type}`;
            
            if (msg.type === 'player') {
                div.textContent = `${msg.playerName}: ${msg.text}`;
                if (msg.playerId === this.mySocketId) {
                    div.classList.add('own');
                }
            } else {
                div.textContent = msg.text;
            }
            
            container.appendChild(div);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message || !this.roomId) return;
        
        this.socket.emit('sendChat', message);
        input.value = '';
    }

    showRoundStart(roundNumber) {
        const overlay = document.getElementById('round-start-overlay');
        const message = document.getElementById('round-start-message');
        
        message.textContent = `ラウンド ${roundNumber} スタート！`;
        overlay.style.display = 'flex';
        
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 3000);
    }

    showVictoryScreen() {
        const screen = document.getElementById('victory-screen');
        const title = document.getElementById('victory-title');
        const messageEl = document.getElementById('victory-message');
        const winnersList = document.getElementById('winners-list');
        
        if (this.gameData.winningTeam === 'adventurer') {
            title.textContent = '⛏️ 探検家チームの勝利！';
            title.style.color = '#FFD700';
        } else {
            title.textContent = '🛡️ 守護者チームの勝利！';
            title.style.color = '#DC143C';
        }
        
        messageEl.textContent = this.gameData.victoryMessage;
        
        winnersList.innerHTML = '<h3>勝利チーム:</h3>';
        this.gameData.players.forEach((player) => {
            if ((this.gameData.winningTeam === 'adventurer' && player.role === 'adventurer') ||
                (this.gameData.winningTeam === 'guardian' && player.role === 'guardian')) {
                const div = document.createElement('div');
                div.textContent = `🎉 ${player.name}`;
                div.style.color = '#FFD700';
                winnersList.appendChild(div);
            }
        });
        
        screen.style.display = 'flex';
    }

    startGame() {
        this.socket.emit('startGame');
    }

    leaveRoom() {
        this.socket.emit('leaveRoom');
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        
        document.getElementById('lobby').style.display = 'block';
        document.getElementById('room-info').style.display = 'none';
        document.getElementById('game-board').style.display = 'none';
        document.getElementById('victory-screen').style.display = 'none';
    }

    returnToLobby() {
        this.leaveRoom();
    }
}

// ゲーム開始
document.addEventListener('DOMContentLoaded', () => {
    const game = new TreasureTempleGame();
    
    // デバッグ用
    window.game = game;
});
