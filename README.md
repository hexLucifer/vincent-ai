# DeepInfra-based Discord AI chatbot

## How to run
### Prerequisites: Node.js version 18 or higher.
1. Clone this repository like this:
```bash
git clone https://github.com/cakedbake/vincent-ai.git
```
2. `cd` into the repository:
```bash
cd vincent-ai
```
3. Install the dependencies:
```bash
npm install
```
4. Run it:
```bash
node index.js
```

## Needed environment variables:
- `DISCORD_TOKEN`: Discord bot token.
- `API_KEY`: your DeepInfra API key.
- `MODEL`: model used to generate responses.

## Optional environment variables:
- `MAX_TOKENS`: maximum amount of tokens to generate.

## Blacklisting
- You can blacklist a user, a channel, or a guild by adding its ID to the `blacklist.json` file, like this:
```json
[
	"123456789012345678",
	"123456789012345678",
	...
]
```
- The bot will completely ignore blacklisted entities.
- Note: You need to enable Developer Mode in your Discord client to be able to copy the IDs:
1. Go into User Settings by clicking the cog next to your profile.
2. Go into App Settings > Advanced and enable Developer Mode.

## Plans:
- Add tool usage, Memory
- Custom system prompts
- Custom provider support
- Web searching (with Google)
- Vision will be added when DeepInfra supports Pixtral 12B.

## A rant on Llama 3.2 Vision
1.  Llama 3.2 Vision is hot garbage!
2. It keeps refusing to describe perfectly safe images!
3. It either makes shit up or describes the image badly!
4. ONLY ONE IMAGE PER YOUR 128K TOKENS OF CONTEXT!!! PIXTRAL 12B HAS 128K OF CONTEXT AND YOU CAN SHOVE IT ***FULL*** OF IMAGES!!!
5. AND PIXTRAL ***12B*** BEATS LLAMA 3.2 ***90B*** AT THE TASK THE LLAMA WAS MADE FOR!!!