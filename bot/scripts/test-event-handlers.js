// bot/scripts/test-event-handlers.js
// Diagnostic script to verify event handlers are properly set up

const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '../.env') });

console.log('='.repeat(60));
console.log('EVENT HANDLER DIAGNOSTIC TEST');
console.log('='.repeat(60));
console.log('');

// Test 1: Check if files exist
console.log('1. Checking if handler files exist...\n');

const fs = require('fs');
const filesToCheck = [
  '../handlers/userEventHandler.js',
  '../handlers/serverEventHandler.js',
  '../services/storage/userEventStorage.js',
  '../services/storage/serverEventStorage.js'
];

let allFilesExist = true;
for (const file of filesToCheck) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✓ ${file}`);
  } else {
    console.log(`✗ MISSING: ${file}`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.log('\n✗ Some files are missing! Event tracking cannot work.');
  process.exit(1);
}

console.log('\n2. Testing imports...\n');

// Test 2: Try importing handlers
try {
  const UserEventHandler = require('../handlers/userEventHandler');
  console.log('✓ UserEventHandler imports successfully');
} catch (error) {
  console.log('✗ UserEventHandler import failed:', error.message);
  process.exit(1);
}

try {
  const ServerEventHandler = require('../handlers/serverEventHandler');
  console.log('✓ ServerEventHandler imports successfully');
} catch (error) {
  console.log('✗ ServerEventHandler import failed:', error.message);
  process.exit(1);
}

try {
  const UserEventStorage = require('../services/storage/userEventStorage');
  console.log('✓ UserEventStorage imports successfully');
} catch (error) {
  console.log('✗ UserEventStorage import failed:', error.message);
  process.exit(1);
}

try {
  const ServerEventStorage = require('../services/storage/serverEventStorage');
  console.log('✓ ServerEventStorage imports successfully');
} catch (error) {
  console.log('✗ ServerEventStorage import failed:', error.message);
  process.exit(1);
}

// Test 3: Check config
console.log('\n3. Checking configuration...\n');

const config = require('../config/features');
console.log('storage.enabled:', config.storage.enabled);
console.log('storage.logUserEvents:', config.storage.logUserEvents);
console.log('storage.logServerEvents:', config.storage.logServerEvents);

if (!config.storage.enabled) {
  console.log('\n⚠ WARNING: storage.enabled is false! Events will not be logged.');
}

if (!config.storage.logUserEvents) {
  console.log('\n⚠ WARNING: storage.logUserEvents is false! User events will not be logged.');
}

if (!config.storage.logServerEvents) {
  console.log('\n⚠ WARNING: storage.logServerEvents is false! Server events will not be logged.');
}

// Test 4: Check database tables
console.log('\n4. Checking database tables...\n');

const Database = require('better-sqlite3');
const dbPath = '/home/mason/discord_data/discord_tracker.db';

try {
  const db = new Database(dbPath, { fileMustExist: true, readonly: true });
  
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
  
  let allTablesExist = true;
  for (const table of tables) {
    try {
      db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();
      console.log(`✓ ${table}`);
    } catch (error) {
      console.log(`✗ MISSING: ${table}`);
      allTablesExist = false;
    }
  }
  
  db.close();
  
  if (!allTablesExist) {
    console.log('\n✗ Some tables are missing! Run: npm run setup:events');
    process.exit(1);
  }
} catch (error) {
  console.log('✗ Database error:', error.message);
  process.exit(1);
}

// Test 5: Check bot index.js for event listeners
console.log('\n5. Checking if event listeners are registered in bot/index.js...\n');

const indexPath = path.join(__dirname, '../index.js');
const indexContent = fs.readFileSync(indexPath, 'utf8');

const requiredImports = [
  'UserEventHandler',
  'ServerEventHandler'
];

const requiredListeners = [
  'guildMemberAdd',
  'guildMemberUpdate',
  'roleCreate',
  'channelUpdate'
];

let allImportsPresent = true;
for (const importName of requiredImports) {
  if (indexContent.includes(importName)) {
    console.log(`✓ ${importName} is imported`);
  } else {
    console.log(`✗ MISSING IMPORT: ${importName}`);
    allImportsPresent = false;
  }
}

let allListenersPresent = true;
for (const listener of requiredListeners) {
  if (indexContent.includes(`client.on("${listener}"`)) {
    console.log(`✓ ${listener} event listener is registered`);
  } else {
    console.log(`✗ MISSING LISTENER: ${listener}`);
    allListenersPresent = false;
  }
}

console.log('\n' + '='.repeat(60));
if (allFilesExist && allImportsPresent && allListenersPresent && 
    config.storage.enabled && config.storage.logUserEvents && config.storage.logServerEvents) {
  console.log('✓ ALL CHECKS PASSED');
  console.log('Event tracking should be working!');
  console.log('');
  console.log('If events still aren\'t being logged:');
  console.log('1. Make sure bot has been restarted after adding the files');
  console.log('2. Check for errors in bot startup logs');
  console.log('3. Try a simple event like creating a role');
} else {
  console.log('✗ SOME CHECKS FAILED');
  console.log('Fix the issues above and try again.');
}
console.log('='.repeat(60));
console.log('');