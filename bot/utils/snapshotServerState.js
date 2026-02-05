// utils/snapshotServerState.js
// Captures the current state of all servers (roles, channels, members, emojis, etc.)

async function snapshotServerState(client, storageService) {
  console.log('\n' + '='.repeat(70));
  console.log('📸 SERVER STATE SNAPSHOT - Capturing current configuration');
  console.log('='.repeat(70));

  const guilds = client.guilds.cache;
  console.log(`Processing ${guilds.size} guilds...\n`);

  let totalStats = {
    guilds: 0,
    roles: 0,
    channels: 0,
    members: 0,
    emojis: 0,
    stickers: 0
  };

  for (const [guildId, guild] of guilds) {
    try {
      console.log(`📋 ${guild.name}`);
      console.log('─'.repeat(70));

      const guildStats = await snapshotGuild(guild, storageService);
      
      // Add to totals
      totalStats.guilds++;
      totalStats.roles += guildStats.roles;
      totalStats.channels += guildStats.channels;
      totalStats.members += guildStats.members;
      totalStats.emojis += guildStats.emojis;
      totalStats.stickers += guildStats.stickers;

      console.log(`  ✓ Roles: ${guildStats.roles}, Channels: ${guildStats.channels}, Members: ${guildStats.members}`);
      console.log('');
    } catch (error) {
      console.error(`  ✗ Error snapshotting ${guild.name}:`, error.message);
    }
  }

  console.log('='.repeat(70));
  console.log('✅ SERVER STATE SNAPSHOT COMPLETE');
  console.log('='.repeat(70));
  console.log(`📊 Guilds: ${totalStats.guilds}`);
  console.log(`📊 Roles: ${totalStats.roles}`);
  console.log(`📊 Channels: ${totalStats.channels}`);
  console.log(`📊 Members: ${totalStats.members}`);
  console.log(`📊 Emojis: ${totalStats.emojis}`);
  console.log(`📊 Stickers: ${totalStats.stickers}`);
  console.log('='.repeat(70));
  console.log('');

  return totalStats;
}

async function snapshotGuild(guild, storageService) {
  const stats = {
    roles: 0,
    channels: 0,
    members: 0,
    emojis: 0,
    stickers: 0
  };

  try {
    // Store guild info
    await storageService.guilds.store(guild);

    // Snapshot all roles
    for (const [roleId, role] of guild.roles.cache) {
      try {
        // Store in roles table
        storageService.db.prepare(`
          INSERT OR REPLACE INTO roles (id, name, color, position)
          VALUES (?, ?, ?, ?)
        `).run(roleId, role.name, role.hexColor, role.position);

        // Log as role event (create) with current timestamp
        storageService.serverEvents.logRoleCreate(role);
        stats.roles++;
      } catch (error) {
        // Skip if already exists
      }
    }

    // Snapshot all channels
    for (const [channelId, channel] of guild.channels.cache) {
      try {
        await storageService.storeChannel(channel);
        
        // Only log create event for actual channels (not categories that are just parents)
        if (channel.type !== 4) { // 4 = GUILD_CATEGORY
          storageService.serverEvents.logChannelCreate(channel);
        }
        stats.channels++;
      } catch (error) {
        // Skip if already exists
      }
    }

    // Snapshot all emojis
    for (const [emojiId, emoji] of guild.emojis.cache) {
      try {
        storageService.serverEvents.logEmojiCreate(emoji);
        stats.emojis++;
      } catch (error) {
        // Skip if already exists
      }
    }

    // Snapshot all stickers
    for (const [stickerId, sticker] of guild.stickers.cache) {
      try {
        storageService.serverEvents.logStickerCreate(sticker);
        stats.stickers++;
      } catch (error) {
        // Skip if already exists
      }
    }

    // Fetch and snapshot all members (skip for very large servers to avoid timeout)
    const memberLimit = 500; // Skip member fetch if server has more than this
    
    if (guild.memberCount > memberLimit) {
      console.log(`  ℹ Skipping member fetch (${guild.memberCount} members > ${memberLimit} limit)`);
      console.log(`  💡 Members will be tracked as they become active`);
    } else {
      try {
        console.log(`  ⏳ Fetching ${guild.memberCount} members...`);
        const members = await guild.members.fetch();
        
        for (const [memberId, member] of members) {
          try {
            // Store user and member info
            await storageService.users.store(member.user, member);
            
            // Log as member join event with current timestamp
            storageService.userEvents.logMemberJoin(member);
            stats.members++;
          } catch (error) {
            // Skip if already exists or other error
          }
        }
      } catch (error) {
        console.log(`  ⚠ Could not fetch all members (may not have permission)`);
      }
    }

  } catch (error) {
    console.error(`  ✗ Error in snapshotGuild:`, error.message);
  }

  return stats;
}

module.exports = { snapshotServerState, snapshotGuild };