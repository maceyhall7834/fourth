// entrypoint for the application
// dotenv must be configured first so other modules can read environment values
require('dotenv').config();

// apply mobile-identify patch to shard logic
require('./shard')();

// start the main bot logic (creates the client, registers handlers, connects, etc.)
// guard by environment variable so web-only deployments can disable the bot
if (process.env.RUN_BOT !== 'false') {
  require('./bot');
} else {
  console.log('RUN_BOT=false; bot startup suppressed (web only).');
}
