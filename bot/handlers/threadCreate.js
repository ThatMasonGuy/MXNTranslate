// handlers/threadCreate.js - Handle new threads created in channels
// Does a comprehensive backfill for the new thread only

const nuclearBackfill = require('../utils/nuclearBackfill');
const db = require('../db');

async function handleThreadCreate(thread, client) {
  // Only handle threads we care about
  if (!thread.isThread()) {
    return;
  }

  // Check if we've seen this thread before (bot restart scenario)
  const existingThread = db.prepare("SELECT id FROM channels WHERE id = ?").get(thread.id);
  
  if (existingThread) {
    // This is an existing thread (bot restart) - skip
    console.log(`Reconnected to thread: ${thread.parent?.name} / ${thread.name} (skipping backfill)`);
    return;
  }
  
  // This is a NEW thread - do comprehensive backfill
  console.log('\n' + '='.repeat(60));
  console.log(`🧵 NEW thread created: ${thread.parent?.name} / ${thread.name}`);
  console.log('='.repeat(60));
  
  console.log(`Thread type: ${thread.type}`);
  console.log(`Starting comprehensive backfill for this thread...`);
  
  try {
    // Run nuclear backfill for ONLY this thread
    // Threads are channels, so we use channelIds
    await nuclearBackfill(client, {
      channelIds: [thread.id],
      throttleMs: 50,
      skipThreads: true // Don't process sub-threads (threads don't have sub-threads)
    });
    
    console.log(`✅ ${thread.name}: Backfill complete!`);
    
  } catch (error) {
    console.error(`❌ ${thread.name}: Backfill failed:`, error.message);
  }
  
  console.log('='.repeat(60) + '\n');
}

module.exports = handleThreadCreate;