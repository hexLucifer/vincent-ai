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
- `API_KEY`: your Groq API key.
- `MODEL`: model used to generate responses.

## Optional environment variables:
- `MAX_TOKENS`: maximum amount of tokens to generate.

## Plans:
- Add tool usage, Memory
- Custom system prompts
- Custom provider support
- Customizable blacklisting