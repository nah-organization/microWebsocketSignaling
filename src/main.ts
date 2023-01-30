import http, { IncomingMessage, OutgoingHttpHeaders } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { topRedirect } from './envs';
import random from './random';

type api = {
    down: {
        siglnal: {
            sender: string;
            data: string;
        };
        users: {
            users: string[];
        };
        room: {
            id: string;
        };
    };
    up: {
        siglnal: {
            receiver: string;
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
    const url = new URL(req.url ?? '/', 'http://localhost/');
    const target = url.pathname.slice(1).split('/');
    if (target.length === 0) {
        res.writeHead(302, {
            'Location': topRedirect
        });
        res.end(`See: ${topRedirect}`);
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
            return;
        }
    }
    res.writeHead(400, {
        'Content-Type': 'application/json; charset=UTF-8'
    });
    res.end(JSON.stringify({
        error: '404 not found'
    }));
};

const websocketSender = (client: WebSocket) => <T extends keyof api['down']>(type: T, payload: api['down'][T]) => {
    client.send(JSON.stringify({
        type,
        data: payload
    }));
};

export function websocketMain(websocketClient: WebSocket, req: IncomingMessage) {

    const url = new URL(req.url ?? '/', 'http://localhost/');
    const target = url.pathname.slice(1).split('/');

    const websocketSenderClient = websocketSender(websocketClient);

    const room = (() => {
        if (target.length === 0) {
            const roomId = random();
            const room: (typeof rooms) extends Map<string, infer T> ? T : never = new Map();
            rooms.set(roomId, room);
            websocketSenderClient('room', {
                id: roomId
            });
            return room;
        }
        if (target.length === 1 && target[0]) {
            const room = rooms.get(target[0]);
            if (room) {
                return room;
            };
        }
        return null;
    })();

    if (room === null) {
        websocketClient.close();
        return;
    }
    const clientId = random();
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
            console.log(json);
            switch (json.type) {
                case 'siglnal': {
                    if (!json.data) {
                        return;
                    }
                    const receiverClient = room.get(json.data?.receiver);
                    if (!receiverClient) {
                        return;
                    }
                    websocketSender(receiverClient.socket)('siglnal', {
                        sender: clientId,
                        data: json.data.data
                    });
                    break;
                }
                case 'join': {
                    websocketSenderClient('users', {
                        users: [...room].filter(v => v[1].joined).map(v => v[0])
                    });
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
    }, 30 * 1000);
    websocketClient.once('close', () => {
        if (pongTimeout !== null) {
            clearTimeout(pongTimeout);
        }
        clearInterval(interval);
    });
}

export function start() {
    const server = http.createServer(main);

    const websocketServer = new WebSocketServer({ server });

    websocketServer.on('connection', websocketMain);

    server.listen('/socket/server.sock', () => {
        console.log(`Server running`);
    });
}

if (require.main === module) {
    start();
}
