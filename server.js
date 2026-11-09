import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const MAX_CLIENTS_PER_ROOM = 24;
const MAX_MESSAGE_BYTES = 1024;
const MIN_PRESENCE_INTERVAL_MS = 40;
const MIN_EVENT_INTERVAL_MS = 500;

const rooms = new Map();
let nextPeerNumber = 1;

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function roomPeers(room) {
  return [...room.values()];
}
function publicPeer(client) {
  return { id: client.id, presence: client.presence || {} };
}
function broadcast(room, data, exceptId = null) {
  for (const client of room.values()) {
    if (client.id !== exceptId) send(client.ws, data);
  }
}
function assignRoom() {
  for (let i = 1; ; i++) {
    const name = `sea${i}`;
    const room = rooms.get(name);
    if (!room || room.size < MAX_CLIENTS_PER_ROOM) {
      if (!room) rooms.set(name, new Map());
      return name;
    }
  }
}
function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
function validatePresence(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { x, z, m, h, g, c, k } = data;
  if (!isFiniteNumber(x) || x < -190 || x > 190) return null;
  if (!isFiniteNumber(z) || z < -250 || z > 110) return null;
  if (!['w', 'p', 's'].includes(m)) return null;
  if (!isFiniteNumber(h) || h < -Math.PI || h > Math.PI) return null;
  if (![0, 1].includes(g)) return null;
  if (!Number.isInteger(c) || c < 0 || c > 9) return null;
  if (!Number.isInteger(k) || k < 0 || k > 2) return null;
  return { x, z, m, h, g, c, k };
}
function validateEvent(event, data, room) {
  if (!['chat', 'drop', 'fight'].includes(event)) return null;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (event === 'chat') {
    if (typeof data.t !== 'string') return null;
    const t = Array.from(data.t.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 60).join('');
    if (!t) return null;
    return { t };
  }
  if (typeof data.to !== 'string' || data.to.length > 80) return null;
  if (![...room.values()].some(client => client.id === data.to)) return null;
  return { to: data.to };
}
function leaveRoom(client) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (!room) return;
  room.delete(client.id);
  broadcast(room, { type: 'peer_left', id: client.id });
  if (room.size === 0) rooms.delete(client.room);
  client.room = null;
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'surf-world' }));
    return;
  }
  let requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filePath = path.resolve(PUBLIC_DIR, `.${requested}`);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, contents) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
    res.end(contents);
  });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname !== '/ws') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', ws => {
  const client = {
    ws,
    id: `p${Date.now().toString(36)}${(nextPeerNumber++).toString(36)}`,
    room: null,
    presence: null,
    lastPresenceAt: 0,
    lastEventAt: 0,
    joined: false
  };
  ws.on('message', raw => {
    if (Buffer.byteLength(raw) > MAX_MESSAGE_BYTES) { ws.close(1009, 'Message too large'); return; }
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { send(ws, { type: 'error', message: 'Invalid JSON' }); return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;

    if (msg.type === 'join') {
      if (client.joined) return;
      client.room = assignRoom();
      const room = rooms.get(client.room);
      client.joined = true;
      room.set(client.id, client);
      send(ws, { type: 'welcome', id: client.id, room: client.room, peers: roomPeers(room).map(publicPeer) });
      broadcast(room, { type: 'peer_joined', id: client.id, presence: client.presence || {} }, client.id);
      return;
    }
    if (!client.joined || !client.room) return;
    const room = rooms.get(client.room);
    if (!room) return;

    if (msg.type === 'presence') {
      const now = Date.now();
      if (now - client.lastPresenceAt < MIN_PRESENCE_INTERVAL_MS) return;
      const data = validatePresence(msg.data);
      if (!data) return;
      client.lastPresenceAt = now;
      client.presence = data;
      broadcast(room, { type: 'presence', id: client.id, data }, client.id);
      return;
    }

    if (msg.type === 'event') {
      const now = Date.now();
      if (now - client.lastEventAt < MIN_EVENT_INTERVAL_MS) return;
      const event = typeof msg.event === 'string' ? msg.event : '';
      const data = validateEvent(event, msg.data, room);
      if (!data) return;
      client.lastEventAt = now;
      broadcast(room, { type: 'event', peer: client.id, event, data }, client.id);
    }
  });
  ws.on('close', () => leaveRoom(client));
  ws.on('error', () => leaveRoom(client));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SURF WORLD listening on port ${PORT}`);
});
