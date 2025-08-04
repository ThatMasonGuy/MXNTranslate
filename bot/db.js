// db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Define the absolute path to your DB
const dbPath = '/home/mason/discord_data/discord_tracker.db';

// Ensure the directory exists (just in case)
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Open the database (must exist, don't create new)
const db = new Database(dbPath, {
  fileMustExist: true,
  timeout: 5000,
});

module.exports = db;
