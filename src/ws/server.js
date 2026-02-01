import { WebSocket, WebSocketServer } from 'ws';
import { wsArcjet } from '../arcjet.js';

const matchSubscribers = new Map();

const subscribe = (matchId, socket) => {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket);
};

const unsubscribe = (matchId, socket) => {
    const subscribers = matchSubscribers.get(matchId);

    if (!subscribers) return;

    if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }

    subscribers.delete(socket);
};

const cleanupSubscriptions = (socket) => {
    socket.subscriptions.forEach((matchId) => {
        unsubscribe(matchId, socket);
    });
};

const sendJson = (socket, payload) => {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
};

const broadcastToAll = (wss, payload) => {
    wss.clients.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN) return;

        client.send(JSON.stringify(payload));
    });
};

const broadcastToMatch = (matchId, payload) => {
    const subscribers = matchSubscribers.get(matchId);

    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    subscribers.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

const handleMessage = (socket, data) => {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch (error) {
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
        return;
    }

    if (message?.type === 'subscribe' && Number.isInteger(message.matchId)) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);

        sendJson(socket, {
            type: 'subscribed',
            matchId: message.matchId,
        });

        return;
    }

    if (message?.type === 'unsubscribe' && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);

        sendJson(socket, {
            type: 'unsubscribed',
            matchId: message.matchId,
        });

        return;
    }
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

        socket.subscriptions = new Set();

        sendJson(socket, {
            type: 'welcome',
            message: 'Welcome to the WebSocket server',
        });

        socket.on('message', (data) => {
            handleMessage(socket, data);
        });

        socket.on('error', () => {
            socket.terminate();
        });

        socket.on('close', () => {
            cleanupSubscriptions(socket);
        });
    });

    const broadcastMatchCreated = (match) => {
        broadcastToAll(wss, {
            type: 'match_created',
            data: match,
        });
    };

    const broadcastCommentary = (matchId, comment) => {
        broadcastToMatch(matchId, {
            type: 'commentary',
            data: comment,
        });
    };

    return { broadcastMatchCreated, broadcastCommentary };
};
