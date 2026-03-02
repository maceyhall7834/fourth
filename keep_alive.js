// keep_alive.js
const http = require('http');

const keep_alive = () => {
  http.createServer((req, res) => {
    res.write("I'm alive");
    res.end();
  }).listen(8080);
};

module.exports = keep_alive; // Ensure you're exporting the function
