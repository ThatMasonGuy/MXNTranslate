// scripts/verify-auto-translate-db.js
// Quick script to check auto-translate database state
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = '/home/mason/discord_data/discord_tracker.db';
const db = new Database(dbPath, { fileMustExist: true });

console.log('🔍 Checking auto_translate_channels table...\n');

// Check all rows
const allRows = db.prepare(`SELECT * FROM auto_translate_channels`).all();
console.log('📊 Total rows in auto_translate_channels:', allRows.length);

if (allRows.length > 0) {
  console.log('\n📋 All auto-translate configs:');
  allRows.forEach((row, i) => {
    console.log(`\n${i + 1}. ID: ${row.id}`);
    console.log(`   Guild: ${row.guild_id}`);
    console.log(`   Channel: ${row.channel_id}`);
    console.log(`   Source: ${row.source_channel_id}`);
    console.log(`   Language: ${row.target_language}`);
    console.log(`   Active: ${row.is_active}`);
    console.log(`   Webhook ID: ${row.webhook_id || 'NULL'}`);
  });
} else {
  console.log('❌ No auto-translate configs found in database!');
}

// Check by specific guild
console.log('\n\n🔍 Checking for guild 1276352770164658317...');
const guildRows = db.prepare(`
  SELECT * FROM auto_translate_channels WHERE guild_id = ?
`).all('1276352770164658317');

console.log(`Found ${guildRows.length} configs for this guild`);
if (guildRows.length > 0) {
  guildRows.forEach(row => {
    console.log('  -', row);
  });
}

db.close();
console.log('\n✅ Database check complete');
