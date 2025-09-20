// scripts/deploy-commands.js (NEW FILE - Run this to register commands with Discord)
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];

// Load all command files
const foldersPath = path.join(__dirname, '..', 'commands');
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(foldersPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Get client ID from token
    const clientId = Buffer.from(process.env.DISCORD_TOKEN.split('.')[0], 'base64').toString();

    // For development - deploy to specific guild (faster)
    // Replace YOUR_GUILD_ID with your test server ID
    const guildId = '1276352770164658317'; // Replace with your test server ID
    
    if (process.argv.includes('--global')) {
      // Deploy globally (takes up to 1 hour to update)
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } else if (guildId && guildId !== '1276352770164658317') {
      // Deploy to specific guild (instant)
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`);
    } else {
      console.log('Please set a GUILD_ID in the script or use --global flag');
      console.log('Guild deployment: node scripts/deploy-commands.js');
      console.log('Global deployment: node scripts/deploy-commands.js --global');
    }

  } catch (error) {
    console.error(error);
  }
})();
