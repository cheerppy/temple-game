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
            
            // ゲームボードに観戦モードのスタイルを適用
            const gameBoard = document.getElementById('game-board');
            if (gameBoard) {
                gameBoard.classList.add('spectator-mode');
            }
            
            // 観戦者用の情報を表示
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
        if (!statusEl) return;
        
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
        if (!errorEl) return;
        
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
        const displayEl = document.getElementById('player-name-display');
        const nameEl = document.getElementById('my-name');
        
        if (displayEl && nameEl) {
            displayEl.style.display = 'block';
            nameEl.textContent = name;
        }
    }

    static updateRoomList(rooms) {
        const container = document.getElementById('room-list-container');
        if (!container) return;
        
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
            joinBtn.className = 'btn btn-small';
            joinBtn.textContent = '参加';
            joinBtn.onclick = () => {
                this.showNameInputModal(room.id, room.hasPassword);
            };
            
            roomDiv.appendChild(infoDiv);
            roomDiv.appendChild(joinBtn);
            container.appendChild(roomDiv);
        });
    }

    static updateOngoingGames(games) {
        const container = document.getElementById('ongoing-games-container');
        if (!container) return;
        
        container.innerHTML = '';

        if (games.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #32CD32;">現在進行中のゲームはありません</p>';
            return;
        }

        games.forEach(game => {
            const gameDiv = document.createElement('div');
            gameDiv.className = 'ongoing-game-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'ongoing-game-info';
            infoDiv.innerHTML = `
                <strong>ID: ${game.id}</strong>
                <br>
                ラウンド: ${game.currentRound}/4 | プレイヤー: ${game.playerCount}/10
                <br>
                救出: ${game.treasureFound}/${game.treasureGoal} | 罠: ${game.trapTriggered}/${game.trapGoal}
            `;
            
            const spectateBtn = document.createElement('button');
            spectateBtn.className = 'btn btn-small';
            spectateBtn.textContent = '観戦する';
            spectateBtn.onclick = () => {
                const spectateRoomInput = document.getElementById('spectate-room-id');
                const spectatorNameInput = document.getElementById('spectator-name');
                
                if (spectateRoomInput) spectateRoomInput.value = game.id;
                
                // 観戦者名を自動生成
                const spectatorName = `観戦者${Math.floor(Math.random() * 1000)}`;
                if (spectatorNameInput) spectatorNameInput.value = spectatorName;
                
                // 観戦開始
                if (window.game) {
                    window.game.spectateRoom();
                }
            };
            
            gameDiv.appendChild(infoDiv);
            gameDiv.appendChild(spectateBtn);
            container.appendChild(gameDiv);
        });
    }

    static showNameInputModal(roomId, hasPassword) {
        const modal = document.getElementById('name-input-modal');
        const nameInput = document.getElementById('modal-player-name');
        
        if (!modal || !nameInput) return;
        
        // モーダルを表示
        modal.style.display = 'flex';
        nameInput.focus();
        
        // パスワードが必要な場合はルーム参加画面のパスワード欄を表示
        if (hasPassword) {
            const passwordGroup = document.getElementById('join-password-group');
            if (passwordGroup) passwordGroup.style.display = 'block';
        }
        
        // ルームIDを設定
        const roomIdInput = document.getElementById('room-id-input');
        if (roomIdInput) roomIdInput.value = roomId;
        
        // モーダルのボタンイベント設定
        const joinBtn = document.getElementById('modal-join-btn');
        if (joinBtn) {
            joinBtn.onclick = () => {
                const playerName = nameInput.value.trim();
                if (!playerName) {
                    this.showError('プレイヤー名を入力してください');
                    return;
                }
                
                // プレイヤー名を設定して参加
                const playerNameJoinInput = document.getElementById('player-name-join');
                if (playerNameJoinInput) playerNameJoinInput.value = playerName;
                modal.style.display = 'none';
                
                // ゲーム参加処理
                if (window.game) {
                    window.game.joinRoom();
                }
            };
        }
        
        const cancelBtn = document.getElementById('modal-cancel-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                nameInput.value = '';
            };
        }
        
        // Enterキーで参加
        nameInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                const joinBtn = document.getElementById('modal-join-btn');
                if (joinBtn) joinBtn.click();
            }
        };
    }

    static showGameRoomId(roomId) {
        const gameRoomIdEl = document.getElementById('game-room-id');
        const gameRoomIdTextEl = document.getElementById('game-room-id-text');
        
        if (gameRoomIdEl && gameRoomIdTextEl) {
            if (roomId) {
                gameRoomIdTextEl.textContent = roomId;
                gameRoomIdEl.style.display = 'block';
            } else {
                gameRoomIdEl.style.display = 'none';
            }
        }
    }

    static showScreen(screenName) {
        // すべての画面を非表示
        const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
        
        screens.forEach(screen => {
            const element = document.getElementById(screen);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        // 指定された画面を表示
        if (screenName) {
            const screen = document.getElementById(screenName);
            if (screen) {
                screen.style.display = 'block';
            }
        }
    }

    static updatePlayersList(players, hostId) {
        const container = document.getElementById('players-list');
        const countEl = document.getElementById('player-count');
        
        if (!container || !countEl) return;
        
        const count = players.filter(p => p.connected).length;
        countEl.textContent = count;
        
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
            
            // 切断中のプレイヤーは薄く表示
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
                
                // 画像読み込みエラー時のフォールバック処理
                this.setupIconFallback(icon, 'treasure', i < treasureFound);
                
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
                
                // 画像読み込みエラー時のフォールバック処理
                this.setupIconFallback(icon, 'trap', i < trapTriggered);
                
                trapContainer.appendChild(icon);
            }
        }
    }

    // アイコンの画像読み込みエラー時のフォールバック処理
    static setupIconFallback(icon, type, isUsed) {
        // 画像が読み込まれない場合のタイマー
        setTimeout(() => {
            const hasBackground = window.getComputedStyle(icon).backgroundImage !== 'none';
            if (!hasBackground) {
                // 画像が読み込まれていない場合は絵文字表示に切り替え
                icon.classList.add('emoji-only');
                console.log(`${type} icon fallback to emoji`);
            }
        }, 1000);
    }

    static updateGameInfo(gameData) {
        const elements = {
            'current-round': gameData.currentRound,
            'treasure-found': gameData.treasureFound || 0,
            'trap-triggered': gameData.trapTriggered || 0,
            'trap-goal': gameData.trapGoal || 2,
            'cards-per-player': gameData.cardsPerPlayer || 5,
            'cards-flipped': gameData.cardsFlippedThisRound || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        // 財宝目標も更新
        const treasureGoalEl = document.getElementById('treasure-goal');
        if (treasureGoalEl) {
            treasureGoalEl.textContent = gameData.treasureGoal || 7;
        }
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
