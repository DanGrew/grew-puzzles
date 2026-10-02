const http = require('http');
const handler = require('./node_modules/serve-handler');

process.chdir(__dirname);

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  req.url = req.url.replace(/^\/grew-puzzles(?=\/|$)/, '') || '/';
  handler(req, res, { public: __dirname });
}).listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}`);
});
