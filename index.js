const Eris = require("eris");
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
      console.log(`Identifying shard: ${this.id}`);
      this.sendWS(GatewayOPCodes.IDENTIFY, identify);
    };
  } catch (e) {
    console.warn('Could not patch Shard.identify for mobile device', e);
  }
}

// simple helper to download a URL to a temp file and return the path
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    try {
      const dest = path.join(os.tmpdir(), path.basename(new URL(url).pathname));
      const file = fs.createWriteStream(dest);
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          console.error(`Download failed: ${res.statusCode}`);
          return reject(new Error(`Download failed: ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            console.log(`Downloaded file to: ${dest}`);
            resolve(dest);
          });
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        console.error('Error downloading file', err);
        reject(err);
      });
    } catch (err) {
      console.error('Error in downloadFile', err);
      reject(err);
    }
  });
}

// Replace TOKEN with your bot account's token
const bot = new Eris(process.env.token);

// warn if token is missing so the error is clearer
if (!process.env.token) {
  console.error('No bot token provided. Set TOKEN in your .env or environment.');
  process.exit(1);
} else {
  console.log(`Bot token provided, initializing bot...`);
}

const prefix = '7';

// Event listener for messages
bot.on('messageCreate', async (msg) => {
  console.log(`Message received from ${msg.author.username}: ${msg.content}`);

  // Ignore messages from the bot itself
  if (msg.author.id === bot.user.id) return;

  if (msg.content.startsWith(`${prefix}say`)) {
    const messageContent = msg.content.slice(prefix.length + 4).trim();
    const attachmentUrl = msg.attachments.length > 0 ? msg.attachments[0].url : null;
    
    if (!messageContent && !attachmentUrl) return;

    if (attachmentUrl) {
      try {
        const filePath = await downloadFile(attachmentUrl);
        const fileStream = fs.createReadStream(filePath);
        if (messageContent) {
          await bot.createMessage(msg.channel.id, messageContent, { file: fileStream });
        } else {
          await bot.createMessage(msg.channel.id, { file: fileStream });
        }
        fs.unlink(filePath, () => {});
        console.log(`Message sent to channel ${msg.channel.id} with attachment`);
      } catch (err) {
        console.error('Attachment relay failed', err);
        const fallback = messageContent || attachmentUrl;
        await bot.createMessage(msg.channel.id, fallback);
      }
    } else {
      await bot.createMessage(msg.channel.id, messageContent);
      console.log(`Message sent to channel ${msg.channel.id}: ${messageContent}`);
    }
  }

  if (msg.content.startsWith(`${prefix}reply`)) {
    const args = msg.content.split(' ').slice(1);
    const messageId = args[0];
    const replyContent = args.slice(1).join(' ');

    if (messageId) {
      await bot.createMessage(msg.channel.id, replyContent, { messageReference: messageId });
      console.log(`Reply sent to message ${messageId}: ${replyContent}`);
    } else {
      const errorMsg = await bot.createMessage(msg.channel.id, "You didn't provide a message ID.");
      console.log('Error: No message ID provided for reply');
      setTimeout(() => bot.deleteMessage(msg.channel.id, errorMsg.id), 5000);
    }
  }

  if (msg.content.startsWith(`${prefix}delete`)) {
    const args = msg.content.split(' ').slice(1);
    const messageId = args[0];

    if (messageId) {
      try {
        await bot.deleteMessage(msg.channel.id, messageId);
        console.log(`Message ${messageId} deleted from channel ${msg.channel.id}`);
      } catch (e) {
        console.error(`Failed to delete message: ${e.message}`);
      }
    } else {
      const errorMsg = await bot.createMessage(msg.channel.id, "You didn't provide a message ID.");
      console.log('Error: No message ID provided for delete');
      setTimeout(() => bot.deleteMessage(msg.channel.id, errorMsg.id), 5000);
    }
  }
});

bot.connect(); // Get the bot to connect to Discord
