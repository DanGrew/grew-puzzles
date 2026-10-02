const http = require('http');
const handler = require('./node_modules/serve-handler');

process.chdir(__dirname);

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  req.url = req.url.replace(/^\/grew-puzzles(?=\/|$)/, '') || '/';
  // Serve x.html as x.html, as GitHub Pages does: cleanUrls' redirect to /x drops the query
  // (play.html?collection=…&id=…). Kept for every other path, so a directory serves its index.
  handler(req, res, { public: __dirname, cleanUrls: ['!**/*.html'] });
}).listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}`);
});
