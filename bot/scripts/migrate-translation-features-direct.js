// scripts/migrate-translation-features-direct.js
// Direct migration script with embedded SQL
// Usage: node bot/scripts/migrate-translation-features-direct.js

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = '/home/mason/discord_data/discord_tracker.db';

// Ensure the database exists
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found at ${dbPath}`);
  console.error('Please ensure the database path is correct.');
  process.exit(1);
}

const db = new Database(dbPath, {
  fileMustExist: true,
  timeout: 5000,
});

console.log('🔄 Starting migration for translation features...\n');
console.log('📝 Creating tables...\n');

let successCount = 0;
let errorCount = 0;

// Create tables one by one
const tables = [
  {
    name: 'translation_config',
    sql: `CREATE TABLE IF NOT EXISTS translation_config (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'blocked_translation_channels',
    sql: `CREATE TABLE IF NOT EXISTS blocked_translation_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guild_id, channel_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    )`
  },
  {
    name: 'announcement_translation_channels',
    sql: `CREATE TABLE IF NOT EXISTS announcement_translation_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      source_channel_id TEXT NOT NULL,
      announcement_channel_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guild_id, source_channel_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    )`
  },
  {
    name: 'auto_translate_channels',
    sql: `CREATE TABLE IF NOT EXISTS auto_translate_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL UNIQUE,
      source_channel_id TEXT NOT NULL,
      target_language TEXT NOT NULL,
      webhook_id TEXT,
      webhook_token TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    )`
  },
  {
    name: 'translated_messages',
    sql: `CREATE TABLE IF NOT EXISTS translated_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_message_id TEXT NOT NULL,
      translated_message_id TEXT NOT NULL,
      source_channel_id TEXT NOT NULL,
      target_channel_id TEXT NOT NULL,
      auto_translate_config_id INTEGER,
      is_auto_translation INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auto_translate_config_id) REFERENCES auto_translate_channels(id) ON DELETE CASCADE
    )`
  }
];

for (const table of tables) {
  try {
    db.exec(table.sql);
    console.log(`✅ Created/verified table: ${table.name}`);
    successCount++;
  } catch (error) {
    console.error(`❌ Error creating table ${table.name}: ${error.message}`);
    errorCount++;
  }
}

// Create indexes
console.log('\n📊 Creating indexes...\n');

const indexes = [
  { name: 'idx_blocked_channels_guild', sql: 'CREATE INDEX IF NOT EXISTS idx_blocked_channels_guild ON blocked_translation_channels(guild_id)' },
  { name: 'idx_blocked_channels_channel', sql: 'CREATE INDEX IF NOT EXISTS idx_blocked_channels_channel ON blocked_translation_channels(channel_id)' },
  { name: 'idx_announcement_channels_guild', sql: 'CREATE INDEX IF NOT EXISTS idx_announcement_channels_guild ON announcement_translation_channels(guild_id)' },
  { name: 'idx_announcement_channels_source', sql: 'CREATE INDEX IF NOT EXISTS idx_announcement_channels_source ON announcement_translation_channels(source_channel_id)' },
  { name: 'idx_auto_translate_guild', sql: 'CREATE INDEX IF NOT EXISTS idx_auto_translate_guild ON auto_translate_channels(guild_id)' },
  { name: 'idx_auto_translate_channel', sql: 'CREATE INDEX IF NOT EXISTS idx_auto_translate_channel ON auto_translate_channels(channel_id)' },
  { name: 'idx_auto_translate_source', sql: 'CREATE INDEX IF NOT EXISTS idx_auto_translate_source ON auto_translate_channels(source_channel_id)' },
  { name: 'idx_translated_messages_original', sql: 'CREATE INDEX IF NOT EXISTS idx_translated_messages_original ON translated_messages(original_message_id)' },
  { name: 'idx_translated_messages_translated', sql: 'CREATE INDEX IF NOT EXISTS idx_translated_messages_translated ON translated_messages(translated_message_id)' },
  { name: 'idx_translated_messages_source', sql: 'CREATE INDEX IF NOT EXISTS idx_translated_messages_source ON translated_messages(source_channel_id)' },
  { name: 'idx_translated_messages_target', sql: 'CREATE INDEX IF NOT EXISTS idx_translated_messages_target ON translated_messages(target_channel_id)' }
];

for (const index of indexes) {
  try {
    db.exec(index.sql);
    console.log(`✅ Created/verified index: ${index.name}`);
    successCount++;
  } catch (error) {
    console.error(`❌ Error creating index ${index.name}: ${error.message}`);
    errorCount++;
  }
}

console.log('\n📊 Migration complete!');
console.log(`✅ Successful operations: ${successCount}`);
if (errorCount > 0) {
  console.log(`❌ Errors: ${errorCount}`);
}

// Verify tables exist
console.log('\n🔍 Verifying new tables...');
const tableNames = [
  'translation_config',
  'blocked_translation_channels',
  'announcement_translation_channels',
  'auto_translate_channels',
  'translated_messages'
];

for (const tableName of tableNames) {
  const result = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=?
  `).get(tableName);
  
  if (result) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    console.log(`✅ ${tableName} exists (${count.count} rows)`);
  } else {
    console.log(`❌ ${tableName} not found`);
  }
}

db.close();
console.log('\n✨ Migration finished! You can now use the new translation features.');