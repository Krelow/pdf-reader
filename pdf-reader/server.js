const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 File Non Trovato');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Errore del Server');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('\n======================================================');
  console.log('       📱 LETTORE PDF LIBERO - SERVER LOCALE          ');
  console.log('======================================================');
  console.log(`\n> Sul tuo PC:        http://localhost:${PORT}`);
  console.log(`> Dal tuo Android:   http://${ip}:${PORT}`);
  console.log('\nPer installarla su Android:');
  console.log(`1. Collega il telefono alla stessa rete Wi-Fi del PC.`);
  console.log(`2. Apri Chrome o Firefox su Android e vai su: http://${ip}:${PORT}`);
  console.log(`3. Tocca i tre puntini (⋮) in alto a destra e seleziona:`);
  console.log(`   "Installa app" oppure "Aggiungi a schermata Home".`);
  console.log('\nPremere Ctrl+C per arrestare il server.\n');
});
