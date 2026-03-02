// bot.js

const Eris = require("eris");
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

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
const bot = new Eris(process.env.token);
const prefix = '7';

// Command listener
bot.on('messageCreate', async (msg) => {
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
      } catch (err) {
        console.error('Attachment relay failed', err);
        const fallback = messageContent || attachmentUrl;
        await bot.createMessage(msg.channel.id, fallback);
      }
    } else {
      await bot.createMessage(msg.channel.id, messageContent);
    }
  }

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
});

module.exports = bot;
