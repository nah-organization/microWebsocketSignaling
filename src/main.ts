import http, { OutgoingHttpHeaders } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { topRedirect } from './envs';

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
    res.writeHead(200, {
        'Content-Type': 'text/plain; charset=UTF-8'
    });
    res.end('');
};

export function start() {
    const server = http.createServer(main);
    const websocketServer = new WebSocketServer({ server });



    server.listen('/socket/server.sock', () => {
        console.log(`Server running`);
    });
}

if (require.main === module) {
    start();
}
