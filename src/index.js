import http from 'http';
import express from 'express';
import { matchRouter } from './routes/matches.js';
import { commentaryRouter } from './routes/commentary.js';
import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || 'localhost';

const app = express();
const server = http.createServer(app);

app.use(securityMiddleware());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use('/matches', matchRouter);
app.use('/matches/:id/commentary', commentaryRouter);

const { broadcastMatchCreated, broadcastCommentary } =
    attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

server.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;

    console.log(`Server is running at http://${displayHost}:${PORT}`);
    console.log(
        `WebSocket server is running at ws://${displayHost}:${PORT}/ws`,
    );
});
