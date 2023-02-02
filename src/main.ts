import http, { IncomingMessage, OutgoingHttpHeaders } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { topRedirect } from './envs';
import random from './random';

type api = {
    down: {
        signal: {
            sender: string;
            receivers: [string];
            data: string;
        };
        users: {
            me: string;
            users: string[];
            event: {
                type: 'join' | 'leave',
                user: string;
            };
        };
        room: {
            id: string;
        };
    };
    up: {
        signal: {
            receivers: [string];
            data: string;
        };
        join: {

        };
    };
};

type valueof<T> = T[keyof T];

const rooms = new Map<string, Map<string, {
    joined: boolean,
    socket: WebSocket;
}>>();


export function main(req: { url?: string; }, res: {
    end(value: string): void,
    writeHead(status: number, header: OutgoingHttpHeaders): void;
}) {
    console.log('accessed: ', req.url);
    const url = new URL(req.url ?? '/', 'http://localhost/');
    const target = (v => v.at(-1) ? v : v.slice(0, -1))(url.pathname.slice(1).split('/'));

    if (target.length === 0) {
        res.writeHead(302, {
            'Location': topRedirect
        });
        res.end(`See: ${topRedirect}`);
        console.log('redirect');
        return;
    }
    if (target.length === 1 && target[0]) {
        const room = rooms.get(target[0]);
        if (room) {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=UTF-8'
            });
            res.end(JSON.stringify({
                users: [...room].filter(v => v[1].joined).map(v => v[0])
            }));
            console.log('already');
            return;
        }
    }
    res.writeHead(404, {
        'Content-Type': 'application/json; charset=UTF-8'
    });
    res.end(JSON.stringify({
        error: '404 not found'
    }));
    console.log('404');
};

const websocketSender = (client: WebSocket) => <T extends keyof api['down']>(type: T, payload: api['down'][T]) => {
    client.send(JSON.stringify({
        type,
        data: payload
    }));
};

export function websocketMain(websocketClient: WebSocket, req: IncomingMessage) {
    console.log('connected: ', req.url);
    const url = new URL(req.url ?? '/', 'http://localhost/');
    const target = (v => v.at(-1) ? v : v.slice(0, -1))(url.pathname.slice(1).split('/'));

    const websocketSenderClient = websocketSender(websocketClient);
    const clientId = random();
    type roomType = (typeof rooms) extends Map<string, infer T> ? T : never;

    const roomWrapper: [roomType, string] | null = (() => {
        if (target.length === 0) {
            const roomId = random();
            const room: roomType = new Map();
            rooms.set(roomId, room);
            websocketSenderClient('room', {
                id: roomId
            });
            console.log('create room: ', roomId, 'owner: ', clientId);
            return [room, roomId];
        }
        if (target.length === 1 && target[0]) {
            const room = rooms.get(target[0]);
            if (room) {
                console.log('join room: ', target[0], 'user: ', clientId);
                return [room, target[0]];
            };
        }
        return null;
    })();
    if (roomWrapper === null) {
        console.log('close:', clientId);
        websocketClient.close();
        return;
    }
    const [room, roomId] = roomWrapper;

    room.set(clientId, {
        joined: false,
        socket: websocketClient
    });

    websocketClient.on('message', data => {
        try {
            const message = '' + data;
            if (message === 'pong') {
                if (pongTimeout !== null) {
                    clearTimeout(pongTimeout);
                }
                return;
            }
            type wsup = api['up'];
            const json = JSON.parse(message) as valueof<{
                [P in keyof wsup]: {
                    type: P,
                    data: wsup[P];
                };
            }>;
            if (!json) {
                return;
            }
            console.log(clientId, '@', roomId, json);
            switch (json.type) {
                case 'signal': {
                    if (!json.data) {
                        return;
                    }
                    const receivers = json.data?.receivers;
                    if (!(receivers && Array.isArray(receivers))) {
                        return;
                    }
                    for (const receiver of receivers) {
                        const receiverClient = room.get(receiver);
                        if (!receiverClient) {
                            return;
                        }
                        websocketSender(receiverClient.socket)('signal', {
                            sender: clientId,
                            receivers: receivers,
                            data: json.data.data
                        });
                    }
                    break;
                }
                case 'join': {
                    const users = [...room].filter(v => v[1].joined);
                    for (const user of users) {
                        websocketSender(user[1].socket)('users', {
                            me: clientId,
                            users: users.map(v => v[0]),
                            event: {
                                type: 'join',
                                user: clientId
                            }
                        });
                    }
                    console.log('join: ', clientId);
                    room.set(clientId, {
                        joined: true,
                        socket: websocketClient
                    });
                    break;
                }
            }
        } catch (e) {
            console.error(e);
        }
    });
    let pongTimeout: NodeJS.Timeout | null = null;
    const interval = setInterval(() => {
        websocketClient.send('ping');
        pongTimeout = setTimeout(() => {
            websocketClient.close();
        }, 3 * 1000);
    }, 300 * 1000);
    websocketClient.once('close', () => {
        if (pongTimeout !== null) {
            clearTimeout(pongTimeout);
        }
        clearInterval(interval);

        room.delete(clientId);

        const users = [...room].filter(v => v[1].joined);
        for (const user of users) {
            websocketSender(user[1].socket)('users', {
                me: clientId,
                users: users.map(v => v[0]),
                event: {
                    type: 'leave',
                    user: clientId
                }
            });
        }
        if (room.size === 0) {
            rooms.delete(roomId);
        }
    });
}

export function start() {
    const server = http.createServer(main);

    const websocketServer = new WebSocketServer({ server });

    websocketServer.on('connection', websocketMain);

    server.listen(10000, () => {
        console.log(`Server running`);
    });
}

if (require.main === module) {
    start();
}
