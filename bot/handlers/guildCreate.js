// handlers/guildCreate.js - UPDATED
const nuclearBackfill = require('../utils/nuclearBackfill');
const db = require('../db');

async function handleGuildCreate(guild, client) {
  // Check if we've seen this guild before
  const existingGuild = db.prepare("SELECT id FROM guilds WHERE id = ?").get(guild.id);
  
  if (existingGuild) {
    // This is an existing guild (bot restart) - skip
    console.log(`Reconnected to guild: ${guild.name} (skipping backfill)`);
    return;
  }
  
  // This is a NEW guild - do comprehensive backfill
  console.log('\n' + '='.repeat(60));
  console.log(`🎉 Joined NEW guild: ${guild.name} (${guild.id})`);
  console.log('='.repeat(60));
  
  console.log(`Members: ${guild.memberCount}`);
  console.log(`Channels: ${guild.channels.cache.size}`);
  console.log(`Starting comprehensive backfill for this guild...`);
  
  try {
    await nuclearBackfill(client, {
      guildIds: [guild.id],
      throttleMs: 50,
      skipThreads: false
    });
    
    console.log(`✅ ${guild.name}: Backfill complete!`);
    
  } catch (error) {
    console.error(`❌ ${guild.name}: Backfill failed:`, error.message);
  }
  
  console.log('='.repeat(60) + '\n');
}

module.exports = handleGuildCreate;