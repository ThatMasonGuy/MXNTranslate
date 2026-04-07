# MXNTranslate Discord Bot

Discord bot for message/reaction logging, on-demand translation, auto-translate channels, and reaction-role management.

## Features

- **Reaction-based translation** using language-flag reactions (with channel-level controls).  
- **Message context menu translation** (`Translate`) with per-user preferred language support.  
- **Auto-translate channel mirroring** between a source channel and target-language channel(s), including webhook posting and cleanup tools.  
- **Reaction roles** with create/edit flows and protection handling.  
- **Event tracking/storage** for messages, reactions, user events, and server events in SQLite.

## Commands

This project currently registers the following top-level application commands:

- `/translate` (slash command)
  - `ping`
  - `status`
  - `reaction-roles`
  - `edit-reaction-roles`
  - `set-language`
  - `config block-channel`
  - `config unblock-channel`
  - `config set-announcement`
  - `config remove-announcement`
  - `config view`
  - `auto create`
  - `auto delete`
  - `auto list`
  - `auto cleanup`
- `Translate` (message context menu command)

## Runtime Requirements

- Node.js (project uses CommonJS modules and npm scripts).
- Discord bot token and app/client ID.
- SQLite database file at:
  - `/home/mason/discord_data/discord_tracker.db`
- Translation API credentials:
  - `OPENAI_KEY` is sent in the `x-openai-key` header to `https://mxn.au/translate/post`.

## Environment Setup

Create `bot/.env` with at least:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_discord_application_id
OPENAI_KEY=your_translation_api_key
```

> `deploy-commands.js` loads `.env` from `bot/.env`, while `bot/index.js` also relies on environment variables at runtime.

## Install & Run

```bash
npm install
npm run deploy
npm start
```

### Useful Scripts

```bash
npm run deploy            # Register application commands
npm run deploy:global     # Alias script for command deployment
npm run start             # Start bot
npm run backfill          # Run comprehensive storage backfill
npm run backfill:analyze  # Analyze backfill coverage
npm run setup:events      # Setup event tracking tables
npm run query:events      # Query tracked events
```

## Permissions / Intents Notes

The bot initializes with intents for guilds, messages, reactions, members, voice states, emojis/stickers, invites, webhooks, and moderation events. Ensure these are enabled in the Discord Developer Portal where required.

For feature completeness, the bot should also have permissions such as:

- Read/Send messages in relevant channels
- Manage Webhooks (for auto-translate channels)
- Manage Roles (for reaction-role operations)
- Manage Channels (for auto-translate create/delete flows)
- Manage Server / Manage Guild (for translation config commands)

## Database & Migrations

This repository contains SQL/scripts for translation/event tracking migrations (for example in `bot/scripts/` and top-level `.sql` files). Run the relevant migration/setup scripts before first production start if your DB is missing required tables.

## Project Structure (high level)

- `bot/index.js` — main bot bootstrap and event wiring
- `bot/commands/` — slash + context menu command handlers
- `bot/handlers/` — Discord event handlers
- `bot/services/` — storage + translation services
- `bot/scripts/` — deployment, migration, and maintenance scripts
- `bot/utils/` — backfill and snapshot helpers

## Notes

- Command deployment currently uses global command registration via Discord REST `applicationCommands` route.
- The repository includes additional docs:
  - `TRANSLATION_FEATURES_GUIDE.md`
  - `IMPLEMENTATION_SUMMARY.md`
