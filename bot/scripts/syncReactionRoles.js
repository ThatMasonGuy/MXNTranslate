#!/usr/bin/env node
// bot/scripts/syncReactionRoles.js

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const Database = require("better-sqlite3");

const DB_PATH = "/home/mason/discord_data/discord_tracker.db";
const DRY_RUN = process.argv.includes("--dry-run");

if (DRY_RUN) console.log("🔍 DRY RUN MODE — no changes will be made\n");

const db = new Database(DB_PATH, { fileMustExist: true, timeout: 5000 });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Stats
const stats = {
  configsProcessed: 0,
  configsSkipped: 0,
  rolesAssigned: 0,
  rolesAlreadyPresent: 0,
  dbRecordsCreated: 0,
  dbRecordsExisted: 0,
  nicknamesSet: 0,
  errors: 0,
};

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📊 Processing reaction role sync...\n`);

  try {
    await syncAllReactionRoles();
  } catch (err) {
    console.error("❌ Fatal error during sync:", err);
  }

  console.log("\n========================================");
  console.log("📊 SYNC COMPLETE — Summary:");
  console.log("========================================");
  console.log(`  Configs processed:      ${stats.configsProcessed}`);
  console.log(`  Configs skipped:        ${stats.configsSkipped}`);
  console.log(`  Roles assigned:         ${stats.rolesAssigned}`);
  console.log(`  Roles already present:  ${stats.rolesAlreadyPresent}`);
  console.log(`  DB records created:     ${stats.dbRecordsCreated}`);
  console.log(`  DB records existed:     ${stats.dbRecordsExisted}`);
  console.log(`  Nicknames set:          ${stats.nicknamesSet}`);
  console.log(`  Errors:                 ${stats.errors}`);
  console.log("========================================\n");

  db.close();
  client.destroy();
  process.exit(0);
});

async function syncAllReactionRoles() {
  // Get all active configs that have been posted (have a message_id)
  const configs = db.prepare(`
    SELECT * FROM reaction_role_configs
    WHERE is_active = 1 AND message_id IS NOT NULL
  `).all();

  console.log(`Found ${configs.length} active reaction role config(s)\n`);

  for (const config of configs) {
    await processConfig(config);
  }
}

async function processConfig(config) {
  const label = `Config #${config.id} (guild=${config.guild_id}, msg=${config.message_id})`;
  console.log(`─── ${label} ───`);

  // Get mappings for this config
  const mappings = db.prepare(`
    SELECT * FROM reaction_role_mappings WHERE config_id = ?
  `).all(config.id);

  if (mappings.length === 0) {
    console.log(`  ⚠️  No mappings found, skipping`);
    stats.configsSkipped++;
    return;
  }

  // Fetch the guild
  const guild = client.guilds.cache.get(config.guild_id);
  if (!guild) {
    console.log(`  ⚠️  Guild ${config.guild_id} not accessible, skipping`);
    stats.configsSkipped++;
    return;
  }

  // Fetch the channel
  const channel = guild.channels.cache.get(config.channel_id);
  if (!channel) {
    console.log(`  ⚠️  Channel ${config.channel_id} not found, skipping`);
    stats.configsSkipped++;
    return;
  }

  // Fetch the message
  let message;
  try {
    message = await channel.messages.fetch(config.message_id);
  } catch (err) {
    console.log(`  ⚠️  Message ${config.message_id} not found (deleted?), skipping`);
    stats.configsSkipped++;
    return;
  }

  const botMember = guild.members.me;
  const isSingleRole = config.is_single_role === 1;
  console.log(`  Mode: ${isSingleRole ? "Single role" : "Multiple roles"}`);
  console.log(`  Mappings: ${mappings.length}`);

  // Build emoji->mapping lookup
  const emojiToMapping = new Map();
  for (const mapping of mappings) {
    const key = mapping.emoji_id || mapping.emoji_name;
    emojiToMapping.set(key, mapping);
  }

  // For single-role mode, we need to track per-user which role they should get
  // We'll collect all user->reactions first, then decide
  const userReactions = new Map(); // userId -> [{ mapping, reaction }]

  // Process each reaction on the message
  for (const [reactionKey, messageReaction] of message.reactions.cache) {
    // Match this reaction to a mapping
    const lookupKey = messageReaction.emoji.id || messageReaction.emoji.name;
    const mapping = emojiToMapping.get(lookupKey);

    if (!mapping) continue; // Not a configured reaction role emoji

    const role = guild.roles.cache.get(mapping.role_id);
    if (!role) {
      console.log(`  ⚠️  Role ${mapping.role_id} not found in guild, skipping emoji ${mapping.emoji_name}`);
      continue;
    }

    if (role.position >= botMember.roles.highest.position) {
      console.log(`  ⚠️  Role ${role.name} is above bot's highest role, skipping`);
      continue;
    }

    // Fetch all users who reacted with this emoji
    let users;
    try {
      users = await messageReaction.users.fetch();
    } catch (err) {
      console.log(`  ⚠️  Failed to fetch users for ${mapping.emoji_name}: ${err.message}`);
      stats.errors++;
      continue;
    }

    const nonBotUsers = users.filter((u) => !u.bot);
    console.log(`  ${mapping.emoji_name} → @${role.name}: ${nonBotUsers.size} user(s)`);

    for (const [userId] of nonBotUsers) {
      if (!userReactions.has(userId)) {
        userReactions.set(userId, []);
      }
      userReactions.set(userId, [
        ...userReactions.get(userId),
        { mapping, role, messageReaction },
      ]);
    }
  }

  // Now process each user
  for (const [userId, reactions] of userReactions) {
    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      // User may have left the server
      continue;
    }

    if (isSingleRole) {
      // In single-role mode, only process the FIRST reaction we encounter
      // (the one they currently have reacted). If they have multiple, we just
      // pick one — they can re-click to fix it later.
      const { mapping, role } = reactions[0];
      await assignRole(config, member, role, mapping, botMember);
    } else {
      // Multiple role mode — assign every role they've reacted for
      for (const { mapping, role } of reactions) {
        await assignRole(config, member, role, mapping, botMember);
      }
    }
  }

  stats.configsProcessed++;
  console.log();
}

async function assignRole(config, member, role, mapping, botMember) {
  const userId = member.id;
  const hasRole = member.roles.cache.has(role.id);

  // Assign the Discord role if missing
  if (!hasRole) {
    if (!DRY_RUN) {
      try {
        await member.roles.add(role);
        console.log(`    ✅ Assigned @${role.name} to ${member.user.username}`);
        stats.rolesAssigned++;
      } catch (err) {
        console.log(`    ❌ Failed to assign @${role.name} to ${member.user.username}: ${err.message}`);
        stats.errors++;
        return;
      }
    } else {
      console.log(`    [DRY] Would assign @${role.name} to ${member.user.username}`);
      stats.rolesAssigned++;
    }
  } else {
    stats.rolesAlreadyPresent++;
  }

  // Ensure DB assignment record exists
  const existing = db.prepare(`
    SELECT 1 FROM reaction_role_assignments
    WHERE config_id = ? AND user_id = ? AND role_id = ?
  `).get(config.id, userId, role.id);

  if (!existing) {
    if (!DRY_RUN) {
      db.prepare(`
        INSERT OR IGNORE INTO reaction_role_assignments (config_id, user_id, role_id)
        VALUES (?, ?, ?)
      `).run(config.id, userId, role.id);
    }
    console.log(`    📝 ${DRY_RUN ? "[DRY] Would create" : "Created"} DB assignment: ${member.user.username} → @${role.name}`);
    stats.dbRecordsCreated++;
  } else {
    stats.dbRecordsExisted++;
  }

  // Handle nickname prefix
  if (mapping.nickname_prefix && botMember.permissions.has("ManageNicknames")) {
    const currentNick = member.nickname || member.user.username;
    const prefixPattern = new RegExp(
      `^\\[${mapping.nickname_prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s*`
    );

    if (!prefixPattern.test(currentNick)) {
      const cleanNick = currentNick.replace(/^\[.*?\]\s*/, "");
      const newNick = `[${mapping.nickname_prefix}] ${cleanNick}`;

      if (newNick.length <= 32) {
        if (!DRY_RUN) {
          try {
            await member.setNickname(newNick);
            console.log(`    🏷️  Set nickname: "${newNick}" for ${member.user.username}`);
            stats.nicknamesSet++;
          } catch (err) {
            console.log(`    ⚠️  Failed to set nickname for ${member.user.username}: ${err.message}`);
          }
        } else {
          console.log(`    [DRY] Would set nickname: "${newNick}" for ${member.user.username}`);
          stats.nicknamesSet++;
        }
      }
    }
  }
}

client.login(process.env.DISCORD_TOKEN);