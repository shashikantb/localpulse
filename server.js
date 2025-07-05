const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = parseInt(process.env.PORT, 10) || 3000;

const keyPath = path.join(__dirname, 'server.key');
const certPath = path.join(__dirname, 'server.cert');

let httpsOptions = null;

// Only try to use HTTPS in production and if cert files exist
if (!dev && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('Found SSL certificates, starting HTTPS server.');
  httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
} else if (!dev) {
    console.warn('------------------------------------------------------------');
    console.warn('WARNING: Could not find server.key or server.cert for production.');
    console.warn('The application will start with HTTP, which is NOT RECOMMENDED.');
    console.warn('Secure cookies may not work correctly without HTTPS.');
    console.warn('Generate certificates using the command in the README.md');
    console.warn('------------------------------------------------------------');
}


app.prepare().then(() => {
  if (httpsOptions) {
    // Production with HTTPS
    createHttpsServer(httpsOptions, (req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on https://localhost:${port}`);
    });
  } else {
    // Development or Production without HTTPS
    createHttpServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
    });
  }
});
