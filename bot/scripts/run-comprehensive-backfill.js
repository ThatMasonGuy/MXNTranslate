// scripts/run-comprehensive-backfill.js - Standalone script to backfill all messages
const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '../.env') });
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const nuclearBackfill = require('../utils/nuclearBackfill');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

async function main() {
  console.log('\n🚀 Starting Discord client...');
  
  await client.login(process.env.DISCORD_TOKEN);
  
  await new Promise(resolve => {
    client.once('ready', resolve);
  });
  
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    throttleMs: 50, // Default throttle
    guildIds: null,
    channelIds: null,
    skipThreads: false
  };
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--guild' && args[i + 1]) {
      options.guildIds = options.guildIds || [];
      options.guildIds.push(args[i + 1]);
      i++;
    } else if (args[i] === '--channel' && args[i + 1]) {
      options.channelIds = options.channelIds || [];
      options.channelIds.push(args[i + 1]);
      i++;
    } else if (args[i] === '--throttle' && args[i + 1]) {
      options.throttleMs = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--skip-threads') {
      options.skipThreads = true;
    } else if (args[i] === '--help') {
      console.log(`
Usage: node scripts/run-comprehensive-backfill.js [options]

Options:
  --guild <id>       Backfill only this guild (can specify multiple times)
  --channel <id>     Backfill only this channel (can specify multiple times)
  --throttle <ms>    Throttle between requests (default: 50ms)
  --skip-threads     Skip thread backfilling
  --help             Show this help message

Examples:
  # Backfill everything
  node scripts/run-comprehensive-backfill.js

  # Backfill a specific guild
  node scripts/run-comprehensive-backfill.js --guild 123456789012345678

  # Backfill a specific channel
  node scripts/run-comprehensive-backfill.js --channel 123456789012345678

  # Backfill with slower throttle to avoid rate limits
  node scripts/run-comprehensive-backfill.js --throttle 100

  # Backfill without threads (faster)
  node scripts/run-comprehensive-backfill.js --skip-threads
      `);
      process.exit(0);
    }
  }
  
  try {
    await nuclearBackfill(client, options);
    
    console.log('\n✅ Backfill completed successfully!');
    console.log('Shutting down...');
    
    await client.destroy();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    console.error(error.stack);
    
    await client.destroy();
    process.exit(1);
  }
}

// Handle cleanup on interrupt
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received interrupt signal, shutting down gracefully...');
  try {
    await client.destroy();
  } catch (e) {
    // Ignore
  }
  process.exit(0);
});

main();