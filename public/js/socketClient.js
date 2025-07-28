class SocketClient {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.initializeSocket();
    }

    initializeSocket() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            pingInterval: 25000,
            pingTimeout: 60000
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            this.game.mySocketId = this.socket.id;
            UIManager.showConnectionStatus('connected');
            console.log('サーバーに接続しました');
        });

        this.socket.on('disconnect', () => {
            UIManager.showConnectionStatus('disconnected');
            console.log('サーバーから切断されました');
        });

        this.socket.on('roomList', (rooms) => {
            UIManager.updateRoomList(rooms);
        });

        this.socket.on('roomCreated', (data) => {
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = true;
            this.game.showRoomInfo();
        });

        this.socket.on('gameUpdate', (gameData) => {
            this.game.gameData = gameData;
            this.game.updateUI();
        });

        this.socket.on('newMessage', (messages) => {
            UIManager.updateMessages(messages);
        });

        this.socket.on('roundStart', (roundNumber) => {
            UIManager.showRoundStart(roundNumber);
        });

        this.socket.on('error', (error) => {
            UIManager.showError(error.message);
        });

        this.socket.on('connect_error', (error) => {
            console.error('接続エラー:', error);
            UIManager.showError('サーバーに接続できません');
        });
    }

    emit(event, data) {
        this.socket.emit(event, data);
    }

    getRoomList() {
        this.socket.emit('getRoomList');
    }

    createRoom(playerName, hasPassword, password) {
        this.socket.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        this.socket.emit('joinRoom', { roomId, playerName, password });
    }

    sendChat(message) {
        this.socket.emit('sendChat', message);
    }

    startGame() {
        this.socket.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        this.socket.emit('selectCard', { targetPlayerId, cardIndex });
    }

    leaveRoom() {
        this.socket.emit('leaveRoom');
    }
}

window.SocketClient = SocketClient;