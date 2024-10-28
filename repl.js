const fs = require("fs"); const discord = require("discord.js"); if (fs.existsSync(".env")) { try { require("dotenv").config(); } catch (error) { } } const client = new discord.Client({ "intents": [ 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 1048576, 2097152, 16777216, 33554432 ] }); client.login(process.env.DISCORD_TOKEN); client.on("ready", async () => { console.log("ready on", client.user.tag); });
// how to use: run node from your terminal of choice and punch in:
// .load repl.js
// this is a one-liner to avoid clogging your node REPL's history