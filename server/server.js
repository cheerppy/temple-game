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

// デバッグ用ルート（追加）
app.get('/debug', (req, res) => {
    const fs = require('fs');
    const publicPath = path.join(__dirname, '../public');
    const cssPath = path.join(publicPath, 'css');
    const jsPath = path.join(publicPath, 'js');
    
    try {
        const publicFiles = fs.readdirSync(publicPath);
        const cssFiles = fs.existsSync(cssPath) ? fs.readdirSync(cssPath) : ['CSS folder not found'];
        const jsFiles = fs.existsSync(jsPath) ? fs.readdirSync(jsPath) : ['JS folder not found'];
        
        res.json({
            publicPath,
            publicFiles,
            cssFiles,
            jsFiles,
            workingDirectory: process.cwd()
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Socket.ioハンドラーの設定
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});
