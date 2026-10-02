const http = require('http');
const handler = require('./node_modules/serve-handler');

process.chdir(__dirname);

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  // Serve as GitHub Pages does: a directory is its index.html, and page.html is served as asked.
  // serve-handler's clean URLs would instead redirect page.html and drop the play URL's query.
  req.url = (req.url.replace(/^\/grew-puzzles(?=\/|$)/, '') || '/').replace(/\/(?=\?|$)/, '/index.html');
  handler(req, res, { public: __dirname, cleanUrls: false });
}).listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}`);
});
