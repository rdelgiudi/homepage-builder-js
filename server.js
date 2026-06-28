const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const PRESENCE_WS = 'ws://localhost:3001';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

global.__wsData = {
  presence: null,
};

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    console.log(`[${new Date().toISOString()}] [WS] Browser client connected (${wss.clients.size} total)`);
    ws.on('close', () => {
      console.log(`[${new Date().toISOString()}] [WS] Browser client disconnected (${wss.clients.size} total)`);
    });
  });

  const handleUpgrade = app.getUpgradeHandler();

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      handleUpgrade(req, socket, head);
    }
  });

  server.listen(port, () => {
    console.log(`[${new Date().toISOString()}] > Ready on http://${hostname}:${port}`);
  });

  let presenceWs = null;
  let reconnectTimer = null;

  function connectPresence() {
    const ws = new (require('ws'))(PRESENCE_WS);

    ws.on('open', () => {
      console.log(`[${new Date().toISOString()}] [Discord Presence] Connected to presence service`);
      presenceWs = ws;
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'presence') {
          const status = msg.data?.status || 'unknown';
          const activity = msg.data?.activities?.[0]?.name || 'none';
          global.__wsData.presence = msg.data;
          const broadcast = JSON.stringify(msg);
          let count = 0;
          wss.clients.forEach((client) => {
            if (client.readyState === 1) {
              client.send(broadcast);
              count++;
            }
          });
          console.log(`[${new Date().toISOString()}] [Discord Presence] Relayed (status: ${status}, activity: "${activity}") to ${count} browser client(s)`);
        }
      } catch (e) {
        console.error(`[${new Date().toISOString()}] [Discord Presence] WS message error:`, e);
      }
    });

    ws.on('close', () => {
      console.log(`[${new Date().toISOString()}] [Discord Presence] Disconnected, reconnecting in 5s...`);
      presenceWs = null;
      reconnectTimer = setTimeout(connectPresence, 5000);
    });

    ws.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] [Discord Presence] WS error:`, err.message);
      ws.close();
    });
  }

  connectPresence();
});
