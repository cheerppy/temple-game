class UIManager {
    // 観戦モード表示の切り替え
    static showSpectatorMode(isSpectator) {
        const existingIndicator = document.getElementById('spectator-indicator');
        
        if (isSpectator) {
            if (!existingIndicator) {
                const indicator = document.createElement('div');
                indicator.id = 'spectator-indicator';
                indicator.className = 'spectator-indicator';
                indicator.textContent = '👁️ 観戦中';
                document.body.appendChild(indicator);
            }
            
            const gameBoard = document.getElementById('game-board');
            if (gameBoard) {
                gameBoard.classList.add('spectator-mode');
            }
            
            this.addSpectatorInfo();
        } else {
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            const gameBoard = document.getElementById('game-board');
            if (gameBoard) {
                gameBoard.classList.remove('spectator-mode');
            }
            
            this.removeSpectatorInfo();
        }
    }

    // 観戦者用情報の追加
    static addSpectatorInfo() {
        const gameBoard = document.getElementById('game-board');
        if (!gameBoard || document.getElementById('spectator-controls')) return;

        const spectatorControls = document.createElement('div');
        spectatorControls.id = 'spectator-controls';
        spectatorControls.className = 'spectator-controls';
        spectatorControls.innerHTML = `
            <div class="spectator-info">
                観戦モード - ゲームの進行を見ることができますが、操作はできません
            </div>
        `;

        gameBoard.insertBefore(spectatorControls, gameBoard.firstChild);
    }

    // 観戦者用情報の削除
    static removeSpectatorInfo() {
        const spectatorControls = document.getElementById('spectator-controls');
        if (spectatorControls) {
            spectatorControls.remove();
        }
    }

    static showConnectionStatus(status) {
        const statusEl = document.getElementById('connection-status');
        if (status === 'connected') {
            statusEl.textContent = '🟢 接続済み';
            statusEl.className = 'connection-status connected';
        } else {
            statusEl.textContent = '🔴 切断';
            statusEl.className = 'connection-status disconnected';
        }
    }

    static showError(message, type = 'error') {
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = message;
        
        // エラータイプに応じてスタイルを変更
        if (type === 'success') {
            errorEl.style.background = 'rgba(34, 139, 34, 0.9)';
            errorEl.style.borderColor = '#228B22';
        } else if (type === 'warning') {
            errorEl.style.background = 'rgba(255, 165, 0, 0.9)';
            errorEl.style.borderColor = '#FFA500';
        } else {
            errorEl.style.background = 'rgba(220, 20, 60, 0.9)';
            errorEl.style.borderColor = '#DC143C';
        }
        
        errorEl.style.display = 'block';
        
        // 成功メッセージは短めに表示
        const displayTime = type === 'success' ? 3000 : 5000;
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, displayTime);
    }

    static showPlayerName(name) {
        document.getElementById('player-name-display').style.display = 'block';
        document.getElementById('my-name').textContent = name;
    }

    static updateRoomList(rooms) {
        const container = document.getElementById('room-list-container');
        container.innerHTML = '';

        if (rooms.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #87CEEB;">現在開設中のルームはありません</p>';
            return;
        }

        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'game-item waiting-room';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'game-item-info';
            infoDiv.innerHTML = `
                <div class="game-header">
                    <strong>🏠 ${room.id}</strong>
                    ${room.hasPassword ? '<span class="password-icon">🔒</span>' : ''}
                    <span class="status-badge waiting">待機中</span>
                </div>
                <div class="game-details">
                    <span>👑 ${room.hostName}</span>
                    <span>👥 ${room.playerCount}/10</span>
                </div>
            `;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'game-actions';
            
            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn btn-small btn-primary';
            joinBtn.textContent = '🚪 参加';
            joinBtn.onclick = () => {
                this.showNameInputModal(room.id, room.hasPassword);
            };
            
            actionsDiv.appendChild(joinBtn);
            roomDiv.appendChild(infoDiv);
            roomDiv.appendChild(actionsDiv);
            container.appendChild(roomDiv);
        });
    }

    static updateOngoingGames(games) {
        const container = document.getElementById('ongoing-games-container');
        container.innerHTML = '';

        if (games.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #32CD32;">現在進行中のゲームはありません</p>';
            return;
        }

        games.forEach(game => {
            const gameDiv = document.createElement('div');
            gameDiv.className = 'game-item ongoing-game';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'game-item-info';
            infoDiv.innerHTML = `
                <div class="game-header">
                    <strong>🎮 ${game.id}</strong>
                    <span class="status-badge playing">進行中</span>
                </div>
                <div class="game-details">
                    <span>📊 R${game.currentRound}/4</span>
                    <span>👥 ${game.playerCount}/10</span>
                </div>
                <div class="game-progress">
                    <span>💰 ${game.treasureFound}/${game.treasureGoal}</span>
                    <span>💀 ${game.trapTriggered}/${game.trapGoal}</span>
                </div>
            `;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'game-actions';
            
            // 観戦ボタン
            const spectateBtn = document.createElement('button');
            spectateBtn.className = 'btn btn-small btn-secondary';
            spectateBtn.textContent = '👁️ 観戦';
            spectateBtn.onclick = () => {
                document.getElementById('spectate-room-id').value = game.id;
                const spectatorName = `観戦者${Math.floor(Math.random() * 1000)}`;
                document.getElementById('spectator-name').value = spectatorName;
                if (window.game) {
                    window.game.spectateRoom();
                }
            };
            
            // 再入場ボタン
            const rejoinBtn = document.createElement('button');
            rejoinBtn.className = 'btn btn-small btn-primary';
            rejoinBtn.textContent = '🔄 再入場';
            rejoinBtn.onclick = () => {
                this.showRejoinModal(game.id);
            };
            
            actionsDiv.appendChild(spectateBtn);
            actionsDiv.appendChild(rejoinBtn);
            gameDiv.appendChild(infoDiv);
            gameDiv.appendChild(actionsDiv);
            container.appendChild(gameDiv);
        });
    }

    static showNameInputModal(roomId, hasPassword) {
        const modal = document.getElementById('name-input-modal');
        const nameInput = document.getElementById('modal-player-name');
        
        modal.style.display = 'flex';
        nameInput.focus();
        
        if (hasPassword) {
            document.getElementById('join-password-group').style.display = 'block';
        }
        
        document.getElementById('room-id-input').value = roomId;
        
        document.getElementById('modal-join-btn').onclick = () => {
            const playerName = nameInput.value.trim();
            if (!playerName) {
                this.showError('プレイヤー名を入力してください');
                return;
            }
            
            document.getElementById('player-name-join').value = playerName;
            modal.style.display = 'none';
            
            if (window.game) {
                window.game.joinRoom();
            }
        };
        
        document.getElementById('modal-cancel-btn').onclick = () => {
            modal.style.display = 'none';
            nameInput.value = '';
        };
        
        nameInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                document.getElementById('modal-join-btn').click();
            }
        };
    }

    // 再入場モーダルを表示
    static showRejoinModal(roomId) {
        const modal = document.createElement('div');
        modal.className = 'name-input-modal';
        modal.innerHTML = `
            <div class="name-input-content">
                <h3>ゲームに再入場</h3>
                <div class="input-group">
                    <label>プレイヤー名:</label>
                    <input type="text" id="rejoin-modal-name" placeholder="元のプレイヤー名を入力">
                </div>
                <div class="name-input-buttons">
                    <button id="rejoin-modal-btn" class="btn btn-primary">🔄 再入場</button>
                    <button id="rejoin-cancel-btn" class="btn btn-secondary">キャンセル</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        const nameInput = document.getElementById('rejoin-modal-name');
        nameInput.focus();
        
        document.getElementById('rejoin-modal-btn').onclick = () => {
            const playerName = nameInput.value.trim();
            if (!playerName) {
                this.showError('プレイヤー名を入力してください');
                return;
            }
            
            document.getElementById('rejoin-player-name').value = playerName;
            document.getElementById('rejoin-room-id').value = roomId;
            modal.remove();
            
            if (window.game) {
                window.game.rejoinRoom();
            }
        };
        
        document.getElementById('rejoin-cancel-btn').onclick = () => {
            modal.remove();
        };
        
        nameInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                document.getElementById('rejoin-modal-btn').click();
            }
        };
    }

    static showGameRoomId(roomId) {
        const gameRoomIdEl = document.getElementById('game-room-id');
        const gameRoomIdTextEl = document.getElementById('game-room-id-text');
        
        if (roomId) {
            gameRoomIdTextEl.textContent = roomId;
            gameRoomIdEl.style.display = 'block';
        } else {
            gameRoomIdEl.style.display = 'none';
        }
    }

    static showScreen(screenName) {
        // すべての画面を非表示
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('room-info').style.display = 'none';
        document.getElementById('game-board').style.display = 'none';
        document.getElementById('victory-screen').style.display = 'none';
        
        // 指定された画面を表示
        if (screenName) {
            const screen = document.getElementById(screenName);
            if (screen) screen.style.display = 'block';
        }
    }

    static updatePlayersList(players, hostId) {
        const container = document.getElementById('players-list');
        const count = players.filter(p => p.connected).length;
        
        document.getElementById('player-count').textContent = count;
        
        container.innerHTML = '';
        players.forEach((player) => {
            const div = document.createElement('div');
            div.className = 'player-item';
            if (player.id === hostId) {
                div.classList.add('host');
            }
            
            const status = player.connected ? '🟢' : '🔴';
            const disconnectedText = player.connected ? '' : ' (切断中)';
            div.textContent = `${status} ${player.name}${disconnectedText}`;
            
            if (!player.connected) {
                div.style.opacity = '0.6';
                div.style.fontStyle = 'italic';
            }
            
            container.appendChild(div);
        });
    }

    static updateGameOverview(playerCount) {
        let roleText = '';
        let cardText = '';

        switch (playerCount) {
            case 3:
                roleText = '探検家 1-2人、豚男 1-2人';
                cardText = '子豚5匹、罠2個、空き部屋8個';
                break;
            case 4:
                roleText = '探検家 2-3人、豚男 1-2人';
                cardText = '子豚6匹、罠2個、空き部屋12個';
                break;
            case 5:
                roleText = '探検家 3人、豚男 2人';
                cardText = '子豚7匹、罠2個、空き部屋16個';
                break;
            case 6:
                roleText = '探検家 4人、豚男 2人';
                cardText = '子豚8匹、罠2個、空き部屋20個';
                break;
            case 7:
                roleText = '探検家 4-5人、豚男 2-3人';
                cardText = '子豚7匹、罠2個、空き部屋26個';
                break;
            case 8:
                roleText = '探検家 5-6人、豚男 2-3人';
                cardText = '子豚8匹、罠2個、空き部屋30個';
                break;
            case 9:
                roleText = '探検家 6人、豚男 3人';
                cardText = '子豚9匹、罠2個、空き部屋34個';
                break;
            case 10:
                roleText = '探検家 6-7人、豚男 3-4人';
                cardText = '子豚10匹、罠3個、空き部屋37個';
                break;
        }

        const rolePossibilityEl = document.getElementById('role-possibility-text');
        const cardDistributionEl = document.getElementById('card-distribution-text');
        
        if (rolePossibilityEl) rolePossibilityEl.textContent = roleText;
        if (cardDistributionEl) cardDistributionEl.textContent = cardText;
    }

    static updateProgressBars(gameData) {
        const treasureTotal = gameData.totalTreasures || gameData.treasureGoal || 7;
        const trapTotal = gameData.totalTraps || gameData.trapGoal || 2;
        const treasureFound = gameData.treasureFound || 0;
        const trapTriggered = gameData.trapTriggered || 0;

        // 財宝の進捗バー
        const treasureContainer = document.getElementById('treasure-icons');
        if (treasureContainer) {
            treasureContainer.innerHTML = '';
            for (let i = 0; i < treasureTotal; i++) {
                const icon = document.createElement('div');
                icon.className = 'progress-icon treasure';
                if (i < treasureFound) {
                    icon.classList.add('used');
                }
                icon.textContent = i < treasureFound ? '👶' : '🐷';
                treasureContainer.appendChild(icon);
            }
        }

        // 罠の進捗バー
        const trapContainer = document.getElementById('trap-icons');
        if (trapContainer) {
            trapContainer.innerHTML = '';
            for (let i = 0; i < trapTotal; i++) {
                const icon = document.createElement('div');
                icon.className = 'progress-icon trap';
                if (i < trapTriggered) {
                    icon.classList.add('used');
                }
                icon.textContent = '💀';
                if (i < trapTriggered) {
                    icon.style.filter = 'grayscale(100%) brightness(0.7)';
                }
                trapContainer.appendChild(icon);
            }
        }
    }

    static updateGameInfo(gameData) {
        const elements = {
            'current-round': gameData.currentRound,
            'treasure-found': gameData.treasureFound || 0,
            'trap-triggered': gameData.trapTriggered || 0,
            'trap-goal': gameData.trapGoal || 2,
            'cards-per-player': gameData.cardsPerPlayer || 5,
            'cards-flipped': gameData.cardsFlippedThisRound || 0,
            'treasure-goal': gameData.treasureGoal || 7
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    static showRoundStart(roundNumber) {
        const overlay = document.getElementById('round-start-overlay');
        const message = document.getElementById('round-start-message');
        
        if (overlay && message) {
            message.textContent = `ラウンド ${roundNumber} スタート！`;
            overlay.style.display = 'flex';
            
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 3000);
        }
    }

    static showVictoryScreen(gameData) {
        const screen = document.getElementById('victory-screen');
        const title = document.getElementById('victory-title');
        const messageEl = document.getElementById('victory-message');
        const winnersList = document.getElementById('winners-list');
        
        if (!screen || !title || !messageEl || !winnersList) return;
        
        if (gameData.winningTeam === 'adventurer') {
            title.textContent = '⛏️ 探検家チームの勝利！';
            title.style.color = '#FFD700';
        } else {
            title.textContent = '🐷 豚男チームの勝利！';
            title.style.color = '#DC143C';
        }
        
        messageEl.textContent = gameData.victoryMessage;
        
        winnersList.innerHTML = '<h3>勝利チーム:</h3>';
        gameData.players.forEach((player) => {
            if ((gameData.winningTeam === 'adventurer' && player.role === 'adventurer') ||
                (gameData.winningTeam === 'guardian' && player.role === 'guardian')) {
                const div = document.createElement('div');
                div.textContent = `🎉 ${player.name}`;
                div.style.color = '#FFD700';
                winnersList.appendChild(div);
            }
        });
        
        screen.style.display = 'flex';
    }

    static updateMessages(messages) {
        const container = document.getElementById('chat-container');
        if (!container) return;
        
        const recentMessages = messages.slice(-20);
        
        container.innerHTML = '';
        recentMessages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.type}`;
            
            if (msg.type === 'player') {
                div.textContent = `${msg.playerName}: ${msg.text}`;
            } else {
                div.textContent = msg.text;
            }
            
            container.appendChild(div);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    // 手動再接続ボタンを表示する関数
    static showReconnectButton() {
        const existingButton = document.getElementById('manual-reconnect-btn');
        if (existingButton) return;

        const button = document.createElement('button');
        button.id = 'manual-reconnect-btn';
        button.className = 'btn btn-small';
        button.textContent = '再接続';
        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.right = '20px';
        button.style.zIndex = '1000';
        button.style.width = 'auto';
        
        button.onclick = () => {
            if (window.game && window.game.socketClient) {
                window.game.socketClient.manualReconnect();
                button.remove();
            }
        };
        
        document.body.appendChild(button);
    }

    // 再接続ボタンを非表示にする関数
    static hideReconnectButton() {
        const button = document.getElementById('manual-reconnect-btn');
        if (button) {
            button.remove();
        }
    }
}

window.UIManager = UIManager;
