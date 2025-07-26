class TreasureTempleGame {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        
        // Socket通信管理クラスを初期化
        this.socketClient = new SocketClient(this);
        
        this.initializeEventListeners();
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
            this.socketClient.getRoomList();
        });

        // チャット機能
        document.getElementById('send-chat').addEventListener('click', () => this.sendChat());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });
    }

    createRoom() {
        const nameInput = document.getElementById('player-name-create');
        const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const hasPassword = document.getElementById('use-password').checked;
        const password = hasPassword ? document.getElementById('room-password').value : '';
        
        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        
        this.socketClient.createRoom(playerName, hasPassword, password);
    }

    joinRoom() {
        const nameInput = document.getElementById('player-name-join');
        const roomInput = document.getElementById('room-id-input');
        const passwordInput = document.getElementById('join-password');
        
        const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput.value.trim().toUpperCase();
        const password = passwordInput.value;

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        this.roomId = roomId;
        
        this.socketClient.joinRoom(roomId, playerName, password);
    }

    showRoomInfo() {
        UIManager.showScreen('room-info');
        document.getElementById('room-id-display').textContent = this.roomId;
    }

    updateUI() {
        if (!this.gameData) return;

        UIManager.updatePlayersList(this.gameData.players, this.gameData.host);

        if (this.gameData.gameState === 'waiting') {
            this.updateLobbyUI();
        } else if (this.gameData.gameState === 'playing') {
            this.updateGameUI();
        } else if (this.gameData.gameState === 'finished') {
            UIManager.showVictoryScreen(this.gameData);
        }
    }

    updateLobbyUI() {
        UIManager.showScreen('room-info');
        
        const startButton = document.getElementById('start-game');
        const count = this.gameData.players.filter(p => p.connected).length;
        if (this.isHost && count >= 3) {
            startButton.style.display = 'block';
        } else {
            startButton.style.display = 'none';
        }
    }

    updateGameUI() {
        UIManager.showScreen('game-board');

        // ゲーム概要とプログレスバーを更新
        UIManager.updateGameOverview(this.gameData.players.length);
        UIManager.updateProgressBars(this.gameData);
        UIManager.updateGameInfo(this.gameData);

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
                const img = document.createElement('img');
                img.className = 'card-image';
                img.src = `images/card-${card.type}-large.png`;
                img.alt = card.type;
                div.appendChild(img);
            } else {
                const img = document.createElement('img');
                img.className = 'card-image';
                img.src = 'images/card-back-large.png';
                img.alt = 'カード裏面';
                div.appendChild(img);
                
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
                const keyImg = document.createElement('img');
                keyImg.src = 'images/key-icon.png';
                keyImg.className = 'key-icon';
                keyImg.alt = '鍵';
                header.appendChild(keyImg);
            }
            playerBox.appendChild(header);

            const cardsGrid = document.createElement('div');
            cardsGrid.className = 'other-player-cards';

            player.hand.forEach((card, index) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'other-card';
                
                if (card.revealed) {
                    cardDiv.classList.add('revealed', card.type);
                    const img = document.createElement('img');
                    img.className = 'other-card-image';
                    img.src = `images/card-${card.type}-medium.png`;
                    img.alt = card.type;
                    cardDiv.appendChild(img);
                } else {
                    const img = document.createElement('img');
                    img.className = 'other-card-image';
                    img.src = 'images/card-back-medium.png';
                    img.alt = 'カード裏面';
                    cardDiv.appendChild(img);
                    
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
        this.socketClient.selectCard(targetPlayerId, cardIndex);
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message || !this.roomId) return;
        
        this.socketClient.sendChat(message);
        input.value = '';
    }

    startGame() {
        this.socketClient.startGame();
    }

    leaveRoom() {
        this.socketClient.leaveRoom();
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        
        UIManager.showScreen('lobby');
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