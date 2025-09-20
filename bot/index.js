// index.js (Updated to include reaction protection)
require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const config = require('./config/features');
const db = require('./db');

// Services
const StorageService = require('./services/storage');
const TranslationService = require('./services/translation');

// Handlers
const MessageHandler = require('./handlers/messageHandler');
const ReactionHandler = require('./handlers/reactionHandler');
const ReactionRoleHandler = require('./handlers/reactionRoleHandler');
const ReactionProtectionHandler = require('./handlers/reactionProtectionHandler');
const InteractionHandler = require('./handlers/interactionHandler');

// Commands and utilities
const commands = require("./commands");
const syncBackfill = require('./utils/syncBackfill');

console.log("Loaded token:", process.env.DISCORD_TOKEN);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Initialize services
const storageService = new StorageService(db, config);
const translationService = new TranslationService(config);

// Initialize handlers
const messageHandler = new MessageHandler(storageService, config);
const reactionHandler = new ReactionHandler(storageService, translationService, config);
const reactionRoleHandler = new ReactionRoleHandler(storageService, client);
const reactionProtectionHandler = new ReactionProtectionHandler(storageService, client);
const interactionHandler = new InteractionHandler(storageService);

// Initialize reaction role configs map
client.reactionRoleConfigs = new Map();

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Features enabled: Storage=${config.storage.enabled}, Translation=${config.translation.enabled}`);

  // Load reaction role protection data
  await reactionProtectionHandler.loadProtectionData();

  if (config.storage.enabled && config.storage.backfillOnStartup) {
    console.log("Starting backfill...");
    await syncBackfill(client);
    console.log("Startup backfill complete. Bot is fully ready.");
  } else {
    console.log("Bot is ready (backfill skipped).");
  }
});

// Message events
client.on("messageCreate", async (msg) => {
  await messageHandler.handleCreate(msg);
});

client.on("messageUpdate", async (oldMsg, newMsg) => {
  await messageHandler.handleUpdate(oldMsg, newMsg);
});

client.on("messageDelete", async (msg) => {
  await messageHandler.handleDelete(msg);
});

// Reaction events (handles translation, reaction roles, AND protection)
client.on("messageReactionAdd", async (reaction, user) => {
  // Handle translation reactions
  await reactionHandler.handleAdd(reaction, user);
  
  // Handle reaction role reactions
  await reactionRoleHandler.handleReactionAdd(reaction, user);
  
  // Handle unauthorized reaction removal
  await reactionProtectionHandler.handleUnauthorizedReaction(reaction, user);
});

client.on("messageReactionRemove", async (reaction, user) => {
  // Handle translation reaction removal
  await reactionHandler.handleRemove(reaction, user);
  
  // Handle reaction role removal
  await reactionRoleHandler.handleReactionRemove(reaction, user);
});

// Interaction handling (slash commands, buttons, modals, select menus)
client.on("interactionCreate", async (interaction) => {
  try {
    // Handle button/modal/select menu interactions first
    const handledByInteractionHandler = await interactionHandler.handleInteraction(interaction);
    if (handledByInteractionHandler) return;

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const category = interaction.commandName;
      const sub = interaction.options.getSubcommand(false);
      const key = sub ? `${category}.${sub}` : `${category}`;

      const command = commands.get(key);
      if (!command) return;

      await command.execute(interaction);
    }
  } catch (err) {
    console.error("Command failed:", err);
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Something broke!", flags: 64 });
      }
    } catch (replyError) {
      console.error("Failed to send error response:", replyError);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

module.exports = { storageService, translationService };
