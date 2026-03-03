const Eris = require("eris");
const keep_alive = require('./keep_alive.js');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Patch Eris's Shard.identify method so Discord treats the connection as mobile
module.exports = function patchShard() {
  try {
    const { Constants, Shard } = require('eris');
    const { GATEWAY_VERSION, GatewayOPCodes } = Constants;

    Shard.prototype.identify = function () {
      this.status = "identifying";
      const identify = {
        token: this._token,
        v: GATEWAY_VERSION,
        compress: !!this.client.options.compress,
        large_threshold: this.client.options.largeThreshold,
        intents: this.client.options.intents,
        properties: {
          os: "Android",
          browser: "Discord Android",
          device: "mobile",
        },
      };
      if (this.client.options.maxShards > 1) {
        identify.shard = [this.id, this.client.options.maxShards];
      }
      if (this.presence.status) identify.presence = this.presence;
      this.sendWS(GatewayOPCodes.IDENTIFY, identify);
    };
  } catch (e) {
    console.warn('Could not patch Shard.identify for mobile device', e);
  }
};

// Call the patch function
patchShard();

// simple helper to download a URL to a temp file and return the path
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    try {
      const dest = path.join(os.tmpdir(), path.basename(new URL(url).pathname));
      const file = fs.createWriteStream(dest);
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed: ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(dest));
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Replace TOKEN with your bot account's token
// the value is pulled from process.env.token (set by dotenv or environment)
const bot = new Eris(process.env.token);

// warn if token is missing so the error is clearer
if (!process.env.token) {
  console.error('No bot token provided. Set TOKEN in your .env or environment.');
  process.exit(1);
}

// Command prefixes
const prefix = '7';

// Event listener for messages
bot.on('messageCreate', async (msg) => {
  // Ignore messages from the bot itself
  if (msg.author.id === bot.user.id) return;

  // Handle the "7say" command
  if (msg.content.startsWith(`${prefix}say`)) {
    const messageContent = msg.content.slice(prefix.length + 4).trim();
    const attachmentUrl = msg.attachments.length > 0 ? msg.attachments[0].url : null;

    if (!messageContent && !attachmentUrl) return;

    try {
      if (attachmentUrl) {
        const filePath = await downloadFile(attachmentUrl);
        const fileStream = fs.createReadStream(filePath);
        await bot.createMessage(msg.channel.id, messageContent || '', { file: { file: fileStream, name: 'attachment' } });
        fs.unlink(filePath, () => {});
      } else {
        await bot.createMessage(msg.channel.id, messageContent);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }

  // Handle the "7reply" command
  if (msg.content.startsWith(`${prefix}reply`)) {
    const args = msg.content.split(' ').slice(1);
    const messageId = args[0];
    const replyContent = args.slice(1).join(' ');

    if (messageId) {
      try {
        await bot.createMessage(msg.channel.id, replyContent, { messageReference: messageId });
      } catch (e) {
        console.error(`Failed to reply to message: ${e.message}`);
      }
    } else {
      const errorMsg = await bot.createMessage(msg.channel.id, "You didn't provide a message ID.");
      setTimeout(() => bot.deleteMessage(msg.channel.id, errorMsg.id), 5000);
    }
  }

  // Handle the "7delete" command
  if (msg.content.startsWith(`${prefix}delete`)) {
    const args = msg.content.split(' ').slice(1);
    const messageId = args[0];

    if (messageId) {
      try {
        await bot.deleteMessage(msg.channel.id, messageId);
      } catch (e) {
        console.error(`Failed to delete message: ${e.message}`);
      }
    } else {
      const errorMsg = await bot.createMessage(msg.channel.id, "You didn't provide a message ID.");
      setTimeout(() => bot.deleteMessage(msg.channel.id, errorMsg.id), 5000);
    }
  }

  // Handle the "7purge" command
  if (msg.content.startsWith(`${prefix}purge`)) {
    const args = msg.content.split(' ').slice(1);
    const numberOfMessages = parseInt(args[0]);

    if (!isNaN(numberOfMessages) && numberOfMessages > 0) {
      try {
        // Fetch and delete the bot's messages
        const messages = await bot.getMessages(msg.channel.id, { limit: numberOfMessages });
        const botMessages = messages.filter(m => m.author.id === bot.user.id);

        await Promise.all(botMessages.map(m => bot.deleteMessage(msg.channel.id, m.id)));
      } catch (e) {
        console.error(`Failed to purge messages: ${e.message}`);
      }
    } else {
      const errorMsg = await bot.createMessage(msg.channel.id, "Please provide a valid number of messages to purge.");
      setTimeout(() => bot.deleteMessage(msg.channel.id, errorMsg.id), 5000);
    }
  }
});


bot.connect().then(() => {
    console.log('Bot connected successfully.');
    keep_alive(); // Move keep_alive here
}).catch(err => {
    console.error(`Failed to connect bot: ${err.message}`);
});
