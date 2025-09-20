// commands/index.js (Updated command loader)
const fs = require("fs");
const path = require("path");

const commandMap = new Map();

function loadCommands() {
  const baseDir = path.join(__dirname);
  
  // Load main command files (like translate.js)
  const mainCommandFiles = fs
    .readdirSync(baseDir)
    .filter(file => file.endsWith('.js') && file !== 'index.js');
    
  for (const file of mainCommandFiles) {
    const command = require(path.join(baseDir, file));
    if (command && command.data && command.execute) {
      commandMap.set(command.data.name, command);
      console.log(`Loaded main command: ${command.data.name}`);
    }
  }
  
  // Load subcommand files from category folders
  const categories = fs
    .readdirSync(baseDir)
    .filter((folder) => fs.statSync(path.join(baseDir, folder)).isDirectory());

  for (const category of categories) {
    const files = fs
      .readdirSync(path.join(baseDir, category))
      .filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const command = require(path.join(baseDir, category, file));
      if (command && command.data && command.execute) {
        commandMap.set(`${category}.${command.data.name}`, command);
        console.log(`Loaded subcommand: ${category}.${command.data.name}`);
      }
    }
  }

  return commandMap;
}

module.exports = loadCommands();
