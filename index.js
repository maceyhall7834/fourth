const Eris = require("eris");
const keep_alive = require('./keep_alive.js');

// Replace TOKEN with your bot account's token
const bot = new Eris(process.env.token);

// Command prefixes
const prefix = '7';

// Event listener for messages
bot.on('messageCreate', async (msg) => {
  // Ignore messages from the bot itself
  if (msg.author.id === bot.user.id) return;

  // Handle the "7say" command
  if (msg.content.startsWith(`${prefix}say`)) {
    const messageContent = msg.content.slice(prefix.length + 4).trim();
    const attachment = msg.attachments.length > 0 ? msg.attachments[0].url : null;

    // Reply with the message and the attachment if present
    if (messageContent) {
      await bot.createMessage(msg.channel.id, messageContent, { file: attachment });
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

// Handle any connection errors
bot.on("error", (err) => {
  console.error(err); // or your preferred logger
});

// Connect the bot and keep it alive
bot.connect();
keep_alive();
