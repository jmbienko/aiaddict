# 🎬 YouTube Migration Guide

## Overview

This project has been migrated from **Podcasts** to **YouTube Channels** to provide better transcript availability and easier implementation.

## 🚀 What Changed

### ✅ **Before (Podcasts)**
- Taddy API for podcast metadata
- No transcripts available
- Complex MCP server setup
- Limited content availability

### ✅ **After (YouTube Channels)**
- YouTube Data API v3 for channel metadata
- Guaranteed transcripts via youtube-transcript-api
- Simple MCP server architecture
- Rich video content with descriptions

## 📺 **Supported YouTube Channels**

| Channel | Focus | Content Type | Channel ID |
|---------|-------|--------------|------------|
| **Two Minute Papers** | AI Research Papers | Video summaries | `UCbfYPyITQ-7l4upoX8nvctg` |
| **Lex Fridman** | AI Conversations | Long-form interviews | `UCSHZKyAWb6itEKDFm9WE_AQ` |
| **Yannic Kilcher** | AI Research | Paper reviews | `UCZHmQd67S-4pR5qHs7Fqu5Q` |
| **Computerphile** | Computer Science | Educational content | `UC9-y-6csu5WGm29I7JiwpnA` |

## 🔧 **Setup Instructions**

### 1. **YouTube API Setup**
```bash
# Get your YouTube API key
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create credentials (API Key)
5. Copy the API key
```

### 2. **Configure Environment**
```bash
# Run setup script
./setup-youtube-mcp.sh

# Edit the .env file
nano youtube-mcp-server/.env
# Add: YOUTUBE_API_KEY=your_api_key_here
```

### 3. **Start the System**
```bash
# Start YouTube MCP server
./start-youtube-mcp.sh

# Start main app (in another terminal)
npm run dev
```

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Interface │    │  YouTube MCP     │    │  YouTube Data   │
│                 │◄──►│     Server       │◄──►│      API v3     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   AI Summarizer │    │ youtube-transcript│
│   (Cloudflare)  │    │      -api        │
└─────────────────┘    └──────────────────┘
```

## 🔄 **API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/channels` | GET | Get supported YouTube channels |
| `/api/generate-summary` | POST | Generate summaries from selected channels |
| `/api/status` | GET | Check system status |

## 📊 **Data Flow**

1. **Channel Selection**: User selects YouTube channels from UI
2. **Video Fetching**: MCP server fetches latest videos from YouTube API
3. **Transcript Retrieval**: youtube-transcript-api gets video transcripts
4. **AI Summarization**: Cloudflare AI generates summaries
5. **Results Display**: Summaries shown in web interface

## 🎯 **Benefits**

- ✅ **Guaranteed Transcripts**: YouTube auto-generates captions
- ✅ **Rich Content**: Video descriptions + transcripts
- ✅ **Simple Setup**: No complex API authentication
- ✅ **Real-time Updates**: Latest AI content from YouTube
- ✅ **Cost Effective**: Mostly free APIs

## 🚨 **Limitations**

- ⚠️ **API Quotas**: YouTube API has daily limits
- ⚠️ **Transcript Quality**: Auto-generated captions may have errors
- ⚠️ **Content Dependency**: Relies on YouTube availability

## 🔮 **Future Enhancements**

- [ ] Add more AI YouTube channels
- [ ] Implement video thumbnail display
- [ ] Add video duration filtering
- [ ] Support for custom channel URLs
- [ ] Transcript quality scoring

## 🛠️ **Troubleshooting**

### Common Issues

1. **"YouTube API key not configured"**
   - Run `./setup-youtube-mcp.sh`
   - Add API key to `youtube-mcp-server/.env`

2. **"No transcript available"**
   - Some videos may not have captions
   - Try different videos or channels

3. **"API quota exceeded"**
   - Check YouTube API quotas in Google Cloud Console
   - Consider upgrading API plan

## 📝 **Migration Notes**

- Database schema remains compatible
- MCP server architecture preserved
- UI updated for YouTube channels
- All existing functionality maintained 