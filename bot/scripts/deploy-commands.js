// scripts/deploy-commands.js
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load .env from the bot directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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

// Check if token and client ID are loaded
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ ERROR: DISCORD_TOKEN not found in .env file!');
  console.error('Looking for .env at:', path.join(__dirname, '..', '.env'));
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('❌ ERROR: CLIENT_ID not found in .env file!');
  console.error('Add CLIENT_ID to your .env file:');
  console.error('CLIENT_ID=your_application_id_here');
  console.error('Get it from: https://discord.com/developers/applications');
  process.exit(1);
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`🔧 Registering ${commands.length} slash command(s) globally...`);

    // Deploy globally to ALL guilds (takes up to 1 hour to propagate)
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ Successfully registered ${data.length} slash command(s) globally!`);
    console.log('Note: Global commands can take up to 1 hour to appear in all servers.');

  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    
    if (error.code === 50001) {
      console.error('\n💡 Error 50001: Missing Access');
      console.error('Make sure your bot has the applications.commands scope!');
    }
  }
})();
