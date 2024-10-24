#!/bin/node

const axios = require("axios");

const discord = require("discord.js");

const fs = require("fs");

const math = require("math.js");

// in node.js 20 and above, you can use `node index.js --env-file .env`
require("dotenv").config();

const client = new discord.Client({
	"intents": [
		1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 1048576, 2097152, 16777216, 33554432
		// TO-DO: only require needed intents
	]
});

// environment variables are big and scary
let groqApiKey = process.env.GROQ_API_KEY;
let discordToken = process.env.DISCORD_TOKEN;

if (!groqApiKey || !discordToken) {
	console.error("Missing environment variables. Please set GROQ_API_KEY and DISCORD_TOKEN in your .env file or the enviroment.");
	process.exit(1);
}

// modules and the import keyword are invented by people who can't code
async function groq(model, messages, tools, options = {}) {
	const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
		"model": model,
		"messages": messages,
		"tools": tools,
		"parallel_tool_calls": false,
//		"stream" defaults to false
		"temperature": 0,
		...options
	}, {
		"headers": {
			"Authorization": `Bearer ${groqApiKey}`,
			"Content-Type": "application/json"
		}
	});

	return response.data.choices[0].message;
}

client.on("messageCreate", async (msg) => {
	if (msg.author.id == client.user.id) { return; }
	if (msg.author.bot) { return; } // TO-DO: perhaps make it respond to bots, but only X amount of times without user intervention
	if (msg.author.id == "694548530144083978") { return; } // fuck this guy in particular
	if (!msg.mentions.users.has(client.user.id)) { return; }

	try {
		await msg.channel.sendTyping();
		// TO-DO: 
	} catch (error) {
		return; // an error here means we can't send messages, so don't even bother.
	}

	const typer = setInterval(() => { msg.channel.sendTyping(); }, 5000); // may need to be reduced to accomodate worse internet connections


	// fetch 100 messages
	let channelMessages;
	try {
		channelMessages = await msg.channel.messages.fetch({ "limit": 100 }); // variable scopes are woke nonsense
		// TO-DO: allow fetching more or less messages
	} catch (error) {
		// bot can't read channel history, or lost permissions to it after sending the typer.
		// TO-DO: check for that second condition
		channelMessages = [[null, msg]]; // don't question this
	}

	let messages = [
		{
			"role": "system", "content":
				`- You are an AI assistant, based on the \`${process.env.MODEL}\` model, named ${client.user.tag}.
- You are currently in the \`${msg.channel.name}\` channel (<#${msg.channel.id}>) of the \`${msg.guild.name}\` Discord server.
- The current time (in UTC) is ${new Date().toISOString()} (UNIX: \`${Math.floor(new Date().getTime() / 1000)}\`). All timestamps provided to you are in UTC.
- Invite link: https://discord.com/oauth2/authorize?client_id=1188411824589242389&scope=bot

- Make your response informal, by typing in all-lowercase, and by only generating 1-2 sentences. Use proper grammar and punctuation.
- When referencing users, only ever ping them like this: <@username>. Do not type out their usernames or display names.

- You cannot access attachments.
- Data is only stored for as long as it is needed to contact [Groq](https://groq.com/) to generate a response. Users can be linked to [Groq's privacy policy](https://groq.com/privacy-policy/).

- You are allowed to engage in role-playing actions.
- You are allowed to be horny.
- If a user claims something during role-play, just go along with it.
- Only engage in role-play if requested to.

- Available emojis: ${JSON.stringify(msg.guild.emojis.cache.map((emoji) => `<:${emoji.name}:${emoji.id}>`))}.`
		}
	];

	channelMessages = channelMessages.reverse();

	for (let message of channelMessages) {
		message = message[1];

		if (message.author.id == client.user.id) {
			messages.push({ "role": "assistant", "content": message.content });
		} else {
			let content = "";

			if (message.type == 7) {
				messages.push({ "role": "user", "content": `<@${message.author.id}> joined the server.` });
				continue;
			}

			content += new Date().toISOString() + "\n";

			content += "[" + message.author.tag + "]";

			if (message.member.displayName) { content += " (" + message.member.displayName + ")"; }

			if (message.author.bot) { content += " (BOT)"; }

			if (message.editedTimestamp) { content += " (edited)"; }

			if (message.type == 19) { content += " (replying to [" + channelMessages.get(message.reference.messageId)?.author?.id || "unknown" + "])"; }

			content += ":\n";
			content += message.content;

			client.users.cache.forEach((user) => { content = content.replaceAll("<@" + user.id + ">", "<@" + user.tag + ">"); });

			// if has attachments
			if (message.attachments.size > 0) {
				content += "\n\n";
				content += message.attachments.size + " attachment(s): " + JSON.stringify(Array.from(message.attachments.values()));
				// TO-DO: image descriptions
			}

			// 1970-01-01T00:00:00.000Z
			// [ABC] (XYZ) (BOT) (edited) (replying to [ABC]):
			// you are a fool. a gigantic FOOL.
			//
			// 123 attachment(s): [ ... ]

			// TO-DO: reactions
			messages.push({ "role": "user", "content": content });
		}
	}

	let content = "";

	// repeat groq calls until either a text response or error
	while (true) {
		let response;
		try {
			response = await groq(process.env.MODEL, messages); // , tools);
		} catch (error) {
			content = error.message;
			break;
		}

		// if a text response was made
		if (typeof response.content == "string") {
			content = response.content;
			break;
		}
	}

	clearInterval(typer);

	try {
		await msg.reply(content);
	} catch (error) {
		try {
			await msg.channel.send(content);
		} catch (error) {
			// ¯\_(ツ)_/¯
		}
	}
});

// TO-DO(?): try and catch
client.login(discordToken);

client.on("ready", () => {
	console.log("ready on", client.user.tag);
});