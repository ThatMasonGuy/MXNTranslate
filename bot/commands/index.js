const fs = require("fs");
const path = require("path");

const commandMap = new Map();

function loadCommands() {
  const baseDir = path.join(__dirname);
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
      }
    }
  }

  return commandMap;
}

module.exports = loadCommands();
