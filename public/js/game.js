class TreasureTempleGame {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        
        this.socketClient = new SocketClient(this);
        this.initializeEventListeners();
        
        // ページ読み込み時に再接続を試行
        this.attemptReconnection();
    }

    initializeEventListeners() {
        document.getElementById('use-password').addEventListener('change', (e) => {
            document.getElementById('password-group').style.display = 
                e.target.checked ? 'block' : 'none';
        });

        document.getElementById('create-room').addEventListener('click', () => this.createRoom());
        document.getElementById('join-room').addEventListener('click', () => this.joinRoom());
        document.getElementById('leave-room').addEventListener('click', () => this.leaveRoom());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('return-to-lobby').addEventListener('click', () => this.returnToLobby());
        document.getElementById('refresh-rooms').addEventListener('click', () => {
            this.socketClient.getRoomList();
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
            const savedPlayerInfo = localStorage.getItem('pigGamePlayerInfo');
            if (savedPlayerInfo) {
                const playerInfo = JSON.parse(savedPlayerInfo);
                console.log('保存された情報で再接続を試行:', playerInfo);
                
                this.myName = playerInfo.playerName;
                this.isHost = playerInfo.isHost;
                UIManager.showPlayerName(this.myName);
                
                // 少し待ってから再接続を試行（Socket.io接続完了を待つ）
                setTimeout(() => {
                    this.socketClient.reconnectToRoom(playerInfo.roomId, playerInfo.playerName);
                }, 1000);
            }
        } catch (error) {
            console.error('再接続情報の読み込みエラー:', error);
            localStorage.removeItem('pigGamePlayerInfo');
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

    // ルーム作成成功時
    onRoomCreated(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = true;
        
        // プレイヤー情報を保存
        this.savePlayerInfo(data.playerInfo);
        
        this.showRoomInfo();
    }

    // ルーム参加成功時
    onJoinSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.playerInfo.isHost;
        
        // プレイヤー情報を保存
        this.savePlayerInfo(data.playerInfo);
        
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
        document.getElementById('treasure-goal').textContent = this.gameData.treasureGoal || 7;

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

        UIManager.updateGameOverview(this.gameData.players.length);
        UIManager.updateProgressBars(this.gameData);
        UIManager.updateGameInfo(this.gameData);

        const keyHolder = this.gameData.players.find(p => p.id === this.gameData.keyHolderId);
        document.getElementById('key-holder-name').textContent = keyHolder?.name || '不明';
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        document.getElementById('turn-message').textContent = 
            isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...';

        this.showPlayerRole();
        this.renderMyCards();
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
            roleCard.className = 'role-card role-adventurer compact';
            roleText.textContent = '⛏️ 探検家 (Adventurer)';
            roleDesc.textContent = `財宝を${this.gameData.treasureGoal || 7}個すべて見つけることが目標です！`;
            roleImage.src = '/images/role-adventurer.png';
            roleImage.alt = '探検家';
            // 画像が読み込めない場合のフォールバック
            roleImage.onerror = () => {
                roleImage.style.display = 'none';
                const emoji = document.createElement('div');
                emoji.textContent = '⛏️';
                emoji.style.fontSize = '4em';
                emoji.style.textAlign = 'center';
                roleImage.parentNode.insertBefore(emoji, roleImage.nextSibling);
            };
        } else if (myRole === 'guardian') {
            roleCard.className = 'role-card role-guardian compact';
            roleText.textContent = '🛡️ 守護者 (Guardian)';
            roleDesc.textContent = `罠を${this.gameData.trapGoal || 2}個すべて発動させるか、4ラウンド終了まで財宝を守ることが目標です！`;
            roleImage.src = '/images/role-guardian.png';
            roleImage.alt = '守護者';
            // 画像が読み込めない場合のフォールバック
            roleImage.onerror = () => {
                roleImage.style.display = 'none';
                const emoji = document.createElement('div');
                emoji.textContent = '🛡️';
                emoji.style.fontSize = '4em';
                emoji.style.textAlign = 'center';
                roleImage.parentNode.insertBefore(emoji, roleImage.nextSibling);
            };
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
                img.src = `/images/card-${card.type}-large.png`;
                img.alt = card.type;
                
                // 画像が読み込めない場合のフォールバック
                img.onerror = () => {
                    img.style.display = 'none';
                    const emoji = document.createElement('div');
                    emoji.style.fontSize = '2.5em';
                    emoji.style.textAlign = 'center';
                    emoji.style.lineHeight = '1';
                    switch (card.type) {
                        case 'treasure':
                            emoji.textContent = '💰';
                            break;
                        case 'trap':
                            emoji.textContent = '💀';
                            break;
                        case 'empty':
                            emoji.textContent = '🏠';
                            break;
                    }
                    div.appendChild(emoji);
                };
                
                div.appendChild(img);
            } else {
                const img = document.createElement('img');
                img.className = 'card-image';
                img.src = '/images/card-back-large.png';
                img.alt = 'カード裏面';
                
                // 画像が読み込めない場合のフォールバック
                img.onerror = () => {
                    img.style.display = 'none';
                    const emoji = document.createElement('div');
                    emoji.textContent = '❓';
                    emoji.style.fontSize = '2.5em';
                    emoji.style.textAlign = 'center';
                    emoji.style.lineHeight = '1';
                    div.appendChild(emoji);
                };
                
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
            
            // 切断状態の表示
            if (!player.connected) {
                header.textContent += ' (切断中)';
                header.style.color = '#888';
            }
            
            if (player.id === this.gameData.keyHolderId) {
                const keyImg = document.createElement('img');
                keyImg.src = '/images/key-icon.png';
                keyImg.className = 'key-icon-small';
                keyImg.alt = '鍵';
                
                // 画像が読み込めない場合のフォールバック
                keyImg.onerror = () => {
                    keyImg.style.display = 'none';
                    const emoji = document.createElement('span');
                    emoji.textContent = '🗝️';
                    emoji.style.fontSize = '20px';
                    emoji.style.marginLeft = '8px';
                    header.appendChild(emoji);
                };
                
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
                    img.src = `/images/card-${card.type}-medium.png`;
                    img.alt = card.type;
                    
                    // 画像が読み込めない場合のフォールバック
                    img.onerror = () => {
                        img.style.display = 'none';
                        const emoji = document.createElement('div');
                        emoji.style.fontSize = '1.5em';
                        emoji.style.textAlign = 'center';
                        emoji.style.lineHeight = '1';
                        switch (card.type) {
                            case 'treasure':
                                emoji.textContent = '💰';
                                break;
                            case 'trap':
                                emoji.textContent = '💀';
                                break;
                            case 'empty':
                                emoji.textContent = '🏠';
                                break;
                        }
                        cardDiv.appendChild(emoji);
                    };
                    
                    cardDiv.appendChild(img);
                } else {
                    const img = document.createElement('img');
                    img.className = 'other-card-image';
                    img.src = '/images/card-back-medium.png';
                    img.alt = 'カード裏面';
                    
                    // 画像が読み込めない場合のフォールバック
                    img.onerror = () => {
                        img.style.display = 'none';
                        const emoji = document.createElement('div');
                        emoji.textContent = '❓';
                        emoji.style.fontSize = '1.5em';
                        emoji.style.textAlign = 'center';
                        emoji.style.lineHeight = '1';
                        cardDiv.appendChild(emoji);
                    };
                    
                    cardDiv.appendChild(img);
                    
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
        
        // プレイヤー情報を削除
        this.clearPlayerInfo();
        
        UIManager.showScreen('lobby');
    }

    returnToLobby() {
        this.leaveRoom();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new TreasureTempleGame();
    window.game = game;
});
