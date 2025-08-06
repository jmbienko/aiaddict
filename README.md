# 🎧 AI Addict - Podcast Summarization MCP Server

> **AI-powered productivity tool that automatically summarizes YouTube AI podcast episodes and delivers key insights via email**

## 🚀 Project Overview

AI Addict is a **Model Context Protocol (MCP) server** built for the Vibe Coding Challenge that helps users stay productive and informed in the fast-moving AI space. It automatically processes YouTube AI podcast episodes, generates intelligent summaries, analyzes trends across multiple channels, and delivers insights directly to your email.

## 🛠️ MCP Tools & Features

### 1. **Content Summarization Tool**
- **Purpose**: Automatically summarizes YouTube podcast episodes using AI
- **Input**: YouTube video URLs and content from AI-focused channels
- **Output**: Structured summaries with key insights and actionable items
- **Productivity Value**: Saves hours of listening time → minutes of reading

### 2. **Trend Analysis Tool**
- **Purpose**: Analyzes patterns across multiple episodes and channels
- **Input**: Multiple episode summaries from various AI channels
- **Output**: Recurring themes, emerging topics, and meta insights
- **Productivity Value**: Helps identify important trends and stay updated

### 3. **Email Delivery Tool**
- **Purpose**: Sends comprehensive insights directly to user's email
- **Input**: Summaries and trend analysis
- **Output**: Beautifully formatted email with all insights
- **Productivity Value**: Makes insights easily accessible and shareable

## 🏗️ Technical Architecture

### **External APIs & Services**
- **YouTube Data API v3**: Fetches channel videos and metadata
- **Cloudflare Workers AI**: Generates AI summaries and analysis
- **SMTP (Gmail)**: Sends formatted emails
- **D1 Database**: Stores request history and summaries

### **Infrastructure**
- **Cloudflare Workers**: Serverless runtime environment
- **Hono**: Modern web framework for the API
- **Drizzle ORM**: Type-safe database operations
- **Model Context Protocol**: Standardized tool integration

### **Tool Integration Flow**
```
YouTube API → Content Fetching Tool
     ↓
Cloudflare AI → Summarization Tool
     ↓
D1 Database → Storage Tool
     ↓
Trend Analysis → Pattern Recognition Tool
     ↓
Email MCP → Delivery Tool
```

## 🎯 Supported AI Podcast Channels

The application comes pre-configured with popular AI-focused YouTube channels:

- **Two Minute Papers** - AI research summaries
- **Matthew Berman** - AI news and tutorials
- **AI Explained** - Deep dives into AI concepts
- **Matt Wolfe** - AI tools and trends
- **David Shapiro** - AI philosophy and future
- **Yannic Kilcher** - AI research papers

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Cloudflare account
- YouTube Data API v3 key
- Gmail account (for email delivery)

### 1. Clone and Setup
```bash
git clone https://github.com/jmbienko/aiaddict.git
cd aiaddict
npm install
```

### 2. Environment Configuration
Create `.dev.vars` file:
```bash
YOUTUBE_API_KEY=your_youtube_api_key_here
EMAIL_MCP_SERVER_URL=http://localhost:3001
```

### 3. Email MCP Server Setup
```bash
cd email-mcp-server
npm install
cp env.example .env
# Edit .env with your Gmail credentials
npm run http
```

### 4. Start Development Server
```bash
# In the main project directory
npm run dev
```

### 5. Access the Application
Open `http://localhost:8787` in your browser

## 📧 Email Configuration

The email MCP server requires Gmail SMTP configuration:

```bash
# In email-mcp-server/.env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com
```

**Note**: Use an App Password, not your regular Gmail password.

## 🎨 Features

### **Smart Content Processing**
- Automatic video content extraction
- AI-powered summarization with key insights
- Actionable items extraction
- Multi-channel trend analysis

### **Modern UI/UX**
- Clean, responsive interface
- Real-time progress indicators
- Error handling and user feedback
- Email delivery confirmation

### **Productivity Focus**
- Batch processing of multiple channels
- Configurable episode limits
- Email delivery for offline access
- Trend identification across channels

## 🏆 Vibe Coding Challenge Compliance

This project meets all Vibe Coding Challenge requirements:

✅ **Fiberplane Codegen**: Used for initial MCP server build  
✅ **Local Development**: Downloaded and refined with Cursor  
✅ **Cloudflare Workers**: Deployed on Cloudflare  
✅ **3+ MCP Tools**: Content summarization, trend analysis, email delivery  
✅ **URL Access**: Deployed and accessible via URL  
✅ **Productivity Focus**: Helps users stay informed and productive  

## 📁 Project Structure

```
PodcastAddict/
├── src/
│   ├── index.ts          # Main application (Hono + frontend)
│   └── db/
│       └── schema.ts     # Database schema
├── email-mcp-server/     # Email MCP server
│   ├── server.js         # MCP server implementation
│   ├── http-server.js    # HTTP server for email tools
│   └── package.json
├── drizzle/              # Database migrations
├── .dev.vars             # Local environment variables
├── wrangler.jsonc        # Cloudflare Workers config
└── README.md
```

## 🔧 Development Commands

```bash
# Database operations
npm run db:setup          # Setup database with migrations
npm run db:generate       # Generate new migration
npm run db:migrate        # Apply migrations

# Development
npm run dev               # Start development server
npm run deploy            # Deploy to Cloudflare Workers

# Email MCP Server
cd email-mcp-server
npm run http              # Start email server
```

## 🌟 Key Benefits

### **For Content Creators**
- Stay updated on AI trends across multiple sources
- Identify emerging topics and themes
- Save time on content research

### **For AI Enthusiasts**
- Efficiently consume AI content
- Get actionable insights from episodes
- Track industry trends over time

### **For Productivity Seekers**
- Automate content consumption
- Get insights delivered to email
- Focus on what matters most

## 🤝 Contributing

This project was built for the Vibe Coding Challenge. Feel free to fork and enhance it with additional features like:

- More AI podcast channels
- Advanced trend analysis
- Custom email templates
- Mobile app integration
- Social media sharing

## 📄 License

MIT License - feel free to use this project for learning and development.

---

**Built with ❤️ for the Vibe Coding Challenge using Fiberplane Codegen, Cloudflare Workers, and Model Context Protocol**


