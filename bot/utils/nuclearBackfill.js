// utils/nuclearBackfill.js - FULL BRUTE FORCE - Walk every channel from start to finish
// No clever logic, no gap detection, just fetch EVERYTHING and let the DB sort it out

const db = require('../db');

/**
 * Safe batched insert - INSERT OR IGNORE everything, no pre-checks
 * Let SQLite handle duplicate detection at insert time
 * Includes reaction users for complete rebuild
 */
function batchInsertMessages(messages) {
  const insertReaction = db.prepare(`
    INSERT INTO reactions (message_id, emoji_name, emoji_id, count)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(message_id, emoji_name, emoji_id) DO UPDATE SET count = excluded.count
  `);
  const getExistingReactionId = db.prepare(`
    SELECT id FROM reactions
    WHERE message_id = ? AND emoji_name = ? AND emoji_id IS ?
    LIMIT 1
  `);
  const insertAuthor = db.prepare(`
    INSERT OR IGNORE INTO authors (id, name, nickname, discriminator, color, is_bot, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertReactionUser = db.prepare(`
    INSERT OR IGNORE INTO reaction_users (reaction_id, user_id)
    VALUES (?, ?)
  `);
  const safeInsertMessage = db.prepare(`
    INSERT OR IGNORE INTO messages
      (id, channel_id, guild_id, author_id, content, timestamp, edited_timestamp, is_pinned, type, deleted, referenced_message_id, webhook_id, application_id, flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `);
  const insertChannel = db.prepare(`
    INSERT OR IGNORE INTO channels (id, name, type, position, topic, nsfw, last_message_id, parent_id, archived, auto_archive_duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertGuild = db.prepare(`
    INSERT OR IGNORE INTO guilds (id, name, icon, owner_id, region, afk_channel_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAttachment = db.prepare(`
    INSERT OR IGNORE INTO message_attachments (message_id, url, filename, size, content_type)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertEmbed = db.prepare(`
    INSERT OR IGNORE INTO message_embeds (message_id, type, title, description, url, color, timestamp, image_url, thumbnail_url, video_url, author_name, footer_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSticker = db.prepare(`
    INSERT OR IGNORE INTO message_stickers (message_id, sticker_id, name, format_type)
    VALUES (?, ?, ?, ?)
  `);
  const insertMention = db.prepare(`
    INSERT OR IGNORE INTO message_mentions (message_id, mention_type, mentioned_id)
    VALUES (?, ?, ?)
  `);
  const insertInteraction = db.prepare(`
    INSERT OR IGNORE INTO message_interactions (message_id, interaction_id, interaction_type, command_name, user_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction((batch) => {
    for (const { msg, reactionsData } of batch) {
      try {
        // Just insert everything - INSERT OR IGNORE handles duplicates
        insertAuthor.run(
          msg.author.id,
          msg.author.username,
          msg.member?.nickname ?? msg.author.username,
          msg.author.discriminator ?? null,
          msg.member?.displayHexColor ?? null,
          msg.author.bot ? 1 : 0,
          msg.author.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null
        );

        insertChannel.run(
          msg.channel.id,
          msg.channel.name ?? null,
          msg.channel.type,
          msg.channel.position ?? null,
          msg.channel.topic ?? null,
          msg.channel.nsfw ? 1 : 0,
          msg.channel.lastMessageId ?? null,
          msg.channel.parentId ?? null,
          msg.channel.archived === undefined ? null : (msg.channel.archived ? 1 : 0),
          msg.channel.autoArchiveDuration ?? null
        );

        insertGuild.run(
          msg.guild.id,
          msg.guild.name,
          msg.guild.icon ?? null,
          msg.guild.ownerId ?? null,
          null,
          msg.guild.afkChannelId ?? null
        );

        safeInsertMessage.run(
          msg.id,
          msg.channel.id,
          msg.guild.id,
          msg.author.id,
          msg.content,
          msg.createdAt.toISOString(),
          null,
          msg.pinned ? 1 : 0,
          msg.type,
          msg.reference?.messageId ?? null,
          msg.webhookId ?? null,
          msg.applicationId ?? null,
          msg.flags?.bitfield ?? 0
        );

        if (msg.attachments && msg.attachments.size > 0) {
          for (const [, att] of msg.attachments) {
            insertAttachment.run(
              msg.id,
              att.url,
              att.name,
              att.size,
              att.contentType ?? null
            );
          }
        }

        // Store embeds (link previews, rich embeds, etc)
        if (msg.embeds && msg.embeds.length > 0) {
          for (const embed of msg.embeds) {
            insertEmbed.run(
              msg.id,
              embed.type ?? 'rich',
              embed.title ?? null,
              embed.description ?? null,
              embed.url ?? null,
              embed.color ?? null,
              embed.timestamp ?? null,
              embed.image?.url ?? null,
              embed.thumbnail?.url ?? null,
              embed.video?.url ?? null,
              embed.author?.name ?? null,
              embed.footer?.text ?? null
            );
          }
        }

        // Store stickers
        if (msg.stickers && msg.stickers.size > 0) {
          for (const [, sticker] of msg.stickers) {
            insertSticker.run(
              msg.id,
              sticker.id,
              sticker.name,
              sticker.format
            );
          }
        }

        // Store mentions
        if (msg.mentions) {
          // User mentions
          if (msg.mentions.users && msg.mentions.users.size > 0) {
            for (const [userId] of msg.mentions.users) {
              insertMention.run(msg.id, 'user', userId);
            }
          }
          // Role mentions
          if (msg.mentions.roles && msg.mentions.roles.size > 0) {
            for (const [roleId] of msg.mentions.roles) {
              insertMention.run(msg.id, 'role', roleId);
            }
          }
          // Channel mentions
          if (msg.mentions.channels && msg.mentions.channels.size > 0) {
            for (const [channelId] of msg.mentions.channels) {
              insertMention.run(msg.id, 'channel', channelId);
            }
          }
          // @everyone or @here
          if (msg.mentions.everyone) {
            insertMention.run(msg.id, 'everyone', null);
          }
        }

        // Store interaction metadata (slash commands)
        if (msg.interaction) {
          insertInteraction.run(
            msg.id,
            msg.interaction.id,
            msg.interaction.type ?? null,
            msg.interaction.commandName ?? null,
            msg.interaction.user?.id ?? null
          );
        }

        for (const r of reactionsData) {
          insertReaction.run(msg.id, r.emoji_name, r.emoji_id, r.count);
          
          // Look up the reaction ID (this is fast - single indexed lookup)
          const reactionRow = getExistingReactionId.get(msg.id, r.emoji_name, r.emoji_id);
          const reactionId = reactionRow?.id;

          if (reactionId && r.userList && r.userList.length > 0) {
            for (const user of r.userList) {
              try {
                insertAuthor.run(
                  user.id,
                  user.username,
                  user.username,
                  user.discriminator ?? null,
                  null,
                  user.bot ? 1 : 0,
                  user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null
                );
                insertReactionUser.run(reactionId, user.id);
              } catch (err) {
                // Ignore reaction user insert failures
              }
            }
          }
        }
      } catch (err) {
        console.error(`Failed to insert message ${msg.id}:`, err.message);
      }
    }
  })(messages);
}

/**
 * BRUTE FORCE: Walk the entire channel from oldest to newest
 * Fetch 100 at a time using 'after', keep going until Discord says "no more"
 */
async function walkEntireChannel(channel, throttleMs = 50) {
  console.log(`\n📝 Walking: ${channel.name} (${channel.id})`);
  
  let afterId = '0'; // Start from the very beginning
  let totalFetched = 0;
  let totalAdded = 0;
  let fetchCount = 0;
  let emptyFetches = 0;

  while (true) {
    let messages;
    try {
      // Fetch next 100 messages after current position
      messages = await channel.messages.fetch({ limit: 100, after: afterId });
      fetchCount++;
      
      if (!messages || messages.size === 0) {
        emptyFetches++;
        // Try a few more times in case of temporary issues
        if (emptyFetches >= 3) {
          console.log(`    ✓ Reached end after ${fetchCount} fetches`);
          break;
        }
        continue;
      }
      
      emptyFetches = 0; // Reset on successful fetch
      totalFetched += messages.size;

    } catch (err) {
      console.error(`    ✗ Fetch error at position ${afterId}:`, err.message);
      // Try to continue from where we were
      await new Promise(res => setTimeout(res, throttleMs * 5)); // Longer delay on error
      continue;
    }

    // Sort messages chronologically
    const sorted = Array.from(messages.values()).sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    console.log(`    → Batch ${fetchCount}: Processing ${sorted.length} messages...`);

    // Prepare batch
    const batchData = [];
    let reactionsProcessed = 0;
    for (let i = 0; i < sorted.length; i++) {
      const msg = sorted[i];
      const reactionsData = [];
      
      if (msg.reactions.cache.size > 0) {
        for (const reaction of msg.reactions.cache.values()) {
          try {
            const userList = await reaction.users.fetch();
            reactionsData.push({
              emoji_name: reaction.emoji.name,
              emoji_id: reaction.emoji.id ?? null,
              count: reaction.count,
              userList: Array.from(userList.values())
            });
            reactionsProcessed++;
          } catch (err) {
            reactionsData.push({
              emoji_name: reaction.emoji.name,
              emoji_id: reaction.emoji.id ?? null,
              count: reaction.count,
              userList: []
            });
          }
        }
      }
      batchData.push({ msg, reactionsData });
      
      // Progress indicator every 25 messages
      if ((i + 1) % 25 === 0) {
        console.log(`       Processing... ${i + 1}/${sorted.length} messages, ${reactionsProcessed} reactions`);
      }
    }
    
    console.log(`    → Batch ${fetchCount}: Inserting ${batchData.length} messages into database...`);

    // Insert batch
    try {
      const beforeCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE channel_id = ?").get(channel.id).count;
      batchInsertMessages(batchData);
      const afterCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE channel_id = ?").get(channel.id).count;
      const addedThisBatch = afterCount - beforeCount;
      totalAdded += addedThisBatch;
      console.log(`    ✓ Batch ${fetchCount}: Added ${addedThisBatch} new messages (${totalAdded} total added so far)`);
    } catch (err) {
      console.error(`    ✗ Batch insert failed:`, err.message);
    }

    // Move cursor forward
    afterId = sorted[sorted.length - 1].id;

    // Throttle
    if (throttleMs > 0) await new Promise(res => setTimeout(res, throttleMs));
  }

  console.log(`✅ ${channel.name}: Fetched ${totalFetched}, Added ${totalAdded} new messages`);
  return { fetched: totalFetched, added: totalAdded };
}

/**
 * Walk all threads in a channel
 */
async function walkAllThreads(parentChannel, throttleMs = 50) {
  let threadCount = 0;
  let threadMessagesAdded = 0;
  let threadMessagesFetched = 0;

  if (!parentChannel.threads || typeof parentChannel.threads.fetchActive !== 'function') {
    return { threadCount, threadMessageCount: { added: 0, fetched: 0 }, threadMessagesFetched: 0 };
  }

  console.log(`  🧵 Processing threads...`);

  // Active threads
  try {
    const active = await parentChannel.threads.fetchActive();
    for (const thread of active.threads.values()) {
      threadCount++;
      const result = await walkEntireChannel(thread, throttleMs);
      threadMessagesAdded += result.added;
      threadMessagesFetched += result.fetched;
    }
  } catch (err) {
    console.warn(`    ⚠️  Failed to fetch active threads:`, err.message);
  }

  // Archived public threads
  try {
    let hasMore = true;
    let before = null;
    
    while (hasMore) {
      const options = { limit: 100 };
      if (before) options.before = before;
      
      const archived = await parentChannel.threads.fetchArchived(options);
      if (archived.threads.size === 0) break;
      
      for (const thread of archived.threads.values()) {
        threadCount++;
        const result = await walkEntireChannel(thread, throttleMs);
        threadMessagesAdded += result.added;
        threadMessagesFetched += result.fetched;
      }
      
      hasMore = archived.hasMore;
      if (hasMore && archived.threads.size > 0) {
        const oldestThread = Array.from(archived.threads.values())
          .sort((a, b) => a.archiveTimestamp - b.archiveTimestamp)[0];
        before = oldestThread.archiveTimestamp;
      } else {
        hasMore = false;
      }
    }
  } catch (err) {
    console.warn(`    ⚠️  Failed to fetch archived threads:`, err.message);
  }

  // Archived private threads
  if (typeof parentChannel.threads.fetchPrivateArchived === "function") {
    try {
      let hasMore = true;
      let before = null;
      
      while (hasMore) {
        const options = { limit: 100 };
        if (before) options.before = before;
        
        const privArchived = await parentChannel.threads.fetchPrivateArchived(options);
        if (privArchived.threads.size === 0) break;
        
        for (const thread of privArchived.threads.values()) {
          threadCount++;
          const result = await walkEntireChannel(thread, throttleMs);
          threadMessagesAdded += result.added;
          threadMessagesFetched += result.fetched;
        }
        
        hasMore = privArchived.hasMore;
        if (hasMore && privArchived.threads.size > 0) {
          const oldestThread = Array.from(privArchived.threads.values())
            .sort((a, b) => a.archiveTimestamp - b.archiveTimestamp)[0];
          before = oldestThread.archiveTimestamp;
        } else {
          hasMore = false;
        }
      }
    } catch (err) {
      console.warn(`    ⚠️  Failed to fetch private archived threads:`, err.message);
    }
  }

  if (threadCount > 0) {
    console.log(`  ✓ Threads: ${threadCount} threads, ${threadMessagesFetched} fetched, ${threadMessagesAdded} added`);
  }

  return { 
    threadCount, 
    threadMessageCount: { added: threadMessagesAdded, fetched: threadMessagesFetched },
    threadMessagesFetched 
  };
}

/**
 * NUCLEAR OPTION: Walk every single channel from start to finish
 */
async function nuclearBackfill(client, options = {}) {
  const {
    throttleMs = 50,
    guildIds = null,
    channelIds = null,
    skipThreads = false
  } = options;

  console.log('\n' + '='.repeat(70));
  console.log('💣 NUCLEAR BACKFILL - WALKING EVERYTHING FROM START TO FINISH');
  console.log('='.repeat(70));
  console.log(`Strategy: BRUTE FORCE - Fetch every message, let DB handle duplicates`);
  console.log(`Settings: throttle=${throttleMs}ms, skipThreads=${skipThreads}`);
  
  if (guildIds) console.log(`Filtering: ${guildIds.length} guild(s)`);
  if (channelIds) console.log(`Filtering: ${channelIds.length} channel(s)`);
  
  // Get initial database stats
  const statsBefore = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM messages) as messages,
      (SELECT COUNT(*) FROM reactions) as reactions,
      (SELECT COUNT(*) FROM authors) as authors,
      (SELECT COUNT(*) FROM guilds) as guilds,
      (SELECT COUNT(*) FROM message_attachments) as attachments,
      (SELECT COUNT(*) FROM message_embeds) as embeds,
      (SELECT COUNT(*) FROM message_stickers) as stickers,
      (SELECT COUNT(*) FROM message_mentions) as mentions,
      (SELECT COUNT(*) FROM message_interactions) as interactions
  `).get();
  
  const textChannels = [];
  let grandThreadCount = 0;
  let grandThreadMessageCount = 0;
  let grandChannelMessageCount = 0;
  let grandMessagesFetched = 0;

  // Collect all text channels
  client.guilds.cache.forEach(guild => {
    if (guildIds && !guildIds.includes(guild.id)) return;
    
    guild.channels.cache.forEach(channel => {
      if (channelIds && !channelIds.includes(channel.id)) return;
      
      if (
        channel.isTextBased() &&
        channel.viewable &&
        (channel.type === 0 || channel.type === 5)
      ) {
        textChannels.push(channel);
      }
    });
  });

  console.log(`\nFound ${textChannels.length} channels to walk\n`);

  const startTime = Date.now();

  // Walk each channel and track fetched messages
  for (let i = 0; i < textChannels.length; i++) {
    const channel = textChannels[i];
    console.log(`[${i + 1}/${textChannels.length}] ${channel.guild.name} / #${channel.name}`);
    
    try {
      const result = await walkEntireChannel(channel, throttleMs);
      grandChannelMessageCount += result.added;
      grandMessagesFetched += result.fetched;

      if (!skipThreads) {
        const threadResults = await walkAllThreads(channel, throttleMs);
        grandThreadCount += threadResults.threadCount;
        grandThreadMessageCount += threadResults.threadMessageCount.added;
        grandMessagesFetched += threadResults.threadMessagesFetched;
      }
    } catch (e) {
      console.error(`❌ Error walking ${channel.name}:`, e.message);
    }
  }

  const endTime = Date.now();
  const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(1);

  // Get final database stats
  const statsAfter = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM messages) as messages,
      (SELECT COUNT(*) FROM reactions) as reactions,
      (SELECT COUNT(*) FROM authors) as authors,
      (SELECT COUNT(*) FROM guilds) as guilds,
      (SELECT COUNT(*) FROM message_attachments) as attachments,
      (SELECT COUNT(*) FROM message_embeds) as embeds,
      (SELECT COUNT(*) FROM message_stickers) as stickers,
      (SELECT COUNT(*) FROM message_mentions) as mentions,
      (SELECT COUNT(*) FROM message_interactions) as interactions
  `).get();

  // Calculate deltas
  const messagesAdded = statsAfter.messages - statsBefore.messages;
  const reactionsAdded = statsAfter.reactions - statsBefore.reactions;
  const authorsAdded = statsAfter.authors - statsBefore.authors;
  const attachmentsAdded = statsAfter.attachments - statsBefore.attachments;
  const embedsAdded = statsAfter.embeds - statsBefore.embeds;
  const stickersAdded = statsAfter.stickers - statsBefore.stickers;
  const mentionsAdded = statsAfter.mentions - statsBefore.mentions;
  const interactionsAdded = statsAfter.interactions - statsBefore.interactions;

  console.log('\n' + '='.repeat(70));
  console.log('✅ NUCLEAR BACKFILL COMPLETE');
  console.log('='.repeat(70));
  console.log('\n📊 PROCESSING SUMMARY:');
  console.log(`  Channels processed: ${textChannels.length}`);
  console.log(`  Threads processed: ${grandThreadCount}`);
  console.log(`  Duration: ${durationMinutes} minutes`);
  
  console.log('\n📥 MESSAGES FETCHED FROM DISCORD:');
  console.log(`  Messages fetched: ${grandMessagesFetched.toLocaleString()}`);
  console.log(`  Messages added to DB: ${messagesAdded.toLocaleString()}`);
  console.log(`  Messages skipped (duplicates): ${(grandMessagesFetched - messagesAdded).toLocaleString()}`);
  
  console.log('\n💾 DATABASE TOTALS (BEFORE → AFTER):');
  console.log(`  Messages: ${statsBefore.messages.toLocaleString()} → ${statsAfter.messages.toLocaleString()} (+${messagesAdded.toLocaleString()})`);
  console.log(`  Reactions: ${statsBefore.reactions.toLocaleString()} → ${statsAfter.reactions.toLocaleString()} (+${reactionsAdded.toLocaleString()})`);
  console.log(`  Authors: ${statsBefore.authors.toLocaleString()} → ${statsAfter.authors.toLocaleString()} (+${authorsAdded.toLocaleString()})`);
  console.log(`  Attachments: ${statsBefore.attachments.toLocaleString()} → ${statsAfter.attachments.toLocaleString()} (+${attachmentsAdded.toLocaleString()})`);
  console.log(`  Embeds: ${statsBefore.embeds.toLocaleString()} → ${statsAfter.embeds.toLocaleString()} (+${embedsAdded.toLocaleString()})`);
  console.log(`  Stickers: ${statsBefore.stickers.toLocaleString()} → ${statsAfter.stickers.toLocaleString()} (+${stickersAdded.toLocaleString()})`);
  console.log(`  Mentions: ${statsBefore.mentions.toLocaleString()} → ${statsAfter.mentions.toLocaleString()} (+${mentionsAdded.toLocaleString()})`);
  console.log(`  Interactions: ${statsBefore.interactions.toLocaleString()} → ${statsAfter.interactions.toLocaleString()} (+${interactionsAdded.toLocaleString()})`);
  console.log(`  Guilds: ${statsAfter.guilds}`);
  
  console.log('\n' + '='.repeat(70) + '\n');
}

module.exports = nuclearBackfill;