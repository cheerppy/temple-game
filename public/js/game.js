class TreasureTempleGame {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        this.isSpectator = false;
        
        this.socketClient = new SocketClient(this);
        this.initializeEventListeners();
        this.initializeErrorMonitoring();
        
        // ページ読み込み時に再接続を試行
        this.attemptReconnection();
    }

    // エラー監視の初期化
    initializeErrorMonitoring() {
        window.addEventListener('error', (event) => {
            this.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', {
                reason: event.reason,
                promise: event.promise
            });
        });

        this.socketErrorCount = 0;
        this.lastSocketError = null;
    }

    // エラーログ記録
    logError(type, details) {
        const errorInfo = {
            type,
            details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            roomId: this.roomId,
            playerName: this.myName,
            isSpectator: this.isSpectator
        };

        console.error('Game Error:', errorInfo);

        if (this.socketClient && this.socketClient.isConnected()) {
            this.socketClient.emit('clientError', errorInfo);
        }

        if (type === 'JavaScript Error' || type === 'Unhandled Promise Rejection') {
            UIManager.showError('予期しないエラーが発生しました。ページをリロードしてください。', 'error');
        }
    }

    // バイブレーション機能
    vibrate(pattern) {
        if (navigator.vibrate && (typeof window.DeviceMotionEvent !== 'undefined' || 'ontouchstart' in window)) {
            try {
                const result = navigator.vibrate(pattern);
                console.log('Vibration result:', result, 'Pattern:', pattern);
                return result;
            } catch (error) {
                console.warn('Vibration error:', error);
                return false;
            }
        } else {
            console.log('Vibration not supported on this device');
            return false;
        }
    }

    initializeEventListeners() {
        document.getElementById('use-password').addEventListener('change', (e) => {
            document.getElementById('password-group').style.display = 
                e.target.checked ? 'block' : 'none';
        });

        document.getElementById('create-room').addEventListener('click', () => this.createRoom());
        document.getElementById('join-room').addEventListener('click', () => this.joinRoom());
        document.getElementById('rejoin-room').addEventListener('click', () => this.rejoinRoom());
        document.getElementById('spectate-room').addEventListener('click', () => this.spectateRoom());
        document.getElementById('leave-room').addEventListener('click', () => this.leaveRoom());
        document.getElementById('temp-leave-room').addEventListener('click', () => this.tempLeaveRoom());
        document.getElementById('cancel-temp-leave').addEventListener('click', () => this.cancelTempLeave());
        document.getElementById('game-leave-room').addEventListener('click', () => this.showTempLeaveDialog());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('return-to-lobby').addEventListener('click', () => this.returnToLobby());
        
        document.getElementById('refresh-rooms').addEventListener('click', () => {
            this.socketClient.getRoomList();
        });
        
        document.getElementById('refresh-ongoing').addEventListener('click', () => {
            this.socketClient.getOngoingGames();
        });

        document.getElementById('send-chat').addEventListener('click', () => this.sendChat());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });

        // ページ離脱時の警告
        window.addEventListener('beforeunload', (e) => {
            if (this.roomId && this.gameData && this.gameData.gameState === 'playing') {
                e.preventDefault();
                e.returnValue = 'ゲーム中です。本当にページを離れますか？';
                return e.returnValue;
            }
        });
    }

    // 再接続処理
    attemptReconnection() {
        try {
            const rejoinInfo = localStorage.getItem('pigGameRejoinInfo');
            if (rejoinInfo) {
                const info = JSON.parse(rejoinInfo);
                console.log('保存された再入場情報:', info);
                
                if (Date.now() - info.timestamp < 24 * 60 * 60 * 1000) {
                    this.populateRejoinInfo(info);
                    UIManager.showError('前回のゲームへの再入場情報が見つかりました', 'warning');
                } else {
                    localStorage.removeItem('pigGameRejoinInfo');
                }
                return;
            }

            const savedPlayerInfo = localStorage.getItem('pigGamePlayerInfo');
            if (savedPlayerInfo) {
                const playerInfo = JSON.parse(savedPlayerInfo);
                console.log('保存された情報で再接続を試行:', playerInfo);
                
                this.myName = playerInfo.playerName;
                this.isHost = playerInfo.isHost;
                UIManager.showPlayerName(this.myName);
                
                setTimeout(() => {
                    this.socketClient.reconnectToRoom(playerInfo.roomId, playerInfo.playerName);
                }, 1000);
            }
        } catch (error) {
            console.error('再接続情報の読み込みエラー:', error);
            localStorage.removeItem('pigGamePlayerInfo');
            localStorage.removeItem('pigGameRejoinInfo');
        }
    }

    // プレイヤー情報を保存
    savePlayerInfo(playerInfo) {
        try {
            localStorage.setItem('pigGamePlayerInfo', JSON.stringify(playerInfo));
            console.log('プレイヤー情報を保存:', playerInfo);
        } catch (error) {
            console.error('プレイヤー情報の保存エラー:', error);
        }
    }

    // プレイヤー情報を削除
    clearPlayerInfo() {
        try {
            localStorage.removeItem('pigGamePlayerInfo');
            console.log('プレイヤー情報を削除');
        } catch (error) {
            console.error('プレイヤー情報の削除エラー:', error);
        }
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

    rejoinRoom() {
        const nameInput = document.getElementById('rejoin-player-name');
        const roomInput = document.getElementById('rejoin-room-id');
        
        const playerName = nameInput.value.trim();
        const roomId = roomInput.value.trim().toUpperCase();

        if (!playerName) {
            UIManager.showError('プレイヤー名を入力してください');
            return;
        }

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        this.roomId = roomId;
        
        this.socketClient.rejoinRoom(roomId, playerName);
    }

    spectateRoom() {
        const nameInput = document.getElementById('spectator-name');
        const roomInput = document.getElementById('spectate-room-id');
        
        const spectatorName = nameInput.value.trim() || `観戦者${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput.value.trim().toUpperCase();

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.myName = spectatorName;
        this.isSpectator = true;
        UIManager.showPlayerName(this.myName + ' (観戦)');
        this.roomId = roomId;
        
        this.socketClient.spectateRoom(roomId, spectatorName);
    }

    // 一時退出ダイアログを表示
    showTempLeaveDialog() {
        if (this.gameData && this.gameData.gameState === 'playing') {
            document.getElementById('temp-leave-section').style.display = 'block';
            UIManager.showScreen('room-info');
            document.getElementById('room-id-display').textContent = this.roomId;
        } else {
            this.leaveRoom();
        }
    }

    // 一時退出をキャンセル
    cancelTempLeave() {
        document.getElementById('temp-leave-section').style.display = 'none';
        if (this.gameData && this.gameData.gameState === 'playing') {
            UIManager.showScreen('game-board');
        }
    }

    // 一時退出を実行
    tempLeaveRoom() {
        const rejoinInfo = {
            roomId: this.roomId,
            playerName: this.myName,
            tempLeft: true,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('pigGameRejoinInfo', JSON.stringify(rejoinInfo));
        } catch (error) {
            console.error('再入場情報の保存エラー:', error);
        }

        this.socketClient.tempLeaveRoom();
        
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.isSpectator = false;
        
        UIManager.showSpectatorMode(false);
        UIManager.showScreen('lobby');
        
        this.populateRejoinInfo(rejoinInfo);
        
        UIManager.showError('一時退出しました。同じプレイヤー名とルームIDで再入場できます。', 'warning');
    }

    // 再入場情報をUIに自動入力
    populateRejoinInfo(rejoinInfo) {
        document.getElementById('rejoin-player-name').value = rejoinInfo.playerName;
        document.getElementById('rejoin-room-id').value = rejoinInfo.roomId;
    }

    // ルーム作成成功時
    onRoomCreated(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = true;
        
        this.savePlayerInfo(data.playerInfo);
        this.showRoomInfo();
    }

    // ルーム参加成功時
    onJoinSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.playerInfo.isHost;
        
        this.savePlayerInfo(data.playerInfo);
        this.updateUI();
    }

    // 観戦成功時
    onSpectateSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isSpectator = true;
        
        UIManager.showSpectatorMode(true);
        this.updateUI();
    }

    // 再入場成功時
    onRejoinSuccess(data) {
        console.log('再入場成功:', data);
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        try {
            localStorage.removeItem('pigGameRejoinInfo');
        } catch (error) {
            console.error('再入場情報の削除エラー:', error);
        }
        
        UIManager.showError('ゲームに再入場しました！', 'success');
        this.updateUI();
    }

    // 再接続成功時
    onReconnectSuccess(data) {
        console.log('再接続成功:', data);
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        UIManager.showError('ゲームに再接続しました！', 'success');
        this.updateUI();
    }

    showRoomInfo() {
        UIManager.showScreen('room-info');
        document.getElementById('room-id-display').textContent = this.roomId;
    }

    updateUI() {
        if (!this.gameData) return;

        // 財宝目標をUIに反映
        const treasureGoalEl = document.getElementById('treasure-goal');
        if (treasureGoalEl) {
            treasureGoalEl.textContent = this.gameData.treasureGoal || 7;
        }

        UIManager.updatePlayersList(this.gameData.players, this.gameData.host);

        if (this.gameData.gameState === 'waiting') {
            this.updateLobbyUI();
        } else if (this.gameData.gameState === 'playing') {
            this.updateGameUI();
        } else if (this.gameData.gameState === 'finished') {
            UIManager.showVictoryScreen(this.gameData);
            
            if (this.gameData.winningTeam === 'adventurer') {
                this.vibrate([200, 100, 200, 100, 200]);
            } else {
                this.vibrate([100, 50, 100, 50, 300]);
            }
        }
    }

    updateLobbyUI() {
        UIManager.showScreen('room-info');
        
        const startButton = document.getElementById('start-game');
        const tempLeaveSection = document.getElementById('temp-leave-section');
        
        const count = this.gameData.players.filter(p => p.connected).length;
        if (this.isHost && count >= 3) {
            startButton.style.display = 'block';
        } else {
            startButton.style.display = 'none';
        }
        
        tempLeaveSection.style.display = 'none';
    }

    updateGameUI() {
        UIManager.showScreen('game-board');
        
        UIManager.showGameRoomId(this.roomId);
        UIManager.updateGameOverview(this.gameData.players.length);
        UIManager.updateProgressBars(this.gameData);
        UIManager.updateGameInfo(this.gameData);

        const keyHolder = this.gameData.players.find(p => p.id === this.gameData.keyHolderId);
        const keyHolderNameEl = document.getElementById('key-holder-name');
        if (keyHolderNameEl) {
            keyHolderNameEl.textContent = keyHolder?.name || '不明';
        }
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        const turnMessageEl = document.getElementById('turn-message');
        if (turnMessageEl) {
            turnMessageEl.textContent = isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...';
        }

        this.showPlayerRole();
        this.renderMyCards();
        this.renderOtherPlayers(isMyTurn);
        this.addCardRevealEffects();
    }

    // カード公開時の効果を追加
    addCardRevealEffects() {
        if (this.gameData.lastRevealedCard) {
            const cardType = this.gameData.lastRevealedCard.type;
            
            switch (cardType) {
                case 'treasure':
                    this.vibrate([100, 50, 100]);
                    break;
                case 'trap':
                    this.vibrate([200, 100, 200, 100, 200]);
                    break;
                case 'empty':
                    this.vibrate([50]);
                    break;
            }
            
            delete this.gameData.lastRevealedCard;
        }
    }

    showPlayerRole() {
        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        const myRole = myPlayer?.role;
        const roleCard = document.getElementById('role-reveal');
        const roleText = document.getElementById('player-role');
        const roleDesc = document.getElementById('role-description');

        if (!roleCard || !roleText || !roleDesc) return;

        if (myRole === 'adventurer') {
            roleCard.className = 'role-card role-adventurer compact';
            roleText.textContent = '⛏️ 探検家 (Explorer)';
            roleDesc.textContent = `子豚に変えられた子供を${this.gameData.treasureGoal || 7}匹すべて救出することが目標です！`;
        } else if (myRole === 'guardian') {
            roleCard.className = 'role-card role-guardian compact';
            roleText.textContent = '🐷 豚男 (Pig Man)';
            roleDesc.textContent = `罠を${this.gameData.trapGoal || 2}個すべて発動させるか、4ラウンド終了まで子豚たちを隠し続けることが目標です！`;
        }
    }

    renderMyCards() {
        const myCardsSection = document.querySelector('.my-cards-section');
        if (!myCardsSection) return;

        if (this.isSpectator) {
            myCardsSection.style.display = 'none';
            return;
        } else {
            myCardsSection.style.display = 'block';
        }

        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        if (!myPlayer || !myPlayer.hand) return;

        const container = document.getElementById('my-cards-grid');
        if (!container) return;

        container.innerHTML = '';

        let treasureCount = 0, trapCount = 0, emptyCount = 0;
        
        myPlayer.hand.forEach((card) => {
            const div = document.createElement('div');
            div.className = 'card';
            
            if (card.revealed) {
                div.classList.add('revealed', card.type);
                const emoji = document.createElement('div');
                emoji.style.fontSize = '2.5em';
                emoji.style.textAlign = 'center';
                emoji.style.lineHeight = '1';
                switch (card.type) {
                    case 'treasure':
                        emoji.textContent = '🐷';
                        break;
                    case 'trap':
                        emoji.textContent = '💀';
                        break;
                    case 'empty':
                        emoji.textContent = '🏠';
                        break;
                }
                div.appendChild(emoji);
            } else {
                const emoji = document.createElement('div');
                emoji.textContent = '❓';
                emoji.style.fontSize = '2.5em';
                emoji.style.textAlign = 'center';
                emoji.style.lineHeight = '1';
                div.appendChild(emoji);
                
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

        const myTreasureEl = document.getElementById('my-treasure');
        const myTrapEl = document.getElementById('my-trap');
        const myEmptyEl = document.getElementById('my-empty');
        
        if (myTreasureEl) myTreasureEl.textContent = treasureCount;
        if (myTrapEl) myTrapEl.textContent = trapCount;
        if (myEmptyEl) myEmptyEl.textContent = emptyCount;
    }

    renderOtherPlayers(isMyTurn) {
        const container = document.getElementById('other-players-container');
        if (!container) return;

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
            
            if (!player.connected) {
                header.textContent += ' (切断中)';
                header.style.color = '#888';
            }
            
            if (player.id === this.gameData.keyHolderId) {
                const emoji = document.createElement('span');
                emoji.textContent = ' 🗝️';
                emoji.style.fontSize = '20px';
                emoji.style.marginLeft = '8px';
                header.appendChild(emoji);
            }
            playerBox.appendChild(header);

            const cardsGrid = document.createElement('div');
            cardsGrid.className = 'other-player-cards';

            player.hand.forEach((card, index) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'other-card';
                
                if (card.revealed) {
                    cardDiv.classList.add('revealed', card.type);
                    const emoji = document.createElement('div');
                    emoji.style.fontSize = '1.5em';
                    emoji.style.textAlign = 'center';
                    emoji.style.lineHeight = '1';
                    switch (card.type) {
                        case 'treasure':
                            emoji.textContent = '🐷';
                            break;
                        case 'trap':
                            emoji.textContent = '💀';
                            break;
                        case 'empty':
                            emoji.textContent = '🏠';
                            break;
                    }
                    cardDiv.appendChild(emoji);
                } else {
                    const emoji = document.createElement('div');
                    emoji.textContent = '❓';
                    emoji.style.fontSize = '1.5em';
                    emoji.style.textAlign = 'center';
                    emoji.style.lineHeight = '1';
                    cardDiv.appendChild(emoji);
                    
                    if (isMyTurn && !card.revealed && player.connected) {
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
        if (this.isSpectator) {
            UIManager.showError('観戦者はカードを選択できません');
            return;
        }
        
        this.socketClient.selectCard(targetPlayerId, cardIndex);
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        if (!input) return;
        
        const message = input.value.trim();
        
        if (!message || !this.roomId) return;
        
        this.socketClient.sendChat(message);
        input.value = '';
    }

    startGame() {
        if (this.isSpectator) {
            UIManager.showError('観戦者はゲームを開始できません');
            return;
        }
        
        this.socketClient.startGame();
    }

    leaveRoom() {
        this.socketClient.leaveRoom();
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.isSpectator = false;
        
        this.clearPlayerInfo();
        
        UIManager.showSpectatorMode(false);
        UIManager.showScreen('lobby');
    }

    returnToLobby() {
        this.leaveRoom();
    }
}

// DOMContentLoaded時にゲームを初期化
document.addEventListener('DOMContentLoaded', () => {
    const game = new TreasureTempleGame();
    window.game = game;
});
