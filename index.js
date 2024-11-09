#!/usr/bin/node

const axios = require('axios');
const discord = require('discord.js');
const fs = require('fs');

try {
  require('dotenv').config();
} catch {
  // Assume environment variables are set in the environment
}

const missingEnvWarning = (key) => console.error(`Missing ${key} variable. Please set it in your .env file or as an environment variable.`);
const m = 'Please set it in your .env file or as an environment variable.';
const noop = () => {}; // Used where error handling is not needed

// Check for required environment variables
['API_KEY', 'DISCORD_TOKEN', 'MODEL'].forEach((key) => {
  if (!process.env[key]) {
    missingEnvWarning(key);
    process.exit(1);
  }
});

// Set MAX_TOKENS to default if missing or invalid
process.env.MAX_TOKENS = Number(process.env.MAX_TOKENS) || 1024;

// Chat completion API call
async function chatCompletion(model, messages, tools) {
  try {
    const response = await axios.post('https://api.deepinfra.com/v1/openai/chat/completions', {
      model,
      messages,
      tools,
      temperature: 0.0,
      max_tokens: process.env.MAX_TOKENS,
      stream: false,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data.choices[0].message;
  } catch (error) {
    throw error;
  }
}

const client = new discord.Client({
  intents: [
    discord.GatewayIntentBits.Guilds,
    discord.GatewayIntentBits.GuildMessages,
    discord.GatewayIntentBits.GuildMessageReactions,
    discord.GatewayIntentBits.GuildMembers,
    discord.GatewayIntentBits.GuildMessageTyping,
    discord.GatewayIntentBits.DirectMessages,
    discord.GatewayIntentBits.DirectMessageReactions,
    discord.GatewayIntentBits.DirectMessageTyping,
    discord.GatewayIntentBits.MessageContent
  ]
});

function isBlacklisted(id) {
  if (!fs.existsSync('blacklist.json')) return false;
  try {
    const blacklist = JSON.parse(fs.readFileSync('blacklist.json').toString());
    return blacklist.includes(id);
  } catch (error) {
    console.warn('Invalid JSON in blacklist.json!', error.message);
    return false;
  }
}

// Function to replace IDs with tags/names
const replaceIdsWithTags = (str, cache, symbol) => {
  cache.forEach((item) => {
    str = str.replaceAll(`${symbol}${item.id}`, `${symbol}${item.name || item.tag}`);
  });
  return str;
};

client.on('messageCreate', async (msg) => {
  if (msg.author.id === client.user.id || msg.author.bot || !msg.mentions.users.has(client.user.id)) return;

  if (isBlacklisted(msg.author.id) || isBlacklisted(msg.channel.id) || isBlacklisted(msg.guild.id)) {
    if (fs.existsSync('Weezer - Buddy Holly.mp3')) {
      await msg.reply({ files: ['./Weezer - Buddy Holly.mp3'] }).catch(noop);
    }
    return;
  }

  try {
    await msg.channel.sendTyping();
  } catch {
    return;
  }

  const typer = setInterval(() => msg.channel.sendTyping(), 5000);

  let channelMessages;
  try {
    channelMessages = await msg.channel.messages.fetch({ limit: 100 });
  } catch {
    clearInterval(typer);
    return;
  }

  const messages = [{
    role: 'system',
    content: `- You are an AI assistant, based on the "${process.env.MODEL}" model, named ${client.user.tag}.
    - You are in the "${msg.channel.name}" channel (<#${msg.channel.id}>) of the "${msg.guild.name}" Discord server.
    - UTC time: ${new Date().toISOString()} (UNIX: ${Math.floor(Date.now() / 1000)}).
    - Use informal language with all-lowercase and only 1-2 sentences.
    - Avoid "UwU" or "OwO", using ":3" instead.
    - Engage in role-playing actions only when requested.
    - Available emojis: ${JSON.stringify(msg.guild.emojis.cache.map((emoji) => `<:${emoji.name}:${emoji.id}>`))}.`,
  }];

  for (let [, message] of channelMessages.reverse()) {
    if (message.author.id == client.user.id) {
      messages.push({ role: 'assistant', content: message.content });
    } else {
      let content = `${new Date().toISOString()}\n<@${message.author.tag}>`;
      if (message.author.nickname) content += ` (${message.author.nickname})`;
      if (message.author.bot) content += ' (BOT)';
      if (message.editedTimestamp) content += ' (edited)';
      if (message.type === 'REPLY') content += ` (replying to <@${message.reference.messageId || 'unknown'}>)`;
      content += `:\n${message.content}`;

      content = replaceIdsWithTags(content, client.users.cache, '<@');
      content = replaceIdsWithTags(content, client.channels.cache, '<#');
      content = replaceIdsWithTags(content, message.guild.roles.cache, '<@&');

      if (message.attachments.size > 0) {
        content += '\n\nAttachments: ' + JSON.stringify(Array.from(message.attachments.values()));
      }

      messages.push({ role: 'user', content });
    }
  }

  clearInterval(typer);

  const reply = { content: '', files: [] };

  try {
    const response = await chatCompletion(process.env.MODEL, messages);
    reply.content = response.content;

    // Replace IDs in the reply content
    reply.content = replaceIdsWithTags(reply.content, client.users.cache, '<@');
    reply.content = replaceIdsWithTags(reply.content, client.channels.cache, '<#');
    reply.content = replaceIdsWithTags(reply.content, msg.guild.roles.cache, '<@&');
  } catch (error) {
    reply.content = `⚠️ ${error.message}`;
    reply.files.push(new discord.AttachmentBuilder(Buffer.from(JSON.stringify(error.response?.data || error.stack, null, 4)), { name: 'error.json' }));
  }

  if (reply.content.length > 2000) {
    reply.files.push(new discord.AttachmentBuilder(Buffer.from(reply.content), { name: 'message.txt' }));
    reply.content = reply.content.slice(0, 2000);
  }

  await msg.reply(reply).catch(async () => msg.channel.send(reply).catch(noop));
});

client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
  console.log('Ready on', client.user.tag);
});
