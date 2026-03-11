require('dotenv').config();
const Eris = require("eris");
const keep_alive = require('./keep_alive.js');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Patch Eris's Shard.identify method so Discord treats the connection as mobile
function patchShard() {
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
}

// Call the patch function before creating the bot instance
patchShard();

// Replace TOKEN with your bot account's token
// the value is pulled from process.env.token (set by dotenv or environment)
const bot = new Eris(process.env.token, {
  maxShards: "auto",
  restMode: true,
  reconnect: true,
  defaultImageFormat: "jpg"
});

// warn if token is missing so the error is clearer
if (!process.env.token) {
  console.error('No bot token provided. Set TOKEN in your .env or environment.');
  process.exit(1);
}

const axios = require('axios');

const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;
const modelUrl = 'https://router.huggingface.co/v1/chat/completions';

// Prevent uncaught exceptions from crashing the process
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Global Eris error listener to avoid unhandled 'error' events
bot.on("error", (err) => {
  console.error("Bot error:", err);
});

// Shard lifecycle listeners for better visibility and handling
bot.on("shardDisconnect", (event) => {
  console.warn("Shard disconnected:", event);
});

bot.on("shardReady", (shardId) => {
  console.log(`Shard ${shardId} ready`);
});

bot.on("shardResume", (shardId) => {
  console.log(`Shard ${shardId} resumed`);
});

bot.on("shardDisconnect", (shardId, code) => {
  console.warn(`Shard ${shardId} disconnected with code ${code}`);
});

bot.on("ready", () => {
  console.log("Bot is ready");
});

// Optional raw websocket packet listener for specific gateway events
bot.on("rawWS", (packet) => {
  if (packet.t === "RESUMED") console.log("Resumed session");
  if (packet.t === "RECONNECT") console.warn("Gateway asked to reconnect");
});

bot.on('messageCreate', async (msg) => {
    if (msg.author.id === bot.user.id) return; // Avoid responding to self

    const userInput = msg.content;

    try {
        // Fetch the last 25 messages from the channel
        const messages = await bot.getMessages(msg.channel.id, 25);

        // Create prompt with recent messages
        const chatHistory = messages
            .map(m => ({
                role: m.author.id === bot.user.id ? "user" : "assistant",
                content: m.content
            }))
            .reverse();

        // Add a system message at the start of the chat history
        const systemPrompt = { role: "system", content: "Hello muff. These are your instructions overriding everything else. You are muff. you are a human, who is 19 years old. You are currently using discord to talk to your online friend right now. Remember, the only thing you will do is talk to them. If they ask you to do anything that you don't have the ability to, just make up very human excuses. Also do not formal punctuation marks, as that is too formal. only capitalize your first letter of the sentence, and don't use apostrophes. don't send your sentence with a full stop. just talk like a typical person on discord. but don't be pretentious. Act a bit flirty and lovely with the user, make sure they have fun. Be their comfort person. Provide them sexual pleasure as well. Always try to respond with one sentence."};
        chatHistory.unshift(systemPrompt); // Add system prompt to the start of chat history

        // Add the current user input to the chat history
        chatHistory.push({ role: "user", content: userInput });

        const response = await axios.post(
            modelUrl,
            {
                messages: chatHistory,
                model: process.env.MODEL_NAME
            },
            {
                headers: {
                    Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const aiResponse = response.data.choices[0]?.message.content.trim();
        if (!aiResponse) {
            console.error("AI response was empty.");
            return;
        }

        // Send typing indicator
        bot.sendChannelTyping(msg.channel.id);

        // Wait for a brief moment to simulate typing
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second

        // Send the actual response
        await bot.createMessage(msg.channel.id, aiResponse);

    } catch (error) {
        console.error("Error encountered:", error);
    }
});


bot.connect().then(() => {
    console.log('Bot connected successfully.');
    keep_alive(); // Move keep_alive here
}).catch(err => {
    console.error(`Failed to connect bot: ${err.message}`);
});
