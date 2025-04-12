// registerSlashCommands.js
const { REST, Routes } = require("discord.js");
require("dotenv").config();
const commandMap = require("./bot/commands");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Convert commandMap to Discord-compatible format
const slashCommands = [];

for (const [key, command] of commandMap.entries()) {
  const [category, sub] = key.split(".");
  let existing = slashCommands.find((c) => c.name === category);

  if (!existing) {
    existing = {
      name: category,
      description: "Commands related to " + category,
      options: [],
    };
    slashCommands.push(existing);
  }

  existing.options.push(command.data.toJSON());
}

(async () => {
  try {
    console.log("🔧 Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: slashCommands,
    });
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
})();
