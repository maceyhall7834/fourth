// entrypoint for the application
// dotenv must be configured first so other modules can read environment values
require('dotenv').config();

// apply mobile-identify patch to shard logic
require('./shard')();

// start the main bot logic (creates the client, registers handlers, connects, etc.)
require('./bot');
