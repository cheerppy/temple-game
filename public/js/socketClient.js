class SocketClient {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.initializeSocket();
    }

    initializeSocket() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            pingInterval: 25000,
            pingTimeout: 60000
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 接続イベント
        this.socket.on('connect', () => {
            this.game.mySocketId = this.socket.id;
            UIManager.showConnectionStatus('connected');
            this.reconnectAttempts = 0; // 再接続カウンタをリセット
            console.log('サーバーに接続しました');
        });

        // 切断イベント
        this.socket.on('disconnect', (reason) => {
            UIManager.showConnectionStatus('disconnected');
            console.log('サーバーから切断されました:', reason);
            
            if (reason === 'io server disconnect') {
                // サーバー側から切断された場合は手動で再接続
                this.socket.connect();
            }
        });

        // 再接続試行イベント
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`再接続試行 ${attemptNumber}/${this.maxReconnectAttempts}`);
            UIManager.showError(`再接続中... (${attemptNumber}/${this.maxReconnectAttempts})`);
        });

        // 再接続成功イベント
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`再接続成功 (試行回数: ${attemptNumber})`);
            UIManager.showError('再接続しました！', 'success');
            
            // 保存された情報で自動的にルームに再参加を試行
            const savedPlayerInfo = localStorage.getItem('pigGamePlayerInfo');
            if (savedPlayerInfo) {
                const playerInfo = JSON.parse(savedPlayerInfo);
                setTimeout(() => {
                    this.reconnectToRoom(playerInfo.roomId, playerInfo.playerName);
                }, 500);
            }
        });

        // 再接続失敗イベント
        this.socket.on('reconnect_failed', () => {
            console.log('再接続に失敗しました');
            UIManager.showError('サーバーに接続できません。ページを更新してください。');
        });

        // ルーム一覧受信
        this.socket.on('roomList', (rooms) => {
            UIManager.updateRoomList(rooms);
        });

        // ルーム作成完了
        this.socket.on('roomCreated', (data) => {
            this.game.onRoomCreated(data);
        });

        // ルーム参加成功
        this.socket.on('joinSuccess', (data) => {
            this.game.onJoinSuccess(data);
        });

        // 再接続成功
        this.socket.on('reconnectSuccess', (data) => {
            this.game.onReconnectSuccess(data);
        });

        // ゲーム状態更新
        this.socket.on('gameUpdate', (gameData) => {
            this.game.gameData = gameData;
            this.game.updateUI();
        });

        // メッセージ受信
        this.socket.on('newMessage', (messages) => {
            UIManager.updateMessages(messages);
        });

        // ラウンド開始受信
        this.socket.on('roundStart', (roundNumber) => {
            UIManager.showRoundStart(roundNumber);
        });

        // エラー処理
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            UIManager.showError(error.message);
        });

        // 接続エラー処理
        this.socket.on('connect_error', (error) => {
            console.error('接続エラー:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。しばらく待ってから再試行してください。');
            } else {
                UIManager.showError(`接続エラー (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            }
        });
    }

    // Socket.io通信メソッド
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn('Socket not connected, cannot emit:', event);
            UIManager.showError('サーバーに接続されていません');
        }
    }

    getRoomList() {
        this.emit('getRoomList');
    }

    createRoom(playerName, hasPassword, password) {
        this.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        this.emit('joinRoom', { roomId, playerName, password });
    }

    // 再接続用メソッド
    reconnectToRoom(roomId, playerName) {
        console.log(`ルーム再接続を試行: ${playerName} -> ${roomId}`);
        this.emit('reconnectToRoom', { roomId, playerName });
    }

    sendChat(message) {
        this.emit('sendChat', message);
    }

    startGame() {
        this.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        this.emit('selectCard', { targetPlayerId, cardIndex });
    }

    leaveRoom() {
        this.emit('leaveRoom');
    }

    // 手動再接続メソッド
    manualReconnect() {
        if (!this.socket.connected) {
            console.log('手動再接続を試行...');
            this.socket.connect();
        }
    }

    // 接続状態確認
    isConnected() {
        return this.socket && this.socket.connected;
    }

    // デバッグ情報取得
    getDebugInfo() {
        return {
            connected: this.isConnected(),
            socketId: this.socket ? this.socket.id : null,
            reconnectAttempts: this.reconnectAttempts,
            transport: this.socket ? this.socket.io.engine.transport.name : null
        };
    }
}

// グローバルに公開
window.SocketClient = SocketClient;
