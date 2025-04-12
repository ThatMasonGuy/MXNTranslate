// bot/index.js
require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const handleReactionAdd = require("./handlers/reactionAdd");
const commands = require("./commands");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("raw", async (event) => {
  // Catch edge cases if needed later
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  handleReactionAdd(reaction, user);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const category = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);
  const key = sub ? `${category}.${sub}` : `${category}`;

  const command = commands.get(key);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error("❌ Command failed:", err);
    await interaction.reply({ content: "Something broke!", flags: 64 });
  }
});

client.login(process.env.DISCORD_TOKEN);
