// handlers/channelCreate.js - UPDATED
const nuclearBackfill = require('../utils/nuclearBackfill');
const db = require('../db');

async function handleChannelCreate(channel, client) {
  // Only handle text channels
  if (!channel.isTextBased() || (channel.type !== 0 && channel.type !== 5)) {
    return;
  }

  // Check if we've seen this channel before
  const existingChannel = db.prepare("SELECT id FROM channels WHERE id = ?").get(channel.id);
  
  if (existingChannel) {
    // This is an existing channel (bot restart) - skip
    console.log(`Reconnected to channel: ${channel.guild.name} / #${channel.name} (skipping backfill)`);
    return;
  }
  
  // This is a NEW channel - do comprehensive backfill
  console.log('\n' + '='.repeat(60));
  console.log(`📺 NEW channel created: ${channel.guild.name} / #${channel.name}`);
  console.log('='.repeat(60));
  
  try {
    await nuclearBackfill(client, {
      channelIds: [channel.id],
      throttleMs: 50,
      skipThreads: false
    });
    
    console.log(`✅ #${channel.name}: Backfill complete!`);
    
  } catch (error) {
    console.error(`❌ #${channel.name}: Backfill failed:`, error.message);
  }
  
  console.log('='.repeat(60) + '\n');
}

module.exports = handleChannelCreate;