const Eris = require("eris");
const keep_alive = require('./keep_alive.js');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// override the identify payload so Discord treats us as mobile
try {
  const Shard = require('eris/lib/gateway/Shard');
  const Constants = require('eris/lib/Constants');
  const { GATEWAY_VERSION, GatewayOPCodes } = Constants;

  Shard.prototype.identify = function () {
    // largely copied from the original implementation in Shard.js,
    // only overriding the properties object.  we skip the zlib/compress
    // check since the default isn't enabled and we don't need it.
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
    if (this.presence.status) {
      identify.presence = this.presence;
    }
    this.sendWS(GatewayOPCodes.IDENTIFY, identify);
  };
} catch (e) {
  console.warn('Could not patch Shard.identify for mobile device', e);
}

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

    // nothing to repeat
    if (!messageContent && !attachmentUrl) return;

    // if there's an attachment, download and re-upload the real file
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
      } catch (err) {
        console.error('Attachment relay failed', err);
        // fallback: just send what we can
        const fallback = messageContent || attachmentUrl;
        await bot.createMessage(msg.channel.id, fallback);
      }
    } else {
      // text-only
      await bot.createMessage(msg.channel.id, messageContent);
    }
  }

  // Handle the "7reply" command
  if (msg.content.startsWith(`${prefix}reply`)) {
    const args = msg.content.split(' ').slice(1);
    const messageId = args[0];
    const replyContent = args.slice(1).join(' ');

    if (messageId) {
      await bot.createMessage(msg.channel.id, replyContent, { messageReference: messageId });
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
      // If not replying, send an error message and delete it after 5 seconds
      const errorMsg = await bot.createMessage(msg.channel.id, "You didn't provide a message ID.");
      setTimeout(() => bot.deleteMessage(msg.channel.id, errorMsg.id), 5000);
    }
  }
});

bot.connect(); // Get the bot to connect to Discord
