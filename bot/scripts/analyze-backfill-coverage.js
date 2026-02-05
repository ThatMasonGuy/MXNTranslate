// scripts/analyze-backfill-coverage.js - Analyze what messages are missing from the database
const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '../.env') });
const { Client, GatewayIntentBits } = require("discord.js");
const db = require('../db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

async function analyzeChannel(channel) {
  try {
    // Get DB stats for this channel
    const dbStats = db.prepare(`
      SELECT 
        COUNT(*) as logged_count,
        MIN(timestamp) as earliest_logged,
        MAX(timestamp) as latest_logged
      FROM messages
      WHERE channel_id = ?
    `).get(channel.id);
    
    // Try to fetch actual message count from Discord (approximate)
    let discordOldest = null;
    let discordNewest = null;
    let estimatedTotal = 0;
    
    try {
      // Fetch the oldest message we can
      const oldestBatch = await channel.messages.fetch({ limit: 1, after: '0' });
      if (oldestBatch.size > 0) {
        discordOldest = oldestBatch.first();
      }
      
      // Fetch the newest message
      const newestBatch = await channel.messages.fetch({ limit: 1 });
      if (newestBatch.size > 0) {
        discordNewest = newestBatch.first();
      }
      
      // Rough estimate: sample a few points
      if (discordOldest && discordNewest) {
        const timeSpan = discordNewest.createdTimestamp - discordOldest.createdTimestamp;
        const samplePoints = 5;
        let sampleTotal = 0;
        
        for (let i = 0; i < samplePoints; i++) {
          const timestamp = discordOldest.createdTimestamp + (timeSpan * i / (samplePoints - 1));
          const snowflake = ((timestamp - 1420070400000) << 22).toString();
          
          try {
            const messages = await channel.messages.fetch({ limit: 100, around: snowflake });
            sampleTotal += messages.size;
          } catch (e) {
            // Skip this sample point
          }
          
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Very rough estimate
        estimatedTotal = Math.floor(sampleTotal * (timeSpan / (100 * samplePoints * 10)));
      }
    } catch (e) {
      // Can't access channel history
    }
    
    const result = {
      channelId: channel.id,
      channelName: channel.name,
      guildName: channel.guild.name,
      loggedCount: dbStats.logged_count || 0,
      earliestLogged: dbStats.earliest_logged,
      latestLogged: dbStats.latest_logged,
      discordOldest: discordOldest?.createdAt || null,
      discordNewest: discordNewest?.createdAt || null,
      estimatedTotal: estimatedTotal,
      hasMessages: dbStats.logged_count > 0,
      hasPotentialGaps: false
    };
    
    // Check for potential gaps
    if (result.loggedCount > 0 && discordOldest && discordNewest) {
      const dbTimeSpan = new Date(result.latestLogged) - new Date(result.earliestLogged);
      const discordTimeSpan = discordNewest.createdTimestamp - discordOldest.createdTimestamp;
      
      // If Discord has older messages than our DB, we're missing history
      if (discordOldest.createdTimestamp < new Date(result.earliestLogged).getTime() - 60000) {
        result.hasPotentialGaps = true;
        result.gapReason = 'Missing older messages';
      }
      
      // If Discord has newer messages than our DB, we're missing recent messages
      if (discordNewest.createdTimestamp > new Date(result.latestLogged).getTime() + 60000) {
        result.hasPotentialGaps = true;
        result.gapReason = result.gapReason ? 'Missing both old and new messages' : 'Missing newer messages';
      }
    }
    
    return result;
  } catch (error) {
    return {
      channelId: channel.id,
      channelName: channel.name,
      guildName: channel.guild.name,
      error: error.message
    };
  }
}

async function main() {
  console.log('\n🔍 Starting coverage analysis...');
  
  await client.login(process.env.DISCORD_TOKEN);
  
  await new Promise(resolve => {
    client.once('ready', resolve);
  });
  
  console.log(`✅ Logged in as ${client.user.tag}\n`);
  
  const textChannels = [];
  
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.forEach(channel => {
      if (
        channel.isTextBased() &&
        channel.viewable &&
        (channel.type === 0 || channel.type === 5)
      ) {
        textChannels.push(channel);
      }
    });
  });
  
  console.log(`Found ${textChannels.length} text channels to analyze\n`);
  console.log('='.repeat(80));
  
  const results = {
    totalChannels: 0,
    channelsWithMessages: 0,
    channelsWithNoMessages: 0,
    channelsWithGaps: 0,
    channelsWithErrors: 0,
    totalLogged: 0,
    details: []
  };
  
  for (let i = 0; i < textChannels.length; i++) {
    const channel = textChannels[i];
    process.stdout.write(`\r[${i + 1}/${textChannels.length}] Analyzing ${channel.guild.name} / #${channel.name}...`);
    
    const analysis = await analyzeChannel(channel);
    results.details.push(analysis);
    results.totalChannels++;
    
    if (analysis.error) {
      results.channelsWithErrors++;
    } else if (analysis.loggedCount === 0) {
      results.channelsWithNoMessages++;
    } else {
      results.channelsWithMessages++;
      results.totalLogged += analysis.loggedCount;
      
      if (analysis.hasPotentialGaps) {
        results.channelsWithGaps++;
      }
    }
    
    // Throttle to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 ANALYSIS RESULTS');
  console.log('='.repeat(80));
  console.log(`Total channels analyzed: ${results.totalChannels}`);
  console.log(`Channels with messages logged: ${results.channelsWithMessages}`);
  console.log(`Channels with NO messages logged: ${results.channelsWithNoMessages}`);
  console.log(`Channels with potential gaps: ${results.channelsWithGaps}`);
  console.log(`Channels with errors: ${results.channelsWithErrors}`);
  console.log(`Total messages logged: ${results.totalLogged.toLocaleString()}`);
  console.log('='.repeat(80));
  
  // Show channels with no messages
  if (results.channelsWithNoMessages > 0) {
    console.log('\n❌ CHANNELS WITH NO MESSAGES LOGGED:');
    console.log('-'.repeat(80));
    results.details
      .filter(d => d.loggedCount === 0 && !d.error)
      .forEach(d => {
        console.log(`  • ${d.guildName} / #${d.channelName}`);
      });
  }
  
  // Show channels with gaps
  if (results.channelsWithGaps > 0) {
    console.log('\n⚠️  CHANNELS WITH POTENTIAL GAPS:');
    console.log('-'.repeat(80));
    results.details
      .filter(d => d.hasPotentialGaps)
      .forEach(d => {
        console.log(`  • ${d.guildName} / #${d.channelName}`);
        console.log(`    Logged: ${d.loggedCount} messages`);
        console.log(`    Range: ${d.earliestLogged || 'N/A'} to ${d.latestLogged || 'N/A'}`);
        console.log(`    Reason: ${d.gapReason}`);
      });
  }
  
  // Show errors
  if (results.channelsWithErrors > 0) {
    console.log('\n🔴 CHANNELS WITH ERRORS:');
    console.log('-'.repeat(80));
    results.details
      .filter(d => d.error)
      .forEach(d => {
        console.log(`  • ${d.guildName} / #${d.channelName}: ${d.error}`);
      });
  }
  
  console.log('\n✅ Analysis complete!');
  console.log('\nTo fix gaps, run: node bot/scripts/run-comprehensive-backfill.js\n');
  
  await client.destroy();
  process.exit(0);
}

process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted, shutting down...');
  try {
    await client.destroy();
  } catch (e) {
    // Ignore
  }
  process.exit(0);
});

main().catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});