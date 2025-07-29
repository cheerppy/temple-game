class UIManager {
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

    static showError(message) {
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
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
            div.textContent = `${status} ${player.name}`;
            
            container.appendChild(div);
        });
    }

    static updateGameOverview(playerCount) {
        let roleText = '';
        let cardText = '';

        switch (playerCount) {
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

    static updateProgressBars(gameData) {
        const treasureTotal = gameData.totalTreasures || gameData.treasureGoal || 7;
        const trapTotal = gameData.totalTraps || gameData.trapGoal || 2;
        const treasureFound = gameData.treasureFound || 0;
        const trapTriggered = gameData.trapTriggered || 0;

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
        }
    }

    static updateGameInfo(gameData) {
        document.getElementById('current-round').textContent = gameData.currentRound;
        document.getElementById('treasure-found').textContent = gameData.treasureFound || 0;
        document.getElementById('trap-triggered').textContent = gameData.trapTriggered || 0;
        document.getElementById('trap-goal').textContent = gameData.trapGoal || 2;
        document.getElementById('cards-per-player').textContent = gameData.cardsPerPlayer || 5;
        document.getElementById('cards-flipped').textContent = gameData.cardsFlippedThisRound || 0;
    }

    static showRoundStart(roundNumber) {
        const overlay = document.getElementById('round-start-overlay');
        const message = document.getElementById('round-start-message');
        
        message.textContent = `ラウンド ${roundNumber} スタート！`;
        overlay.style.display = 'flex';
        
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 3000);
    }

    static showVictoryScreen(gameData) {
        const screen = document.getElementById('victory-screen');
        const title = document.getElementById('victory-title');
        const messageEl = document.getElementById('victory-message');
        const winnersList = document.getElementById('winners-list');
        
        if (gameData.winningTeam === 'adventurer') {
            title.textContent = '⛏️ 探検家チームの勝利！';
            title.style.color = '#FFD700';
        } else {
            title.textContent = '🛡️ 守護者チームの勝利！';
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
}

window.UIManager = UIManager;
