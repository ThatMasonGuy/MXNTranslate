// scripts/snapshot-current-state.js
// One-time script to capture the current state of all servers
// Run this once after setting up event tracking to establish baseline

const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '../.env') });
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const config = require('../config/features');
const db = require('../db');
const StorageService = require('../services/storage');
const { snapshotServerState } = require('../utils/snapshotServerState');

console.log('Starting snapshot bot...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
  ],
  partials: [Partials.GuildMember],
});

const storageService = new StorageService(db, config);

client.once("ready", async () => {
  console.log(`\n✓ Logged in as ${client.user.tag}\n`);

  try {
    await snapshotServerState(client, storageService);
    
    console.log('✅ Snapshot complete! You now have baseline data for all servers.');
    console.log('\nNote: These are logged with current timestamps, not historical dates.');
    console.log('Going forward, all new events will be tracked in real-time.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Snapshot failed:', error);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);