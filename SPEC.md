# AI Podcast Summarizer MCP System Specification

This document outlines the design and implementation plan for an AI-powered podcast summarization system built with a modular MCP (Model Context Protocol) architecture.

The system will orchestrate podcast transcript fetching, AI-powered summarization, trend analysis, and optional email delivery through three separate deployable components: a main MCP client backend and two specialized MCP servers.

## 1. Technology Stack

- **Edge Runtime:** Cloudflare Workers (all components)
- **API Framework:** Hono.js (TypeScript-based API framework)
- **AI Processing:** Cloudflare Workers AI (mistral-7b-instruct-v0.1)
- **MCP Implementation:** @modelcontextprotocol/sdk and @hono/mcp
- **Email Service:** Resend SDK
- **External API:** Taddy API for podcast transcripts
- **Frontend:** React/Next.js with Tailwind CSS (separate deployment)

## 2. System Architecture

The system consists of three separate Cloudflare Worker deployments:

### 2.1. MCP Client (Main Backend)
- Orchestrates the entire workflow
- Makes LLM calls using Cloudflare Workers AI
- Communicates with MCP servers via HTTP
- Exposes REST API for frontend

### 2.2. Taddy API MCP Server
- Provides `get_podcast_transcript` tool
- Handles Taddy API authentication and requests
- Returns structured transcript data

### 2.3. Email MCP Server
- Provides `send_summary_email` tool
- Handles email composition and delivery via Resend
- Manages email templates and formatting

## 3. MCP Client (Main Backend) API Endpoints

### 3.1. Podcast Management

- **GET /api/podcasts**
  - Description: Returns list of supported podcasts
  - Response: Array of podcast objects with id, name, description

- **POST /api/summarize**
  - Description: Initiates podcast summarization workflow
  - Expected Payload:
    ```json
    {
      "podcastIds": ["huberman", "allin", "lex"],
      "episodeLimit": 5,
      "email": "user@example.com",
      "sendEmail": true
    }
    ```
  - Response: Summarization results with individual summaries and trend analysis

### 3.2. Status Endpoints

- **GET /api/status**
  - Description: Health check for the main service
  - Response: Service status and MCP server connectivity

## 4. MCP Server Specifications

### 4.1. Taddy API MCP Server

**MCP Tools:**
- `get_podcast_transcript`
  - Parameters: podcastId (string), episodeLimit (number)
  - Returns: Array of episode objects with transcript, title, publishDate
  - Handles Taddy API authentication and rate limiting

**API Endpoints:**
- **POST /mcp** - MCP communication endpoint

**Environment Variables:**
- `TADDY_API_KEY` - Taddy API authentication key

### 4.2. Email MCP Server

**MCP Tools:**
- `send_summary_email`
  - Parameters: recipientEmail (string), summaries (array), trendAnalysis (string)
  - Returns: Email delivery status and message ID
  - Formats content into HTML email template

**API Endpoints:**
- **POST /mcp** - MCP communication endpoint

**Environment Variables:**
- `RESEND_API_KEY` - Resend API key for email delivery

## 5. AI Processing Workflow

### 5.1. Individual Episode Summarization
- Use Cloudflare Workers AI with mistral-7b-instruct-v0.1
- Prompt engineering for consistent summary format
- Extract key insights, main topics, and actionable takeaways
- Process episodes in parallel for efficiency

### 5.2. Trend Analysis
- Second LLM call to synthesize patterns across all summaries
- Identify recurring themes, contradictions, and emerging trends
- Generate meta-insights about the podcast landscape

## 6. Data Structures

### 6.1. Podcast Configuration
```typescript
interface Podcast {
  id: string;
  name: string;
  description: string;
  taddyId: string;
}
```

### 6.2. Episode Summary
```typescript
interface EpisodeSummary {
  title: string;
  publishDate: string;
  keyInsights: string[];
  mainTopics: string[];
  actionableItems: string[];
  fullSummary: string;
}
```

### 6.3. Trend Analysis
```typescript
interface TrendAnalysis {
  recurringThemes: string[];
  emergingTopics: string[];
  contradictions: string[];
  metaInsights: string;
}
```

## 7. Frontend Integration

The React/Next.js frontend will communicate with the MCP Client backend:

- Single-page interface with podcast selection checkboxes
- Email input field with toggle for email delivery
- Loading states with progress indicators
- Accordion display for individual episode summaries
- Dedicated section for cross-cutting trend analysis
- Responsive design with Tailwind CSS

## 8. Environment Configuration

### MCP Client Backend
- `TADDY_MCP_SERVER_URL` - URL of deployed Taddy MCP server
- `EMAIL_MCP_SERVER_URL` - URL of deployed Email MCP server

### Taddy API MCP Server
- `TADDY_API_KEY` - Taddy API authentication

### Email MCP Server
- `RESEND_API_KEY` - Resend email service key

## 9. Deployment Strategy

Each component deploys independently as a Cloudflare Worker:

1. **Taddy API MCP Server** - First deployment, provides transcript fetching
2. **Email MCP Server** - Second deployment, provides email functionality  
3. **MCP Client Backend** - Final deployment, orchestrates the workflow
4. **Frontend** - Separate deployment (Vercel/Netlify) consuming the backend API

## 10. Error Handling and Resilience

- Graceful degradation when MCP servers are unavailable
- Retry logic for external API calls
- Comprehensive error responses for frontend consumption
- Timeout handling for long-running AI processing tasks

## 11. Additional Notes

The modular MCP architecture allows for easy extension with additional podcast sources, summarization models, or delivery channels. Each MCP server can be developed, tested, and deployed independently while maintaining clean separation of concerns.

The system prioritizes performance through parallel processing and efficient use of Cloudflare's edge computing capabilities.