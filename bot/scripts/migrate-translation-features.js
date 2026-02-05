// scripts/migrate-translation-features.js
// Run this script to add the new translation features to your database
// Usage: node scripts/migrate-translation-features.js

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

// Read the schema file
const schemaPath = path.join(__dirname, '..', '..', 'translation_config_schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Split into individual statements
const allStatements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

// Separate CREATE TABLE and CREATE INDEX statements
const tableStatements = allStatements.filter(s => s.match(/CREATE TABLE/i));
const indexStatements = allStatements.filter(s => s.match(/CREATE INDEX/i));

let successCount = 0;
let errorCount = 0;

// Execute CREATE TABLE statements first
console.log('📝 Creating tables...\n');
for (const statement of tableStatements) {
  try {
    db.exec(statement);
    
    const match = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (match) {
      console.log(`✅ Created/verified table: ${match[1]}`);
      successCount++;
    }
  } catch (error) {
    console.error(`❌ Error executing statement: ${error.message}`);
    console.error(`Statement: ${statement.substring(0, 200)}...`);
    errorCount++;
  }
}

// Then execute CREATE INDEX statements
console.log('\n📊 Creating indexes...\n');
for (const statement of indexStatements) {
  try {
    db.exec(statement);
    
    const indexMatch = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/i);
    if (indexMatch) {
      console.log(`✅ Created/verified index: ${indexMatch[1]}`);
      successCount++;
    }
  } catch (error) {
    console.error(`❌ Error executing statement: ${error.message}`);
    console.error(`Statement: ${statement.substring(0, 200)}...`);
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
const tables = [
  'translation_config',
  'blocked_translation_channels',
  'announcement_translation_channels',
  'auto_translate_channels',
  'translated_messages'
];

for (const tableName of tables) {
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
