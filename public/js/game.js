class TreasureTempleGame {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        this.isSpectator = false;
        this.vibrationEnabled = false;
        this.userInteracted = false;
        this.wasMyTurn = false;
        
        this.socketClient = new SocketClient(this);
        this.initializeEventListeners();
        this.initializeErrorMonitoring();
        this.initializeVibration();
        
        this.attemptReconnection();
    }

    initializeVibration() {
        const enableVibrationOnFirstClick = () => {
            if (!this.userInteracted && 'vibrate' in navigator) {
                this.userInteracted = true;
                this.vibrationEnabled = true;
                console.log('バイブレーション機能を有効化しました');
                
                try {
                    navigator.vibrate(50);
                } catch (error) {
                    console.warn('バイブレーションテストに失敗:', error);
                    this.vibrationEnabled = false;
                }
            }
        };

        ['click', 'touchstart', 'keydown'].forEach(eventType => {
            document.addEventListener(eventType, enableVibrationOnFirstClick, { once: true });
        });

        if (!('vibrate' in navigator)) {
            console.log('このデバイスはバイブレーション機能をサポートしていません');
            this.vibrationEnabled = false;
        }
    }

    vibrate(pattern) {
        if (!this.vibrationEnabled || !this.userInteracted || !navigator.vibrate) {
            return false;
        }

        try {
            const normalizedPattern = Array.isArray(pattern) ? pattern : [pattern];
            const limitedPattern = normalizedPattern.slice(0, 10);
            const result = navigator.vibrate(limitedPattern);
            
            if (result) {
                console.log('バイブレーション成功:', limitedPattern);
            }
            
            return result;
        } catch (error) {
            console.warn('バイブレーションエラー:', error);
            this.vibrationEnabled = false;
            return false;
        }
    }

    getVibrationPattern(cardType) {
        const patterns = {
            treasure: [100],
            trap: [200, 100, 200],
            empty: [50],
            victory_adventurer: [200, 100, 200],
            victory_guardian: [100, 50, 100],
            turn_start: [80],
            round_start: [150],
            error: [300],
            button_click: [30],
            success: [100],
            warning: [150]
        };
        
        return patterns[cardType] || [50];
    }

    initializeErrorMonitoring() {
        window.addEventListener('error', (event) => {
            this.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error && event.error.stack
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

    logError(type, details) {
        const errorInfo = {
            type: type,
            details: details,
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
            this.vibrate(this.getVibrationPattern('error'));
        }
    }

    initializeEventListeners() {
        const usePasswordEl = document.getElementById('use-password');
        if (usePasswordEl) {
            usePasswordEl.addEventListener('change', (e) => {
                const passwordGroup = document.getElementById('password-group');
                if (passwordGroup) {
                    passwordGroup.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }

        const buttonEvents = {
            'create-room': () => { this.vibrate(this.getVibrationPattern('button_click')); this.createRoom(); },
            'join-room': () => { this.vibrate(this.getVibrationPattern('button_click')); this.joinRoom(); },
            'rejoin-room': () => { this.vibrate(this.getVibrationPattern('button_click')); this.rejoinRoom(); },
            'spectate-room': () => { this.vibrate(this.getVibrationPattern('button_click')); this.spectateRoom(); },
            'leave-room': () => { this.vibrate(this.getVibrationPattern('button_click')); this.leaveRoom(); },
            'temp-leave-room': () => { this.vibrate(this.getVibrationPattern('button_click')); this.tempLeaveRoom(); },
            'cancel-temp-leave': () => { this.vibrate(this.getVibrationPattern('button_click')); this.cancelTempLeave(); },
            'game-leave-room': () => { this.vibrate(this.getVibrationPattern('button_click')); this.showTempLeaveDialog(); },
            'start-game': () => { this.vibrate(this.getVibrationPattern('button_click')); this.startGame(); },
            'return-to-lobby': () => { this.vibrate(this.getVibrationPattern('button_click')); this.returnToLobby(); },
            'refresh-rooms': () => { this.vibrate(this.getVibrationPattern('button_click')); this.socketClient.getRoomList(); },
            'refresh-ongoing': () => { this.vibrate(this.getVibrationPattern('button_click')); this.socketClient.getOngoingGames(); },
            'send-chat': () => { this.vibrate(this.getVibrationPattern('button_click')); this.sendChat(); }
        };

        Object.entries(buttonEvents).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            }
        });

        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.vibrate(this.getVibrationPattern('button_click'));
                    this.sendChat();
                }
            });
        }

        window.addEventListener('beforeunload', (e) => {
            if (this.roomId && this.gameData && this.gameData.gameState === 'playing') {
                e.preventDefault();
                e.returnValue = 'ゲーム中です。本当にページを離れますか？';
                return e.returnValue;
            }
        });
    }

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

    savePlayerInfo(playerInfo) {
        try {
            localStorage.setItem('pigGamePlayerInfo', JSON.stringify(playerInfo));
            console.log('プレイヤー情報を保存:', playerInfo);
        } catch (error) {
            console.error('プレイヤー情報の保存エラー:', error);
        }
    }

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
        const playerName = nameInput && nameInput.value.trim() || 'プレイヤー' + Math.floor(Math.random() * 1000);
        const hasPassword = document.getElementById('use-password') && document.getElementById('use-password').checked || false;
        const password = hasPassword ? (document.getElementById('room-password') && document.getElementById('room-password').value || '') : '';
        
        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        
        this.socketClient.createRoom(playerName, hasPassword, password);
    }

    joinRoom() {
        const nameInput = document.getElementById('player-name-join');
        const roomInput = document.getElementById('room-id-input');
        const passwordInput = document.getElementById('join-password');
        
        const playerName = nameInput && nameInput.value.trim() || 'プレイヤー' + Math.floor(Math.random() * 1000);
        const roomId = roomInput && roomInput.value.trim().toUpperCase() || '';
        const password = passwordInput && passwordInput.value || '';

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            this.vibrate(this.getVibrationPattern('error'));
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
        
        const playerName = nameInput && nameInput.value.trim() || '';
        const roomId = roomInput && roomInput.value.trim().toUpperCase() || '';

        if (!playerName) {
            UIManager.showError('プレイヤー名を入力してください');
            this.vibrate(this.getVibrationPattern('error'));
            return;
        }

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            this.vibrate(this.getVibrationPattern('error'));
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
        
        const spectatorName = nameInput && nameInput.value.trim() || '観戦者' + Math.floor(Math.random() * 1000);
        const roomId = roomInput && roomInput.value.trim().toUpperCase() || '';

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            this.vibrate(this.getVibrationPattern('error'));
            return;
        }

        this.myName = spectatorName;
        this.isSpectator = true;
        UIManager.showPlayerName(this.myName + ' (観戦)');
        this.roomId = roomId;
        
        this.socketClient.spectateRoom(roomId, spectatorName);
    }

    showTempLeaveDialog() {
        if (this.gameData && this.gameData.gameState === 'playing') {
            const tempLeaveSection = document.getElementById('temp-leave-section');
            if (tempLeaveSection) {
                tempLeaveSection.style.display = 'block';
            }
            UIManager.showScreen('room-info');
            const roomIdDisplay = document.getElementById('room-id-display');
            if (roomIdDisplay) {
                roomIdDisplay.textContent = this.roomId;
            }
        } else {
            this.leaveRoom();
        }
    }

    cancelTempLeave() {
        const tempLeaveSection = document.getElementById('temp-leave-section');
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
        if (this.gameData && this.gameData.gameState === 'playing') {
            UIManager.showScreen('game-board');
        }
    }

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
        this.vibrate(this.getVibrationPattern('warning'));
    }

    populateRejoinInfo(rejoinInfo) {
        const nameInput = document.getElementById('rejoin-player-name');
        const roomInput = document.getElementById('rejoin-room-id');
        
        if (nameInput) nameInput.value = rejoinInfo.playerName;
        if (roomInput) roomInput.value = rejoinInfo.roomId;
    }

    onRoomCreated(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = true;
        
        this.savePlayerInfo(data.playerInfo);
        this.showRoomInfo();
        this.vibrate(this.getVibrationPattern('success'));
    }

    onJoinSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.playerInfo.isHost;
        
        this.savePlayerInfo(data.playerInfo);
        this.updateUI();
        this.vibrate(this.getVibrationPattern('success'));
    }

    onSpectateSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isSpectator = true;
        
        UIManager.showSpectatorMode(true);
        this.updateUI();
        this.vibrate([50]);
    }

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
        this.vibrate(this.getVibrationPattern('success'));
    }

    onReconnectSuccess(data) {
        console.log('再接続成功:', data);
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        UIManager.showError('ゲームに再接続しました！', 'success');
        this.updateUI();
        this.vibrate(this.getVibrationPattern('success'));
    }

    showRoomInfo() {
        UIManager.showScreen('room-info');
        const roomIdDisplay = document.getElementById('room-id-display');
        if (roomIdDisplay) {
            roomIdDisplay.textContent = this.roomId;
        }
    }

    updateUI() {
        if (!this.gameData) return;

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
                this.vibrate(this.getVibrationPattern('victory_adventurer'));
            } else {
                this.vibrate(this.getVibrationPattern('victory_guardian'));
            }
        }
    }

    updateLobbyUI() {
        UIManager.showScreen('room-info');
        
        const startButton = document.getElementById('start-game');
        const tempLeaveSection = document.getElementById('temp-leave-section');
        
        const count = this.gameData.players.filter(p => p.connected).length;
        if (this.isHost && count >= 3) {
            if (startButton) startButton.style.display = 'block';
        } else {
            if (startButton) startButton.style.display = 'none';
        }
        
        if (tempLeaveSection) tempLeaveSection.style.display = 'none';
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
            keyHolderNameEl.textContent = keyHolder && keyHolder.name || '不明';
        }
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        const turnMessageEl = document.getElementById('turn-message');
        if (turnMessageEl) {
            turnMessageEl.textContent = isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...';
        }

        if (isMyTurn && !this.wasMyTurn) {
            this.vibrate(this.getVibrationPattern('turn_start'));
        }
        this.wasMyTurn = isMyTurn;

        this.showPlayerRole();
        this.renderMyCards();
        this.renderOtherPlayers(isMyTurn);
        this.addCardRevealEffects();
    }

    addCardRevealEffects() {
        if (this.gameData.lastRevealedCard) {
            const cardType = this.gameData.lastRevealedCard.type;
            this.vibrate(this.getVibrationPattern(cardType));
            delete this.gameData.lastRevealedCard;
        }
    }

    showPlayerRole() {
        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        const myRole = myPlayer && myPlayer.role;
        const roleCard = document.getElementById('role-reveal');
        const roleText = document.getElementById('player-role');
        const roleDesc = document.getElementById('role-description');
        const roleEmoji = document.querySelector('.role-emoji');

        if (!roleCard || !roleText || !roleDesc) return;

        if (myRole === 'adventurer') {
            roleCard.className = 'role-card role-adventurer compact';
            roleText.textContent = '⛏️ 探検家 (Explorer)';
            roleDesc.textContent = '子豚に変えられた子供を' + (this.gameData.treasureGoal || 7) + '匹すべて救出することが目標です！';
            if (roleEmoji) roleEmoji.textContent = '⛏️';
        } else if (myRole === 'guardian') {
            roleCard.className = 'role-card role-guardian compact';
            roleText.textContent = '🐷 豚男 (Pig Man)';
            roleDesc.textContent = '罠を' + (this.gameData.trapGoal || 2) + '個すべて発動させるか、4ラウンド終了まで子豚たちを隠し続けることが目標です！';
            if (roleEmoji) roleEmoji.textContent = '🐷';
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

        const elements = ['my-treasure', 'my-trap', 'my-empty'];
        const counts = [treasureCount, trapCount, emptyCount];
        
        elements.forEach((id, index) => {
            const element = document.getElementById(id);
            if (element) element.textContent = counts[index];
        });
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
                    
                    if (isMyTurn && !card.revealed && player.connected && !this.isSpectator) {
                        cardDiv.style.cursor = 'pointer';
                        cardDiv.addEventListener('click', () => {
                            this.selectCard(player.id, index);
                            this.vibrate([30]);
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
            this.vibrate(this.getVibrationPattern('error'));
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
            this.vibrate(this.getVibrationPattern('error'));
            return;
        }
        
        this.socketClient.startGame();
        this.vibrate(this.getVibrationPattern('round_start'));
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
        this.vibrate([50]);
    }

    returnToLobby() {
        this.leaveRoom();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const game = new TreasureTempleGame();
    window.game = game;
});
