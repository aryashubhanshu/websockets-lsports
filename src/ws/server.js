import { WebSocket, WebSocketServer } from 'ws';
import { wsArcjet } from '../arcjet.js';

const sendJson = (socket, payload) => {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
};

const broadcast = (wss, payload) => {
    wss.clients.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN) return;

        client.send(JSON.stringify(payload));
    });
};

export const attachWebSocketServer = (server) => {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024,
    });

    const heartbeatInterval = setInterval(() => {
        wss.clients.forEach((socket) => {
            if (socket.isAlive === false) return socket.terminate();
            socket.isAlive = false;
            socket.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(heartbeatInterval);
    });

    wss.on('connection', async (socket, req) => {
        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    const code = decision.reason.isRateLimit() ? 1013 : 1008;
                    const reason = decision.reason.isRateLimit()
                        ? 'Rate limit exceeded'
                        : 'Access denied';
                    socket.close(code, reason);
                    return;
                }
            } catch (error) {
                console.error('WS connection error', error);
                socket.close(1011, 'Server security error');
                return;
            }
        }

        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        });
        sendJson(socket, {
            type: 'welcome',
            message: 'Welcome to the WebSocket server',
        });

        socket.on('error', console.error);
    });

    const broadcastMatchCreated = (match) => {
        broadcast(wss, {
            type: 'match_created',
            data: match,
        });
    };

    return { broadcastMatchCreated };
};
