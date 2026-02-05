#!/bin/bash
# Quick Bot Server Discovery Script
# Run with: bash find-my-bot.sh

echo "🔍 Searching for your Discord bot server..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Node.js Processes Running:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ps aux | grep node | grep -v grep | head -10
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Ports Being Used by Node:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sudo lsof -i -P -n | grep node | grep LISTEN
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Likely Bot Directories:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
find ~ -maxdepth 3 -type d \( -iname "*bot*" -o -iname "*translate*" -o -iname "*discord*" \) 2>/dev/null
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 PM2 Processes:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if command -v pm2 &> /dev/null; then
    pm2 list
else
    echo "PM2 not installed"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 Files with Express Server Setup:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
find ~ -maxdepth 4 -name "*.js" -o -name "*.mjs" 2>/dev/null | xargs grep -l "express()" 2>/dev/null | head -5
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Systemd Services:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
systemctl list-units --type=service --all | grep -i "bot\|discord\|node" || echo "No relevant services found"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Quick Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Check the Node.js processes above for your bot"
echo "2. Note any ports being used (likely 3000, 8080, etc.)"
echo "3. Navigate to one of the bot directories found"
echo "4. Look for server.js, index.js, or app.js files"
echo ""
echo "💡 TIP: If you see a port like ':3000', try: curl http://localhost:3000"
echo "         Or check what's there: cd <bot-directory> && ls -la"