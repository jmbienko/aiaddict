#!/bin/bash

echo "📧 Starting Email MCP Server..."

# Check if .env file exists
if [ ! -f "email-mcp-server/.env" ]; then
    echo "❌ Email configuration not found!"
    echo "Please create email-mcp-server/.env with your email credentials:"
    echo ""
    echo "EMAIL_HOST=smtp.gmail.com"
    echo "EMAIL_PORT=587"
    echo "EMAIL_USER=your-email@gmail.com"
    echo "EMAIL_PASS=your-app-password"
    echo "EMAIL_FROM=your-email@gmail.com"
    echo ""
    echo "For Gmail, you'll need to:"
    echo "1. Enable 2-factor authentication"
    echo "2. Generate an App Password"
    echo "3. Use the App Password as EMAIL_PASS"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "email-mcp-server/node_modules" ]; then
    echo "📦 Installing email server dependencies..."
    cd email-mcp-server && npm install && cd ..
fi

# Start the HTTP server
echo "🚀 Starting Email MCP HTTP Server..."
cd email-mcp-server && npm run http 