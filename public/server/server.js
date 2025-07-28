const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

const { setupSocketHandlers } = require('./socketHandlers');

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Socket.ioハンドラーの設定
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});