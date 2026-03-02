// index.js

const keep_alive = require('./keep_alive.js');
const { Shard } = require('eris/lib/gateway');
const patchShard = require('./shard.js');
const bot = require('./bot.js');

// Patch the Shard with the mobile override
patchShard(Shard);

if (!process.env.token) {
  console.error('No bot token provided. Set TOKEN in your .env or environment.');
  process.exit(1);
}

bot.connect(); // Connect the bot to Discord
