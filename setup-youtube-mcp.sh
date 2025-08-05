#!/bin/bash

echo "🚀 Setting up YouTube MCP Server..."

# Check if .env file exists
if [ ! -f "youtube-mcp-server/.env" ]; then
    echo "📝 Creating YouTube MCP server .env file..."
    cp youtube-mcp-server/env.example youtube-mcp-server/.env
    echo "✅ Created youtube-mcp-server/.env"
    echo "⚠️  Please configure your YouTube API key in youtube-mcp-server/.env"
    echo "   Get your API key from: https://console.cloud.google.com/apis/credentials"
    echo "   Enable YouTube Data API v3 in your Google Cloud Console"
else
    echo "✅ YouTube MCP server .env already exists"
fi

echo ""
echo "📋 YouTube MCP Server Setup Complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Configure your YouTube API key in youtube-mcp-server/.env"
echo "2. Run: ./start-youtube-mcp.sh"
echo "3. Test the connection with your app"
echo ""
echo "📚 YouTube API Setup Guide:"
echo "1. Go to https://console.cloud.google.com/"
echo "2. Create a new project or select existing"
echo "3. Enable YouTube Data API v3"
echo "4. Create credentials (API Key)"
echo "5. Add the API key to youtube-mcp-server/.env" 