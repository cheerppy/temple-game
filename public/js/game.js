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
        
        this.socketClient = new SocketClient(this);
        this.initializeEventListeners();
        this.initializeErrorMonitoring();
        this.initializeVibration();
        
        // ページ読み込み時に再接続を試行
        this.attemptReconnection();
    }

    // バイブレーション初期化（ユーザーインタラクション後に有効化）
    initializeVibration() {
        // ユーザーの最初のクリックを検出
        const enableVibrationOnFirstClick = () => {
            if (!this.userInteracted && 'vibrate' in navigator) {
                this.userInteracted = true;
                this.vibrationEnabled = true;
                console.log('バイブレーション機能を有効化しました');
                
                // テスト用の軽いバイブレーション
                try {
                    navigator.vibrate(50);
                } catch (error) {
                    console.warn('バイブレーションテストに失敗:', error);
                    this.vibrationEnabled = false;
                }
            }
        };

        // 各種ユーザーインタラクションイベントを監視
        ['click', 'touchstart', 'keydown'].forEach(eventType => {
            document.addEventListener(eventType, enableVibrationOnFirstClick, { once: true });
        });

        if (!('vibrate' in navigator)) {
            console.log('このデバイスはバイブレーション機能をサポートしていません');
            this.vibrationEnabled = false;
        }
    }

    // 安全なバイブレーション機能
    vibrate(pattern) {
        // バイブレーション機能が無効の場合は何もしない
        if (!this.vibrationEnabled || !this.userInteracted || !navigator.vibrate) {
            return false;
        }

        try {
            // パターンを配列として正規化
            const normalizedPattern = Array.isArray(pattern) ? pattern : [pattern];
            
            // 長すぎるパターンを制限（一部のブラウザで問題を起こす可能性）
            const limitedPattern = normalizedPattern.slice(0, 10);
            
            // バイブレーションを実行
            const result = navigator.vibrate(limitedPattern);
            
            if (result) {
                console.log('バイブレーション成功:', limitedPattern);
            } else {
                console.log('バイブレーション実行が拒否されました');
            }
            
            return result;
        } catch (error) {
            console.warn('バイブレーションエラー:', error);
            // エラーが発生した場合は機能を無効化
            this.vibrationEnabled = false;
            return false;
        }
    }

    // カードタイプ別のバイブレーションパターン（短縮版）
    getVibrationPattern(cardType) {
        const patterns = {
            treasure: [100], // 短い成功パターン
            trap: [200, 100, 200], // 警告パターン（短縮）
            empty: [50], // 軽い単発
            victory_adventurer: [200, 100, 200], // 勝利パターン（短縮）
            victory_guardian: [100, 50, 100], // 勝利パターン（短縮）
            turn_start: [80], // ターン開始
            round_start: [150], // ラウンド開始（短縮）
            error: [300], // エラー（短縮）
            button_click: [30], // ボタンクリック
            success: [100], // 成功
            warning: [150] // 警告
        };
        
        return patterns[cardType] || [50];
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
            this.vibrate(this.getVibrationPattern('error'));
        }
    }

    initializeEventListeners() {
        // 必要な要素の存在確認
        const requiredElements = [
            'use-password', 'create-room', 'join-room', 'rejoin-room', 
            'spectate-room', 'leave-room', 'temp-leave-room', 'cancel-temp-leave',
            'game-leave-room', 'start-game', 'return-to-lobby', 'refresh-rooms',
            'refresh-ongoing', 'send-chat', 'chat-input'
        ];

        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`要素が見つかりません: ${id}`);
            }
        });

        // パスワード設定の切り替え
        const usePasswordEl = document.getElementById('use-password');
        if (usePasswordEl) {
            usePasswordEl.addEventListener('change', (e) => {
                const passwordGroup = document.getElementById('password-group');
                if (passwordGroup) {
                    passwordGroup.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }

        // ボタンイベントリスナー（バイブレーション付き）
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

        // チャット入力でEnterキー
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.vibrate(this.getVibrationPattern('button_click'));
                    this.sendChat();
                }
            });
        }

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
        const playerName = nameInput?.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const hasPassword = document.getElementById('use-password')?.checked || false;
        const password = hasPassword ? (document.getElementById('room-password')?.value || '') : '';
        
        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        
        this.socketClient.createRoom(playerName, hasPassword, password);
    }

    joinRoom() {
        const nameInput = document.getElementById('player-name-join');
        const roomInput = document.getElementById('room-id-input');
        const passwordInput = document.getElementById('join-password');
        
        const playerName = nameInput?.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput?.value.trim().toUpperCase() || '';
        const password = passwordInput?.value || '';

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
        
        const playerName = nameInput?.value.trim() || '';
        const roomId = roomInput?.value.trim().toUpperCase() || '';

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
        
        const spectatorName = nameInput?.value.trim() || `観戦者${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput?.value.trim().toUpperCase() || '';

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

    // 一時退出ダイアログを表示
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

    // 一時退出をキャンセル
    cancelTempLeave() {
        const tempLeaveSection = document.getElementById('temp-leave-section');
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
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
        this.vibrate(this.getVibrationPattern('warning'));
    }

    // 再入場情報をUIに自動入力
    populateRejoinInfo(rejoinInfo) {
        const nameInput = document.getElementById('rejoin-player-name');
        const roomInput = document.getElementById('rejoin-room-id');
        
        if (nameInput) nameInput.value = rejoinInfo.playerName;
        if (roomInput) roomInput.value = rejoinInfo.roomId;
    }

    // ルーム作成成功時
    onRoomCreated(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = true;
        
        this.savePlayerInfo(data.playerInfo);
        this.showRoomInfo();
        this.vibrate(this.getVibrationPattern('success'));
    }

    // ルーム参加成功時
    onJoinSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.playerInfo.isHost;
        
        this.savePlayerInfo(data.playerInfo);
        this.updateUI();
        this.vibrate(this.getVibrationPattern('success'));
    }

    // 観戦成功時
    onSpectateSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isSpectator = true;
        
        UIManager.showSpectatorMode(true);
        this.updateUI();
        this.vibrate([50]); // 軽いフィードバック
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
        this.vibrate(this.getVibrationPattern('success'));
    }

    // 再接続成功時
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
            
            // 勝利時のバイブレーション
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
            keyHolderNameEl.textContent = keyHolder?.name || '不明';
        }
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        const turnMessageEl = document.getElementById('turn-message');
        if (turnMessageEl) {
            turnMessageEl.textContent = isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...';
        }

        // 自分のターンになったときのバイブレーション
        if (isMyTurn && !this.wasMyTurn) {
            this.vibrate(this.getVibrationPattern('turn_start'));
        }
        this.wasMyTurn = isMyTurn;

        this.showPlayerRole();
        this.renderMyCards();
        this.renderOtherPlayers(isMyTurn);
        this.addCardRevealEffects();
    }

    // カード公開時の効果を追加
    addCardRevealEffects() {
        if (this.gameData.lastRevealedCard) {
            const cardType = this.gameData.lastRevealedCard.type;
            
            // カードタイプに応じたバイブレーション
            this.vibrate(this.getVibrationPattern(cardType));
            
            delete this.gameData.lastRevealedCard;
        }
    }

    showPlayerRole() {
        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        const myRole = myPlayer?.role;
        const roleCard = document.getElementById('role-reveal');
        const roleText = document.getElementById('player-role');
        const roleDesc = document.getElementById('role-description');
        const roleEmoji = document.querySelector('.role-emoji');

        if (!roleCard || !roleText || !roleDesc) return;

        if (myRole === 'adventurer') {
            roleCard.className = 'role-card role-adventurer compact';
            roleText.textContent = '⛏️ 探検家 (Explorer)';
            roleDesc.textContent = `子豚に変えられた子供を${this.gameData.treasureGoal || 7}匹すべて救出することが目標です！`;
            if (roleEmoji) roleEmoji.textContent = '⛏️';
        } else if (myRole === 'guardian') {
            roleCard.className = 'role-card role-guardian compact';
            roleText.textContent = '🐷 豚男 (Pig Man)';
            roleDesc.textContent = `罠を${this.gameData.trapGoal || 2}個すべて発動させるか、4ラウンド終了まで子豚たちを隠し続けることが目標です！`;
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
                    cardDiv.appendChild(emoji);
                    
                    if (isMyTurn && !card.revealed && player.connected && !this.isSpectator) {
                        cardDiv.style.cursor = 'pointer';
                        cardDiv.addEventListener('click', () => {
                            this.selectCard(player.id, index);
                            this.vibrate([30]); // カード選択時のフィードバック
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

// DOMContentLoaded時にゲームを初期化
document.addEventListener('DOMContentLoaded', () => {
    const game = new TreasureTempleGame();
    window.game = game;
});center';
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
                    emoji.style.textAlign = '
