// index.js (Fixed subcommand group routing)
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
const AutoTranslateHandler = require('./handlers/autoTranslateHandler');
const UserEventHandler = require('./handlers/userEventHandler');
const ServerEventHandler = require('./handlers/serverEventHandler');
const handleGuildCreate = require('./handlers/guildCreate');
const handleChannelCreate = require('./handlers/channelCreate');
const handleThreadCreate = require('./handlers/threadCreate');

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
    GatewayIntentBits.GuildVoiceStates,  // For voice event tracking
    GatewayIntentBits.GuildEmojisAndStickers,  // For emoji/sticker events
    GatewayIntentBits.GuildInvites,  // For invite tracking
    GatewayIntentBits.GuildWebhooks,  // For webhook events
    GatewayIntentBits.GuildModeration,  // For ban events
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
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
const autoTranslateHandler = new AutoTranslateHandler(storageService, translationService, client);
const userEventHandler = new UserEventHandler(storageService, config);
const serverEventHandler = new ServerEventHandler(storageService, config);

// Initialize reaction role configs map
client.reactionRoleConfigs = new Map();

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Features enabled: Storage=${config.storage.enabled}, Translation=${config.translation.enabled}`);
  console.log(`[DEBUG] GuildMembers intent active: ${client.options.intents.has(GatewayIntentBits.GuildMembers)}`);

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
  await autoTranslateHandler.handleMessage(msg);
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

client.on("guildCreate", async (guild) => {
  await handleGuildCreate(guild, client);
});

client.on("channelCreate", async (channel) => {
  await handleChannelCreate(channel, client);
  await serverEventHandler.handleChannelCreate(channel);
});

client.on("threadCreate", async (thread) => {
  await handleThreadCreate(thread, client);
});

// ============================================================
// USER EVENT TRACKING
// ============================================================

// Debug: Log raw Discord events for member updates
client.on('raw', (packet) => {
  if (packet.t === 'GUILD_MEMBER_UPDATE') {
    console.log('[RAW DEBUG] Discord sent GUILD_MEMBER_UPDATE:', packet.d.user?.username);
  }
});

// Member events
client.on("guildMemberAdd", async (member) => {
  await userEventHandler.handleMemberAdd(member);
});

client.on("guildMemberRemove", async (member) => {
  await userEventHandler.handleMemberRemove(member);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  await userEventHandler.handleMemberUpdate(oldMember, newMember);
});

// Voice state events
client.on("voiceStateUpdate", async (oldState, newState) => {
  await userEventHandler.handleVoiceStateUpdate(oldState, newState);
});

// Ban events
client.on("guildBanAdd", async (ban) => {
  await userEventHandler.handleBanAdd(ban);
});

client.on("guildBanRemove", async (ban) => {
  await userEventHandler.handleBanRemove(ban);
});

// ============================================================
// SERVER EVENT TRACKING
// ============================================================

// Role events
client.on("roleCreate", async (role) => {
  await serverEventHandler.handleRoleCreate(role);
});

client.on("roleUpdate", async (oldRole, newRole) => {
  await serverEventHandler.handleRoleUpdate(oldRole, newRole);
});

client.on("roleDelete", async (role) => {
  await serverEventHandler.handleRoleDelete(role);
});

// Channel events (note: channelCreate and channelUpdate are handled by existing handlers)
client.on("channelUpdate", async (oldChannel, newChannel) => {
  await serverEventHandler.handleChannelUpdate(oldChannel, newChannel);
});

client.on("channelDelete", async (channel) => {
  await serverEventHandler.handleChannelDelete(channel);
});

// Emoji events
client.on("emojiCreate", async (emoji) => {
  await serverEventHandler.handleEmojiCreate(emoji);
});

client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
  await serverEventHandler.handleEmojiUpdate(oldEmoji, newEmoji);
});

client.on("emojiDelete", async (emoji) => {
  await serverEventHandler.handleEmojiDelete(emoji);
});

// Sticker events
client.on("stickerCreate", async (sticker) => {
  await serverEventHandler.handleStickerCreate(sticker);
});

client.on("stickerUpdate", async (oldSticker, newSticker) => {
  await serverEventHandler.handleStickerUpdate(oldSticker, newSticker);
});

client.on("stickerDelete", async (sticker) => {
  await serverEventHandler.handleStickerDelete(sticker);
});

// Guild update events
client.on("guildUpdate", async (oldGuild, newGuild) => {
  await serverEventHandler.handleGuildUpdate(oldGuild, newGuild);
});

// Invite events
client.on("inviteCreate", async (invite) => {
  await serverEventHandler.handleInviteCreate(invite);
});

client.on("inviteDelete", async (invite) => {
  await serverEventHandler.handleInviteDelete(invite);
});

// Webhook events
client.on("webhookUpdate", async (channel) => {
  // Note: webhookUpdate only gives us the channel, not the webhook details
  // For complete webhook tracking, we'd need to fetch and compare webhooks
  console.log(`[SERVER EVENT] Webhook updated in channel: ${channel.name}`);
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
      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand(false);
      
      // FIXED: If there's a subcommand group (like 'config' or 'auto'),
      // route to the main command and let it handle the group internally.
      // Otherwise, use the old logic for regular subcommands.
      const key = subcommandGroup ? category : (sub ? `${category}.${sub}` : category);

      const command = commands.get(key);
      if (!command) {
        console.error(`Command not found: ${key}`);
        return;
      }

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

module.exports = { storageService, translationService, autoTranslateHandler };