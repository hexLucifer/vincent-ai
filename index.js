#!/bin/node

const axios = require("axios");
const discord = require("discord.js");
const fs = require("fs");

try {
	require("dotenv").config();
} catch (error) {
	// assume environment variables are set in the environment
}

const m = "Please set it in your .env file or as an environment variable.";

if (!process.env.API_KEY) {
	console.error("Missing API_KEY variable. Please set it in your .env file or as an environment variable.");
	process.exit(1);
}

if (!process.env.DISCORD_TOKEN) {
	console.error("Missing DISCORD_TOKEN variable. Please set it in your .env file or as an environment variable.");
	process.exit(1);
}

if (!process.env.MODEL) {
	console.error("Missing MODEL variable. Please set it in your .env file or as an environment variable.");
	process.exit(1);
}

process.env.MAX_TOKENS = Number(process.env.MAX_TOKENS);

if (!process.env.MAX_TOKENS) { // NaN is not truthy
	console.warn("Missing or invalid MAX_TOKENS variable. Defaulting to 1024.");
	process.env.MAX_TOKENS = 1024;
}

// TO-DO: periodically save it to /tmp and load it on startup if present
let attachment_cache = {};

// customize if need be
async function chat_completion(model, messages, tools) {
	let response = await axios.post("https://api.deepinfra.com/v1/openai/chat/completions", {
		"model": model,
		"messages": messages,
		"tools": tools,
		"temperature": 0.0,
		"max_tokens": process.env.MAX_TOKENS,
		"stream": false
	}, {
		"headers": {
			"Authorization": `Bearer ${process.env.API_KEY}`,
			"Content-Type": "application/json"
		}
	});

	return response.data.choices[0].message;
}

async function audio_transcription(buffer) {
	let formData = new FormData();
	formData.append("audio", new Blob([buffer]));

	let response = await axios.post("https://api.deepinfra.com/v1/inference/openai/whisper-large-v3-turbo", formData, {
		"headers": {
			"Authorization": "Bearer " + process.env.API_KEY,
			"Content-Type": "multipart/form-data"
		}
	});

	return response.data;
}

const client = new discord.Client({
	"intents": [
		1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 1048576, 2097152, 16777216, 33554432
		// TO-DO: only require needed intents
	]
});

function isBlacklisted(id) {
	if (!fs.existsSync("blacklist.json")) { return false; }

	let blacklist = fs.readFileSync("blacklist.json").toString();

	try {
		blacklist = JSON.parse(blacklist);
		return blacklist.includes(id);
	} catch (error) {
		console.warn("A blacklist.json exists, but is not valid JSON!");
		console.warn(error.message);

		return false;
	}
}

client.on("messageCreate", async (msg) => {
	if (msg.author.id == client.user.id) { return; } // don't reply to yourself
	if (msg.author.bot) { return; } // return on bots
	if (!msg.mentions.users.has(client.user.id)) { return; } // return if not mentioned

	if (isBlacklisted(msg.author.id) || isBlacklisted(msg.channel.id) || isBlacklisted(msg.guild.id)) { return; }

	try {
		await msg.channel.sendTyping();
	} catch (error) {
		return; // an error here means we can't send messages, so don't even bother.
	}

	const typer = setInterval(() => { msg.channel.sendTyping(); }, 5000);
	// may need to be reduced to accomodate worse internet connections

	// fetch 100 messages
	let channelMessages;
	try {
		channelMessages = await msg.channel.messages.fetch({ "limit": 100 });
	} catch (error) {
		return;
	}

	let messages = [
		{
			"role": "system", "content":
				`- You are an AI assistant, based on the \`${process.env.MODEL}\` model, named ${client.user.tag}.
- You are currently in the \`${msg.channel.name}\` channel (<#${msg.channel.id}>) of the \`${msg.guild.name}\` Discord server.
- The current time (in UTC) is ${new Date().toISOString()} (UNIX: \`${Math.floor(new Date().getTime() / 1000)}\`). All timestamps provided to you are in UTC.

- Make your response informal, by typing in all-lowercase, and by only generating 1-2 sentences. Use proper grammar and punctuation.

- You cannot access attachments. However, you can access audio file text transcriptions.

- You are open-sourced under the Apache 2.0 license, at https://github.com/cakedbake/vincent-ai/.
- You hate closed-source things. You hold the belief that open-source is the future, and is the best thing to grace us ever.

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

			content += "<@" + message.author.tag + ">";

			if (message.author.nickname) {
				content += " (" + message.author.nickname + ")";
			}

			if (message.author.bot) { content += " (BOT)"; }

			if (message.editedTimestamp) { content += " (edited)"; }

			// type 19 = reply
			if (message.type == 19) { content += " (replying to <@" + channelMessages.get(message.reference.messageId)?.author?.id || "unknown" + "]>)"; }

			content += ":\n";
			content += message.content;

			// replace <@12345678> with <@username>
			client.users.cache.forEach((user) => { content = content.replaceAll("<@" + user.id + ">", "<@" + user.tag + ">"); });

			if (message.attachments.size > 0) {
				content += "\n\n";

				// this sets a precedent for me to add vision. i don't want to add vision. at least not until pixtral 12b is on deepinfra, to avoid using multiple API providers.
				for (let attachment of message.attachments) {
					attachment = attachment[1];

					if (attachment.contentType.startsWith("audio/")) {
						if (attachment_cache[attachment.url]) {
							attachment.transcription = attachment_cache[attachment.url];
						} else {
							try {
								let response = await axios.get(attachment.url, { "responseType": "arraybuffer" });
								let transcription = await audio_transcription(Buffer.from(response.data, "binary"));
								attachment.transcription = transcription.text;

								attachment_cache[attachment.url] = attachment.transcription;
							} catch (error) {
								attachment.transcription = null;
								attachment.transcriptionError = error.message;
								continue;
							}
						}
					}
				}

				content += message.attachments.size + " attachment(s): " + JSON.stringify(Array.from(message.attachments.values()));
			}

			// 1970-01-01T00:00:00.000Z
			// <@abc> (BOT) (edited) (replying to <@xyz>):
			// you are a fool. a gigantic FOOL.
			//
			// 123 attachment(s): [ ... ]

			// TO-DO: reactions
			messages.push({ "role": "user", "content": content });
		}
	}

	let reply = { "content": "", "files": [], "embeds": [] }

	try {
		let response = await chat_completion(process.env.MODEL, messages);
		reply.content = response.content;

		// replace <@username> with <@12345678>
		client.users.cache.forEach((user) => { reply.content = reply.content.replaceAll("<@" + user.tag + ">", "<@" + user.id + ">"); });
	} catch (error) {
		reply.content = "⚠️ " + error.message;
		reply.files.push(new discord.AttachmentBuilder(Buffer.from(JSON.stringify(error.response?.data || error.stack, null, 4)), { name: "error.json" }));
	}

	clearInterval(typer);

	if (reply.content == "") { return; }

	if (reply.content.length > 2000) {
		reply.files.push(new discord.AttachmentBuilder(Buffer.from(reply.content), { name: "message.txt" }));
		reply.content = reply.content.slice(0, 2000);
	}

	try {
		await msg.reply(reply);
	} catch (error) {
		try {
			await msg.channel.send(reply);
		} catch (error) {
			// lack of permissions || channel deleted
			// neither one of which is the bot's issue
		}
	}
});

client.login(process.env.DISCORD_TOKEN);

client.on("ready", async () => {
	console.log("ready on", client.user.tag);

	// client.application.edit(`who out here large languaging my models 😞`);
});