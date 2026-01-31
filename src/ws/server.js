import { WebSocket, WebSocketServer } from 'ws';

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

    wss.on('connection', (socket) => {
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
