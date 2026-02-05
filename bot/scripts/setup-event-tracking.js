// scripts/setup-event-tracking.js
// Run this once to add event tracking tables to your database

const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '../.env') });
const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = '/home/mason/discord_data/discord_tracker.db';
const schemaPath = path.join(__dirname, 'event-tracking-schema.sql');

console.log('='.repeat(60));
console.log('EVENT TRACKING SETUP');
console.log('='.repeat(60));

// Open database
const db = new Database(dbPath, {
  fileMustExist: true,
  timeout: 5000,
});

console.log(`✓ Connected to database: ${dbPath}`);

// Read schema file
const schema = fs.readFileSync(schemaPath, 'utf8');

console.log(`Schema file size: ${schema.length} bytes`);

// Better SQL parsing: split by semicolon but keep the context
const allStatements = [];
let currentStatement = '';
const lines = schema.split('\n');

console.log(`Total lines in schema: ${lines.length}\n`);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmedLine = line.trim();
  
  // Skip empty lines
  if (!trimmedLine) {
    continue;
  }
  
  // Skip comment-only lines (lines that START with --)
  if (trimmedLine.startsWith('--')) {
    continue;
  }
  
  // Remove inline comments (-- after code)
  let cleanLine = line;
  const commentIndex = line.indexOf('--');
  if (commentIndex > 0) {
    // There's an inline comment, remove it
    cleanLine = line.substring(0, commentIndex);
  }
  
  // Add line to current statement
  currentStatement += ' ' + cleanLine;
  
  // If line ends with semicolon, we have a complete statement
  if (cleanLine.trim().endsWith(';')) {
    const cleanStatement = currentStatement.trim();
    if (cleanStatement.length > 0) {
      allStatements.push(cleanStatement);
    }
    currentStatement = '';
  }
}

console.log(`Parsed ${allStatements.length} SQL statements\n`);

// Debug: Show first few characters of each statement
console.log('Statement types found:');
for (let i = 0; i < Math.min(5, allStatements.length); i++) {
  const preview = allStatements[i].substring(0, 80).replace(/\s+/g, ' ');
  console.log(`  ${i + 1}. ${preview}...`);
}
console.log('');

// Separate CREATE TABLE and CREATE INDEX statements
const tableStatements = allStatements.filter(s => s.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i));
const indexStatements = allStatements.filter(s => s.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/i));

console.log(`Tables to create: ${tableStatements.length}`);
console.log(`Indices to create: ${indexStatements.length}\n`);

// Debug: Show which tables were found
console.log('Tables found in schema:');
for (const stmt of tableStatements) {
  const match = stmt.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
  if (match) {
    console.log(`  - ${match[1]}`);
  }
}
console.log('');

if (tableStatements.length === 0) {
  console.error('ERROR: No CREATE TABLE statements found in schema file!');
  console.error('Schema file path:', schemaPath);
  console.error('\nFirst 500 chars of schema file:');
  console.error(schema.substring(0, 500));
  process.exit(1);
}

// Execute table creation first
let tableCount = 0;
let indexCount = 0;

console.log('Creating tables...\n');
for (const statement of tableStatements) {
  try {
    const tableMatch = statement.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    const name = tableMatch ? tableMatch[1] : 'unknown';
    
    db.prepare(statement).run();
    console.log(`✓ Created table: ${name}`);
    tableCount++;
  } catch (error) {
    console.error(`✗ Error creating table: ${error.message}`);
    console.error(`   Statement: ${statement.substring(0, 100)}...`);
  }
}

// Then execute index creation
console.log('\nCreating indices...\n');
for (const statement of indexStatements) {
  try {
    const indexMatch = statement.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    const name = indexMatch ? indexMatch[1] : 'unknown';
    
    db.prepare(statement).run();
    console.log(`  ✓ Created index: ${name}`);
    indexCount++;
  } catch (error) {
    console.error(`  ✗ Error creating index: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log(`SETUP COMPLETE`);
console.log(`Tables created: ${tableCount}`);
console.log(`Indices created: ${indexCount}`);
console.log('='.repeat(60));

// Verify tables exist
console.log('\nVerifying table creation...\n');

const tables = [
  'member_events',
  'member_updates', 
  'voice_events',
  'moderation_events',
  'role_events',
  'channel_events',
  'emoji_events',
  'sticker_events',
  'guild_events',
  'invite_events',
  'webhook_events'
];

for (const table of tables) {
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`✓ ${table.padEnd(20)} - Ready (${result.count} rows)`);
  } catch (error) {
    console.log(`✗ ${table.padEnd(20)} - Missing or error`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('EVENT TRACKING IS NOW ENABLED');
console.log('The bot will now track:');
console.log('  • Member joins, leaves, updates');
console.log('  • Voice channel activity');
console.log('  • Moderation events (bans, timeouts)');
console.log('  • Role create/update/delete');
console.log('  • Channel create/update/delete');
console.log('  • Emoji & sticker events');
console.log('  • Guild updates');
console.log('  • Invite tracking');
console.log('  • Webhook events');
console.log('='.repeat(60) + '\n');

db.close();