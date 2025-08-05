#!/bin/bash

echo "🎬 Starting YouTube MCP Server..."

# Check if .env file exists and has API key
if [ ! -f "youtube-mcp-server/.env" ]; then
    echo "❌ YouTube MCP server .env file not found"
    echo "Please run: ./setup-youtube-mcp.sh"
    exit 1
fi

# Check if API key is configured
if ! grep -q "YOUTUBE_API_KEY=your_youtube_api_key_here" youtube-mcp-server/.env; then
    echo "✅ YouTube API key configured"
else
    echo "❌ YouTube API key not configured"
    echo "Please add your YouTube API key to youtube-mcp-server/.env"
    exit 1
fi

# Start the YouTube MCP server
echo "🚀 Starting YouTube MCP server..."
cd youtube-mcp-server && npm start 