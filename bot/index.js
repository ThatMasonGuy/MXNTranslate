// bot/index.js
require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const commands = require("./commands");
const insertMessage = require('./handlers/messageCreate');
const logEdit = require('./handlers/messageUpdate');
const markDeleted = require('./handlers/messageDelete');
const handleReactionAdd = require('./handlers/reactionAdd');
const syncBackfill = require('./utils/syncBackfill');
// Only for DB/audit logging, not translation removal!
const handleReactionRemove = require('./handlers/reactionRemove');

console.log("Loaded token:", process.env.DISCORD_TOKEN);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once("ready", async () => {
  console.log(` ^|^e Logged in as ${client.user.tag}`);

  await syncBackfill(client);

  console.log("Startup backfil complete. Bot is fully ready.")
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  try {
    insertMessage(msg);
  } catch (err) {
    console.error("Failed to log message:", err);
  }
});

// Edits: log old/new content, keep history
client.on("messageUpdate", (oldMsg, newMsg) => {
  // oldMsg may be partial; you might want to add .fetch() logic if needed
  logEdit(oldMsg, newMsg);
});

// Deletes: mark as deleted in DB, don't erase
client.on("messageDelete", (msg) => {
  markDeleted(msg);
});

// Reaction add: do translation AND DB logging
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  await handleReactionAdd(reaction, user);
});

// Reaction remove: only for audit/logging, not translation
client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;
  if (handleReactionRemove) await handleReactionRemove(reaction, user);
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
    console.error(" ^}^l Command failed:", err);
    await interaction.reply({ content: "Something broke!", flags: 64 });
  }
});

client.login(process.env.DISCORD_TOKEN);
