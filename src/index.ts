import { createFiberplane, createOpenAPISpec } from "@fiberplane/hono";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { eq, desc, gte } from "drizzle-orm";
import * as schema from "./db/schema";

type Bindings = {
  DB: D1Database;
  AI: Ai;
  YOUTUBE_MCP_SERVER_URL: string;
  EMAIL_MCP_SERVER_URL: string;
  YOUTUBE_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for frontend integration
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Supported YouTube channels configuration
const SUPPORTED_CHANNELS = [
  {
    id: "two-minute-papers",
    name: "Two Minute Papers",
    description: "AI research paper summaries and breakthroughs",
    channelId: "UCbfYPyITQ-7l4upoX8nvctg",
    thumbnail: "https://yt3.googleusercontent.com/ytc/AIdro_ljAkSpv16cJNUsE_rI1X-Kz9s78w1WNojUga-aZ1uVzEQ=s160-c-k-c0x00ffffff-no-rj"
  },
  {
    id: "matthew-berman",
    name: "Matthew Berman",
    description: "AI, Open Source, Generative Art, AI Art, Futurism, ChatGPT, Large Language Models",
    channelId: "UCawZsQWqfGSbCI5yjkdVkTA",
    thumbnail: "https://yt3.ggpht.com/FLJEnb2WnG3g0GV9GbGbdvkMKqInA0WcEzQkL-haJ0mBSDHl5wrUrmQ2w1_wyeoonmKl5DWvVwk=s88-c-k-c0xffffffff-no-rj-mo"
  },
  {
    id: "ai-explained",
    name: "AI Explained",
    description: "Covering the biggest news of the century - the arrival of smarter-than-human AI",
    channelId: "UCNJ1Ymd5yFuUPtn21xtRbbw",
    thumbnail: "https://yt3.ggpht.com/GFuvgO3IZvs5XkYOxyLoWQto2lyY6-7Ob-7sfZRyoann4eBgvBMxuGgSVU1cvBgRCgAn41St7g=s88-c-k-c0xffffffff-no-rj-mo"
  },
  {
    id: "matt-wolfe",
    name: "Matt Wolfe",
    description: "AI News Breakdowns every Saturday and other cool nerdy tech and AI stuff",
    channelId: "UChpleBmo18P08aKCIgti38g",
    thumbnail: "https://yt3.ggpht.com/Xfsv8L8S4Dt2PPpgaexoMluK9gkm4H77TY-Sae7DbY8qKSaGI0FOS_uzw65kxVtdQlYvc02bB6k=s88-c-k-c0xffffffff-no-rj-mo"
  },
  {
    id: "david-shapiro",
    name: "David Shapiro",
    description: "AI Maximalist, Anti-Doomer, Psychedelics Advocate, Post-Labor Economics Evangelist, Meaning Economy Pioneer, Postnihilism",
    channelId: "UCvKRFNawVcuz4b9ihUTApCg",
    thumbnail: "https://yt3.googleusercontent.com/3PuQVkaSA3n4B-JTnn3lfamE87B4Yt_zzLSLmHt2pQCT_roXvNIEmOaOEIvhTvX8PmtxCKIZ9ZI=s160-c-k-c0x00ffffff-no-rj"
  },
  {
    id: "yannic-kilcher",
    name: "Yannic Kilcher",
    description: "AI research paper reviews and discussions",
    channelId: "UCZHmQd67S-4pR5qHs7Fqu5Q",
    thumbnail: "https://yt3.googleusercontent.com/ytc/AIdro_nqmmpWC-iPIeVF4grbJGcGmoWyYX0E6_PFGITlKv7jTMrh=s160-c-k-c0x00ffffff-no-rj"
  }
];

// MCP client helper functions - Note: MCP servers communicate via stdio, not HTTP
// For now, we'll implement direct API calls to YouTube Data API

// Email MCP Server communication
async function callEmailMcpServer(method: string, args: any): Promise<any> {
  // This would communicate with the email MCP server via stdio
  // For now, we'll implement a simple HTTP-based approach
  try {
    const response = await fetch(`${process.env.EMAIL_MCP_SERVER_URL || 'http://localhost:3001'}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Email MCP server error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Email MCP server communication error:', error);
    throw error;
  }
}
async function getChannelVideos(channelId: string, maxResults: number = 5, env: any) {
  const YOUTUBE_API_KEY = env.YOUTUBE_API_KEY;
  console.log('🔑 Using API key:', YOUTUBE_API_KEY ? YOUTUBE_API_KEY.substring(0, 10) + '...' : 'NOT SET');
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  // Get channel's upload playlist ID
  console.log('🔍 Fetching channel info for:', channelId);
  const channelResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`
  );
  
  console.log('🔍 Channel API Response Status:', channelResponse.status, channelResponse.statusText);
  
  if (!channelResponse.ok) {
    const errorText = await channelResponse.text();
    console.error('✘ [ERROR] YouTube API Error Response:', errorText);
    console.error('✘ [ERROR] Channel URL that failed:', `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY.substring(0, 10)}...`);
    throw new Error(`YouTube API error: ${channelResponse.status} - ${errorText}`);
  }
  
  const channelData = await channelResponse.json() as any;
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  
  if (!uploadsPlaylistId) {
    throw new Error('Could not find uploads playlist for channel');
  }
  
  // Add a small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 100));

  // Get videos from uploads playlist
  console.log('🔍 Fetching videos for playlist:', uploadsPlaylistId);
  const videosResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
  );
  
  console.log('🔍 Videos API Response Status:', videosResponse.status, videosResponse.statusText);
  
  if (!videosResponse.ok) {
    const errorText = await videosResponse.text();
    console.error('✘ [ERROR] YouTube Videos API Error Response:', errorText);
    console.error('✘ [ERROR] Videos URL that failed:', `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY.substring(0, 10)}...`);
    throw new Error(`YouTube API error: ${videosResponse.status} - ${errorText}`);
  }
  
  const videosData = await videosResponse.json() as any;
  
  return videosData.items?.map((item: any) => ({
    id: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnail: item.snippet.thumbnails?.high?.url,
    channelTitle: item.snippet.channelTitle
  })) || [];
}

async function getVideoInfo(videoId: string, env: any) {
  const YOUTUBE_API_KEY = env.YOUTUBE_API_KEY;
  console.log('🔑 Using API key for video info:', YOUTUBE_API_KEY ? YOUTUBE_API_KEY.substring(0, 10) + '...' : 'NOT SET');
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
  );
  
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }
  
  const data = await response.json() as any;
  const video = data.items?.[0];
  
  if (!video) {
    throw new Error('Video not found');
  }
  
  return {
    videoId,
    title: video.snippet.title,
    description: video.snippet.description,
    publishedAt: video.snippet.publishedAt,
    channelTitle: video.snippet.channelTitle
  };
}

// AI summarization functions
async function summarizeEpisode(ai: Ai, transcript: string, title: string): Promise<{
  keyInsights: string[];
  mainTopics: string[];
  actionableItems: string[];
  fullSummary: string;
}> {
  const prompt = `Analyze this podcast episode transcript and provide a structured summary:

Title: ${title}
Transcript: ${transcript}

Please provide:
1. Key Insights (3-5 main takeaways)
2. Main Topics (3-5 core subjects discussed)
3. Actionable Items (2-4 specific actions listeners can take)
4. Full Summary (2-3 paragraph overview)

Format your response as JSON with the following structure:
{
  "keyInsights": ["insight1", "insight2", ...],
  "mainTopics": ["topic1", "topic2", ...],
  "actionableItems": ["action1", "action2", ...],
  "fullSummary": "detailed summary text"
}`;

  const response = await ai.run("@cf/mistral/mistral-7b-instruct-v0.1", {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1000
  }) as any;

  try {
    return JSON.parse(response.response || "{}");
  } catch (error) {
    // Fallback parsing if JSON is malformed
    return {
      keyInsights: ["Unable to parse insights"],
      mainTopics: ["Unable to parse topics"],
      actionableItems: ["Unable to parse actions"],
      fullSummary: (response.response as string) || "Unable to generate summary"
    };
  }
}

async function analyzeTrends(ai: Ai, summaries: any[]): Promise<{
  recurringThemes: string[];
  emergingTopics: string[];
  contradictions: string[];
  metaInsights: string;
}> {
  const summariesText = summaries.map(s => 
    `${s.title}: ${s.fullSummary}\nKey Insights: ${s.keyInsights.join(", ")}\nTopics: ${s.mainTopics.join(", ")}`
  ).join("\n\n");

  const prompt = `Analyze these podcast episode summaries to identify cross-cutting patterns and trends:

${summariesText}

Please identify:
1. Recurring Themes (3-5 themes that appear across multiple episodes)
2. Emerging Topics (2-4 new or trending subjects)
3. Contradictions (1-3 conflicting viewpoints or advice)
4. Meta Insights (2-3 paragraphs about the overall landscape and implications)

Format your response as JSON:
{
  "recurringThemes": ["theme1", "theme2", ...],
  "emergingTopics": ["topic1", "topic2", ...],
  "contradictions": ["contradiction1", "contradiction2", ...],
  "metaInsights": "detailed analysis text"
}`;

  const response = await ai.run("@cf/mistral/mistral-7b-instruct-v0.1", {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 800
  }) as any;

  try {
    return JSON.parse(response.response || "{}");
  } catch (error) {
    return {
      recurringThemes: ["Unable to parse themes"],
      emergingTopics: ["Unable to parse topics"],
      contradictions: ["Unable to parse contradictions"],
      metaInsights: (response.response as string) || "Unable to generate meta insights"
    };
  }
}

async function generateWeeklyOverview(ai: Ai, episodeSummaries: any[]): Promise<{
  executiveSummary: string;
  keyTrends: string[];
  topInsights: string[];
  channelHighlights: string[];
  recommendations: string[];
}> {
  const prompt = `Create a comprehensive weekly overview based on these recent YouTube video summaries:

${episodeSummaries.map((episode, index) => `
Video ${index + 1}: ${episode.title} (${episode.channel})
Published: ${episode.publishDate}
Summary: ${episode.summary}
Key Insights: ${episode.keyInsights.join(', ')}
Main Topics: ${episode.mainTopics.join(', ')}
Actionable Items: ${episode.actionableItems.join(', ')}
`).join('\n')}

Please provide a comprehensive weekly overview with:
1. Executive Summary (2-3 paragraph overview of the week's content)
2. Key Trends (3-5 major trends or patterns observed)
3. Top Insights (5-7 most important takeaways)
4. Channel Highlights (notable contributions from each channel)
5. Recommendations (3-5 actionable recommendations based on the content)

Format your response as JSON with the following structure:
{
  "executiveSummary": "Comprehensive overview of the week's content...",
  "keyTrends": ["trend1", "trend2", "trend3"],
  "topInsights": ["insight1", "insight2", "insight3"],
  "channelHighlights": ["highlight1", "highlight2"],
  "recommendations": ["recommendation1", "recommendation2"]
}`;

  const response = await ai.run("@cf/mistral/mistral-7b-instruct-v0.1", {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1000
  }) as any;

  try {
    return JSON.parse(response.response || "{}");
  } catch (error) {
    return {
      executiveSummary: "Error generating weekly overview",
      keyTrends: [],
      topInsights: [],
      channelHighlights: [],
      recommendations: []
    };
  }
}




// Web Interface Route
app.get("/", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Podcast Insights - AI Addict</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f9fafb;
            color: #333333;
            line-height: 1.6;
            font-size: 16px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 16px;
        }
        
        /* Header */
        .header {
            position: sticky;
            top: 0;
            background: white;
            border-bottom: 1px solid #e5e7eb;
            padding: 16px 0;
            z-index: 100;
            backdrop-filter: blur(8px);
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .logo {
            display: flex;
            align-items: center;
        }
        
        .logo-img {
            height: 40px;
            width: auto;
            max-width: 160px;
            object-fit: contain;
        }
        
        @media (max-width: 768px) {
            .logo-img {
                height: 32px;
                max-width: 120px;
            }
        }
        
        .settings-btn {
            background: none;
            border: none;
            padding: 8px;
            border-radius: 8px;
            cursor: pointer;
            color: #6b7280;
            transition: all 0.2s ease;
        }
        
        .settings-btn:hover {
            background: #f3f4f6;
            color: #22BFFD;
        }
        
        /* Toolbar */
        .toolbar {
            padding: 24px 0;
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
        }
        
        .btn {
            background: #22BFFD;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn:hover {
            background: #1ea8e0;
            transform: scale(1.02);
        }
        
        .btn:focus {
            outline: 2px solid #22BFFD;
            outline-offset: 2px;
        }
        
        .btn-secondary {
            background: white;
            color: #22BFFD;
            border: 1px solid #22BFFD;
        }
        
        .btn-secondary:hover {
            background: #f0f9ff;
        }
        
        .next-send {
            color: #6b7280;
            font-size: 14px;
            margin-left: auto;
        }
        
        .selection-info {
            color: #22BFFD;
            font-size: 14px;
            font-weight: 500;
            margin-left: 16px;
        }
        
        /* Main Content */
        .main-content {
            margin-bottom: 32px;
        }
        
        /* Episode Cards */
        .episodes-section h2 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 24px;
            color: #333333;
        }
        
        .episode-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
            border: 1px solid #e5e7eb;
        }
        
        .episode-card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transform: translateY(-1px);
        }
        
        .episode-header {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
        }
        
        .episode-thumbnail {
            width: 80px;
            height: 60px;
            border-radius: 8px;
            background: #f3f4f6;
            flex-shrink: 0;
        }
        
        .episode-info h3 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #333333;
        }
        
        .episode-date {
            font-size: 14px;
            color: #6b7280;
        }
        
        .episode-takeaways {
            margin-bottom: 16px;
        }
        
        .episode-takeaways ul {
            list-style: none;
            padding: 0;
        }
        
        .episode-takeaways li {
            padding: 4px 0;
            color: #374151;
            position: relative;
            padding-left: 16px;
        }
        
        .episode-takeaways li:before {
            content: "•";
            color: #22BFFD;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        
        .episode-quote {
            font-style: italic;
            color: #6b7280;
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            margin-bottom: 16px;
            border-left: 3px solid #22BFFD;
        }
        
        .episode-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        .btn-small {
            padding: 8px 16px;
            font-size: 14px;
        }
        
        .expand-link {
            color: #22BFFD;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
        }
        
        .expand-link:hover {
            text-decoration: underline;
        }
        
        /* Trends Panel */
        .trends-section {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
            margin-bottom: 32px;
            text-align: center;
        }
        
        .trends-section h2 {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #333333;
        }
        
        .trend-chart {
            height: 300px;
            background: #f9fafb;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .trend-chart canvas {
            max-width: 100%;
            max-height: 100%;
            border-radius: 8px;
        }
        
        .trend-table {
            width: 100%;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .trend-table th,
        .trend-table td {
            padding: 8px 0;
            text-align: left;
            font-size: 14px;
        }
        
        .trend-table th {
            font-weight: 600;
            color: #374151;
        }
        
        .trend-change {
            font-weight: 500;
        }
        
        .trend-change.positive {
            color: #059669;
        }
        
        .trend-change.negative {
            color: #dc2626;
        }
        

        
        /* Modals */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            backdrop-filter: blur(4px);
        }
        
        .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-content {
            background: white;
            border-radius: 12px;
            padding: 32px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }
        
        .modal-header h3 {
            font-size: 20px;
            font-weight: 600;
            color: #333333;
        }
        
        .modal-close {
            background: none;
            border: none;
            font-size: 32px;
            cursor: pointer;
            color: #6b7280;
            padding: 4px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #374151;
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s ease;
        }
        
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #22BFFD;
        }
        
        .toggle-switch {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .toggle-switch input[type="checkbox"] {
            width: 40px;
            height: 20px;
            appearance: none;
            background: #d1d5db;
            border-radius: 10px;
            position: relative;
            cursor: pointer;
            transition: background 0.2s ease;
        }
        
        .toggle-switch input[type="checkbox"]:checked {
            background: #22BFFD;
        }
        
        .toggle-switch input[type="checkbox"]::before {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: white;
            top: 2px;
            left: 2px;
            transition: transform 0.2s ease;
        }
        
        .toggle-switch input[type="checkbox"]:checked::before {
            transform: translateX(20px);
        }
        
        /* Loading States */
        .loading {
            display: none;
            text-align: center;
            padding: 32px;
        }
        
        .loading.show {
            display: block;
        }
        
        .spinner {
            border: 3px solid #f3f4f6;
            border-top: 3px solid #22BFFD;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Results */
        .results {
            display: none;
            margin-top: 32px;
        }
        
        .results.show {
            display: block;
        }
        
        .success {
            background: #d1fae5;
            color: #065f46;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
        
        .error {
            background: #fee2e2;
            color: #991b1b;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
        
        .warning {
            background: #fef3c7;
            color: #92400e;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
        
        /* Channel Selection */
        .channel-selection {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
            margin-bottom: 32px;
        }
        
        .channel-selection h2 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333333;
        }
        
        .channel-selection p {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 20px;
            line-height: 1.5;
        }
        
        .channel-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
        }
        
        .channel-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: white;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .channel-card:hover {
            border-color: #22BFFD;
            box-shadow: 0 4px 12px rgba(34, 191, 253, 0.15);
            transform: translateY(-1px);
        }
        
        .channel-card.selected {
            border-color: #22BFFD;
            background: #f0f9ff;
            box-shadow: 0 4px 12px rgba(34, 191, 253, 0.2);
            position: relative;
        }
        
        .channel-card.selected::after {
            content: '✓';
            position: absolute;
            top: 12px;
            right: 12px;
            background: #22BFFD;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
        }
        
        .channel-header {
            display: flex;
            gap: 16px;
            margin-bottom: 12px;
        }
        
        .channel-thumbnail {
            width: 60px;
            height: 60px;
            border-radius: 8px;
            object-fit: cover;
            flex-shrink: 0;
        }
        
        .channel-info {
            flex: 1;
        }
        
        .channel-card h3 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 6px;
            color: #333333;
        }
        
        .channel-card p {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.4;
            margin: 0;
        }
        

        

        
        .status {
            text-align: center;
            color: #6b7280;
            font-style: italic;
            padding: 20px;
        }
            border-color: #667eea;
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .checkbox-group input[type="checkbox"] {
            width: auto;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        .loading.show {
            display: block;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .results {
            display: none;
            margin-top: 40px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #667eea;
        }
        .results.show {
            display: block;
        }
        .results h3 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.3rem;
        }
        .summary-item {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .summary-item h4 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .summary-item p {
            color: #666;
            line-height: 1.6;
        }
        .insights-list {
            list-style: none;
            margin-top: 15px;
        }
        .insights-list li {
            background: #e8f4fd;
            padding: 8px 12px;
            margin: 5px 0;
            border-radius: 6px;
            border-left: 3px solid #667eea;
        }
        .error {
            background: #fee;
            color: #c33;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #c33;
        }
        .status {
            background: #e8f5e8;
            color: #2d5a2d;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #4caf50;
        }
        .weekly-overview {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 25px;
            margin: 20px 0;
            border: 1px solid #dee2e6;
        }
        .overview-section {
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 1px solid #dee2e6;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 12px;
            padding: 20px;
            border: 2px solid #22BFFD;
        }
        
        .episode-summary {
            margin-bottom: 20px;
            border-left: 4px solid #22BFFD;
        }
        .overview-section:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        .overview-section h4 {
            color: #495057;
            margin-bottom: 12px;
            font-size: 1.2rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <div class="logo">
                    <h1 style="margin: 0; color: #22BFFD; font-size: 32px; font-weight: bold;">AI Addict</h1>
                </div>
                <button class="settings-btn" onclick="showSettingsModal()">
                    ⚙️
                </button>
        </div>
        </header>

        <!-- Channel Selection -->
        <div class="channel-selection">
            <h2>Current Channels</h2>
            <div class="channel-grid" id="podcastGrid">
                <div class="channel-card" id="channel-two-minute-papers">
                    <div class="channel-header">
                        <img src="https://yt3.ggpht.com/ytc/AIf8zZQJ8vXgQj8vXgQj8vXgQj8vXgQj8vXgQj8vXgQj8vXg=s176-c-k-c0x00ffffff-no-rj" alt="Two Minute Papers" class="channel-thumbnail" onerror="this.style.display='none'">
                        <div class="channel-info">
                            <h3>Two Minute Papers</h3>
                            <p>AI research paper summaries and breakthroughs</p>
                        </div>
                    </div>
                </div>
                <div class="channel-card" onclick="toggleChannel('matthew-berman')" id="channel-matthew-berman">
                    <div class="channel-header">
                        <img src="https://yt3.ggpht.com/FLJEnb2WnG3g0GV9GbGbdvkMKqInA0WcEzQkL-haJ0mBSDHl5wrUrmQ2w1_wyeoonmKl5DWvVwk=s88-c-k-c0xffffffff-no-rj-mo" alt="Matthew Berman" class="channel-thumbnail">
                        <div class="channel-info">
                            <h3>Matthew Berman</h3>
                            <p>AI, Open Source, Generative Art, AI Art, Futurism, ChatGPT, Large Language Models</p>
                        </div>
                    </div>
                </div>
                <div class="channel-card" onclick="toggleChannel('ai-explained')" id="channel-ai-explained">
                    <div class="channel-header">
                        <img src="https://yt3.ggpht.com/GFuvgO3IZvs5XkYOxyLoWQto2lyY6-7Ob-7sfZRyoann4eBgvBMxuGgSVU1cvBgRCgAn41St7g=s88-c-k-c0xffffffff-no-rj-mo" alt="AI Explained" class="channel-thumbnail">
                        <div class="channel-info">
                            <h3>AI Explained</h3>
                            <p>Covering the biggest news of the century - the arrival of smarter-than-human AI</p>
                        </div>
                    </div>
                </div>
                <div class="channel-card" onclick="toggleChannel('matt-wolfe')" id="channel-matt-wolfe">
                    <div class="channel-header">
                        <img src="https://yt3.ggpht.com/Xfsv8L8S4Dt2PPpgaexoMluK9gkm4H77TY-Sae7DbY8qKSaGI0FOS_uzw65kxVtdQlYvc02bB6k=s88-c-k-c0xffffffff-no-rj-mo" alt="Matt Wolfe" class="channel-thumbnail">
                        <div class="channel-info">
                            <h3>Matt Wolfe</h3>
                            <p>AI News Breakdowns every Saturday and other cool nerdy tech and AI stuff</p>
                        </div>
                    </div>
                </div>
                <div class="channel-card" onclick="toggleChannel('yannic-kilcher')" id="channel-yannic-kilcher">
                    <div class="channel-header">
                        <img src="https://yt3.ggpht.com/ytc/AIf8zZQJ8vXgQj8vXgQj8vXgQj8vXgQj8vXgQj8vXgQj8vXg=s176-c-k-c0x00ffffff-no-rj" alt="Yannic Kilcher" class="channel-thumbnail">
                        <div class="channel-info">
                            <h3>Yannic Kilcher</h3>
                            <p>AI research paper reviews and discussions</p>
                        </div>
                    </div>
                </div>
                <div class="channel-card" onclick="toggleChannel('david-shapiro')" id="channel-david-shapiro">
                    <div class="channel-header">
                        <img src="https://yt3.googleusercontent.com/3PuQVkaSA3n4B-JTnn3lfamE87B4Yt_zzLSLmHt2pQCT_roXvNIEmOaOEIvhTvX8PmtxCKIZ9ZI=s160-c-k-c0x00ffffff-no-rj" alt="David Shapiro" class="channel-thumbnail">
                        <div class="channel-info">
                            <h3>David Shapiro</h3>
                            <p>AI Maximalist, Anti-Doomer, Psychedelics Advocate, Post-Labor Economics Evangelist, Meaning Economy Pioneer, Postnihilism</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Generate Button -->
            <div style="margin-top: 24px;">
                <div style="text-align: center;">
                    <button class="btn" id="generateBtn" onclick="generateSummary()">
                        Generate Key Insights
                    </button>
                </div>
                <p style="font-size: 12px; color: #6b7280; margin-top: 8px; margin-bottom: 0; text-align: left;">Videos released in the last 7 days</p>
            </div>
        </div>
            
        <!-- Loading State -->
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>Generating insights... This may take a few minutes.</p>
        </div>
            
        <!-- Results -->
        <div class="results" id="results">
            <!-- Results will be displayed here -->
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <!-- Episodes Section -->
            <div class="episodes-section">
                <div id="episodesList">
                    <!-- Episode cards will be loaded here -->
                </div>
            </div>
        </div>

        <!-- Trends Section -->
        <div class="trends-section">
            <h2>Topic Trends</h2>
            <div class="trend-chart" id="trendChart">
                <canvas id="trendCanvas" width="800" height="300"></canvas>
            </div>
            <table class="trend-table">
                <thead>
                    <tr>
                        <th>Topic</th>
                        <th>Change</th>
                        <th>Mentions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>MCP servers</td>
                        <td class="trend-change positive">+32%</td>
                        <td>47</td>
                    </tr>
                    <tr>
                        <td>Agentic AI</td>
                        <td class="trend-change positive">+28%</td>
                        <td>39</td>
                    </tr>
                    <tr>
                        <td>AI & Job Loss</td>
                        <td class="trend-change positive">+15%</td>
                        <td>23</td>
                    </tr>
                    <tr>
                        <td>China</td>
                        <td class="trend-change negative">-8%</td>
                        <td>18</td>
                    </tr>
                    <tr>
                        <td>AI Scam</td>
                        <td class="trend-change positive">+12%</td>
                        <td>14</td>
                    </tr>
                </tbody>
            </table>
        </div>



        <!-- Results -->
            <div class="results" id="results">
                <!-- Results will be displayed here -->
            </div>

        <!-- Settings Modal -->
        <div class="modal" id="settingsModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Settings</h3>
                    <button class="modal-close" onclick="hideSettingsModal()">&times;</button>
        </div>
                <div class="form-group">
                    <label for="channel1">Channel 1 (YouTube URL or ID)</label>
                    <input type="text" id="channel1" placeholder="https://youtube.com/channel/...">
                </div>
                <div class="form-group">
                    <label for="channel2">Channel 2 (YouTube URL or ID)</label>
                    <input type="text" id="channel2" placeholder="https://youtube.com/channel/...">
                </div>
                <div class="form-group">
                    <label for="channel3">Channel 3 (YouTube URL or ID)</label>
                    <input type="text" id="channel3" placeholder="https://youtube.com/channel/...">
                </div>
                <div class="form-group">
                    <div class="toggle-switch">
                        <input type="checkbox" id="fallbackTranscription">
                        <label for="fallbackTranscription">Enable fallback transcription (YouTube → Whisper → Podsqueeze)</label>
                    </div>
                </div>
                <div class="form-group">
                    <label for="emailSchedule">Email Schedule</label>
                    <select id="emailSchedule">
                        <option value="mon">Monday</option>
                        <option value="wed">Wednesday</option>
                        <option value="fri">Friday</option>
                    </select>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn" onclick="saveSettings()">Save Changes</button>
                    <button class="btn btn-secondary" onclick="hideSettingsModal()">Cancel</button>
                </div>
            </div>
        </div>

    </div>

    <script>
        console.log('Script loading...');
        
        let selectedChannels = [];
        let channels = [];

        // Load channels on page load
        window.onload = async function() {
            console.log('Page loaded, checking for updates...');
            // First render default channels immediately
            renderDefaultChannels();
            // Then try to load from API
            await loadChannels();
            // Initialize trend chart
            initTrendChart();
        };
        
        // Also try to load channels when DOM is ready
        document.addEventListener('DOMContentLoaded', async function() {
            console.log('DOM content loaded, loading channels...');
            await loadChannels();
        });
        
        async function loadChannels() {
            try {
                const response = await fetch('/api/channels');
                const data = await response.json();
                console.log('Channels data received:', data);
                channels = data.channels;
                console.log('Channels array:', channels);
                renderChannels();
            } catch (error) {
                console.error('Error loading channels:', error);
                showError('Failed to load channels. Please refresh the page.');
                // Fallback: render with default channels
                renderDefaultChannels();
            }
        }

        function renderChannels() {
            console.log('Rendering channels...');
            const grid = document.getElementById('podcastGrid');
            console.log('Grid element:', grid);
            console.log('Channels to render:', channels);
            
            if (!grid) {
                console.error('Grid element not found!');
                return;
            }
            
            if (!channels || channels.length === 0) {
                console.log('No channels to render, using fallback');
                renderDefaultChannels();
                return;
            }
            
            const html = channels.map(channel => 
                '<div class="channel-card" id="channel-' + channel.id + '">' +
                '<div class="channel-header">' +
                '<img src="' + channel.thumbnail + '" alt="' + channel.name + '" class="channel-thumbnail" onerror="this.style.display=\\'none\\'">' +
                '<div class="channel-info">' +
                '<h3>' + channel.name + '</h3>' +
                '<p>' + channel.description + '</p>' +
                '</div>' +
                '</div>' +
                '</div>'
            ).join('');
            
            console.log('Generated HTML:', html);
            grid.innerHTML = html;
            console.log('Channels rendered successfully');
        }
        
        function renderDefaultChannels() {
            console.log('Rendering default channels...');
            const grid = document.getElementById('podcastGrid');
            if (!grid) {
                console.error('Grid element not found!');
                return;
            }
            
            const defaultChannels = [
                {
                    id: 'two-minute-papers',
                    name: 'Two Minute Papers',
                    description: 'AI research paper summaries and breakthroughs',
                    thumbnail: 'https://yt3.googleusercontent.com/ytc/AIdro_ljAkSpv16cJNUsE_rI1X-Kz9s78w1WNojUga-aZ1uVzEQ=s160-c-k-c0x00ffffff-no-rj'
                },
                {
                    id: 'matthew-berman',
                    name: 'Matthew Berman',
                    description: 'AI, Open Source, Generative Art, AI Art, Futurism, ChatGPT, Large Language Models',
                    thumbnail: 'https://yt3.ggpht.com/FLJEnb2WnG3g0GV9GbGbdvkMKqInA0WcEzQkL-haJ0mBSDHl5wrUrmQ2w1_wyeoonmKl5DWvVwk=s88-c-k-c0xffffffff-no-rj-mo'
                },
                {
                    id: 'ai-explained',
                    name: 'AI Explained',
                    description: 'Covering the biggest news of the century - the arrival of smarter-than-human AI',
                    thumbnail: 'https://yt3.ggpht.com/GFuvgO3IZvs5XkYOxyLoWQto2lyY6-7Ob-7sfZRyoann4eBgvBMxuGgSVU1cvBgRCgAn41St7g=s88-c-k-c0xffffffff-no-rj-mo'
                },
                {
                    id: 'matt-wolfe',
                    name: 'Matt Wolfe',
                    description: 'AI News Breakdowns every Saturday and other cool nerdy tech and AI stuff',
                    thumbnail: 'https://yt3.ggpht.com/Xfsv8L8S4Dt2PPpgaexoMluK9gkm4H77TY-Sae7DbY8qKSaGI0FOS_uzw65kxVtdQlYvc02bB6k=s88-c-k-c0xffffffff-no-rj-mo'
                },
                {
                    id: 'david-shapiro',
                    name: 'David Shapiro',
                    description: 'AI Maximalist, Anti-Doomer, Psychedelics Advocate, Post-Labor Economics Evangelist, Meaning Economy Pioneer, Postnihilism',
                    thumbnail: 'https://yt3.googleusercontent.com/3PuQVkaSA3n4B-JTnn3lfamE87B4Yt_zzLSLmHt2pQCT_roXvNIEmOaOEIvhTvX8PmtxCKIZ9ZI=s160-c-k-c0x00ffffff-no-rj'
                },
                {
                    id: 'yannic-kilcher',
                    name: 'Yannic Kilcher',
                    description: 'AI research paper reviews and discussions',
                    thumbnail: 'https://yt3.googleusercontent.com/ytc/AIdro_nqmmpWC-iPIeVF4grbJGcGmoWyYX0E6_PFGITlKv7jTMrh=s160-c-k-c0x00ffffff-no-rj'
                }
            ];
            
            channels = defaultChannels;
            
            const html = defaultChannels.map(channel => 
                '<div class="channel-card" id="channel-' + channel.id + '">' +
                '<div class="channel-header">' +
                '<img src="' + channel.thumbnail + '" alt="' + channel.name + '" class="channel-thumbnail" onerror="this.style.display=\\'none\\'">' +
                '<div class="channel-info">' +
                '<h3>' + channel.name + '</h3>' +
                '<p>' + channel.description + '</p>' +
                '</div>' +
                '</div>' +
                '</div>'
            ).join('');
            
            grid.innerHTML = html;
            console.log('Default channels rendered successfully');
        }

        function toggleChannel(channelId) {
            console.log('toggleChannel called with:', channelId);
            
            const card = document.getElementById('channel-' + channelId);
            console.log('Card element found:', card);
            
            if (!card) {
                console.error('Card element not found for channel:', channelId);
                return;
            }
            
            const index = selectedChannels.indexOf(channelId);
                            console.log('Current index in selectedChannels:', index);
            
            if (index > -1) {
                selectedChannels.splice(index, 1);
                card.classList.remove('selected');
                console.log('Removed channel:', channelId);
            } else {
                selectedChannels.push(channelId);
                card.classList.add('selected');
                console.log('Added channel:', channelId);
            }
            
            // Update selection counter
            const selectedCount = document.getElementById('selectedCount');
            if (selectedCount) {
                selectedCount.textContent = selectedChannels.length;
                console.log('Updated counter to:', selectedChannels.length);
            } else {
                console.error('Selected count element not found');
            }
            
            console.log('Final selected channels:', selectedChannels);
        }
        
        console.log('toggleChannel function defined');

        function initTrendChart() {
            const canvas = document.getElementById('trendCanvas');
            if (!canvas) return;
            
            // Set high DPI for crisp rendering
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.scale(dpr, dpr);
            
            // Enable anti-aliasing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Sample data for 8 weeks
            const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'];
            const topics = {
                'MCP servers': [12, 15, 18, 22, 28, 35, 42, 47],
                'Agentic AI': [8, 12, 16, 20, 25, 30, 35, 39],
                'AI & Job Loss': [5, 8, 12, 15, 18, 20, 22, 23],
                'China': [25, 22, 20, 18, 16, 15, 14, 18],
                'AI Scam': [3, 5, 7, 9, 11, 12, 13, 14]
            };
            
            const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
            const topicNames = Object.keys(topics);
            
            // Clear canvas with background
            ctx.fillStyle = '#f9fafb';
            ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
            
            // Set up chart area with better margins
            const margin = { top: 30, right: 140, bottom: 40, left: 50 };
            const chartWidth = (canvas.width / dpr) - margin.left - margin.right;
            const chartHeight = (canvas.height / dpr) - margin.top - margin.bottom;
            
            // Find max value for scaling
            const maxValue = Math.max(...Object.values(topics).flat());
            
            // Draw background grid
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 0.5;
            
            // Horizontal grid lines
            for (let i = 0; i <= 5; i++) {
                const y = margin.top + (chartHeight / 5) * i;
                ctx.beginPath();
                ctx.moveTo(margin.left, y);
                ctx.lineTo(margin.left + chartWidth, y);
                ctx.stroke();
            }
            
            // Vertical grid lines
            for (let i = 0; i <= 7; i++) {
                const x = margin.left + (chartWidth / 7) * i;
                ctx.beginPath();
                ctx.moveTo(x, margin.top);
                ctx.lineTo(x, margin.top + chartHeight);
                ctx.stroke();
            }
            
            // Draw lines for each topic with improved styling
            topicNames.forEach((topic, index) => {
                const data = topics[topic];
                const color = colors[index];
                
                // Create gradient for line
                const gradient = ctx.createLinearGradient(0, 0, chartWidth, 0);
                gradient.addColorStop(0, color + '40');
                gradient.addColorStop(1, color);
                
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Draw line with shadow
                ctx.shadowColor = color + '40';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 2;
                
                ctx.beginPath();
                data.forEach((value, weekIndex) => {
                    const x = margin.left + (chartWidth / 7) * weekIndex;
                    const y = margin.top + chartHeight - (value / maxValue) * chartHeight;
                    
                    if (weekIndex === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                ctx.stroke();
                
                // Reset shadow for points
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Draw points with better styling
                data.forEach((value, weekIndex) => {
                    const x = margin.left + (chartWidth / 7) * weekIndex;
                    const y = margin.top + chartHeight - (value / maxValue) * chartHeight;
                    
                    // Draw point shadow
                    ctx.shadowColor = color + '60';
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 2;
                    
                    // Draw point
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // Draw white center
                    ctx.shadowColor = 'transparent';
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, 2 * Math.PI);
                    ctx.fill();
                });
            });
            
            // Draw axis labels with better styling
            ctx.fillStyle = '#6B7280';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            
            // X-axis labels (weeks)
            weeks.forEach((week, index) => {
                const x = margin.left + (chartWidth / 7) * index;
                const y = margin.top + chartHeight + 25;
                ctx.fillText(week, x, y);
            });
            
            // Y-axis labels
            ctx.textAlign = 'right';
            ctx.font = 'bold 11px Inter, sans-serif';
            for (let i = 0; i <= 5; i++) {
                const y = margin.top + (chartHeight / 5) * i;
                const value = Math.round((maxValue / 5) * (5 - i));
                ctx.fillText(value.toString(), margin.left - 15, y + 4);
            }
            
            // Draw improved legend
            ctx.textAlign = 'left';
            ctx.font = 'bold 12px Inter, sans-serif';
            
            // Legend background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(margin.left + chartWidth + 10, margin.top - 10, 120, 120);
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 1;
            ctx.strokeRect(margin.left + chartWidth + 10, margin.top - 10, 120, 120);
            
            topicNames.forEach((topic, index) => {
                const x = margin.left + chartWidth + 20;
                const y = margin.top + 10 + (index * 22);
                
                // Draw color indicator with better styling
                ctx.fillStyle = colors[index];
                ctx.fillRect(x, y - 8, 16, 4);
                
                // Draw topic name
                ctx.fillStyle = '#374151';
                ctx.fillText(topic, x + 22, y);
            });
            
            // Add chart title
            ctx.fillStyle = '#1F2937';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Topic Mentions Over Time', (canvas.width / dpr) / 2, 20);
        }

        async function generateSummary() {
            console.log('generateSummary function called');
            
            const episodeLimit = 1; // Always use 1 video per channel
            
            // Use all available channels instead of selected ones
            const allChannelIds = channels.map(channel => channel.id);
            console.log('Using all channels:', allChannelIds);
            
            const btn = document.getElementById('generateBtn');
            const loading = document.getElementById('loading');
            const results = document.getElementById('results');
            
            console.log('🔍 Elements found:', { btn, loading, results });
            
            btn.disabled = true;
            loading.classList.add('show');
            results.classList.remove('show');
            
            try {
                console.log('Making API request to /api/generate-summary');
                console.log('Request body:', { channelIds: allChannelIds, videoLimit: parseInt(episodeLimit) });
                
                const response = await fetch('/api/generate-summary', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        channelIds: allChannelIds,
                        videoLimit: parseInt(episodeLimit)
                    })
                });
                
                const data = await response.json();
                console.log('API response received:', data);
                
                if (data.error) {
                    console.log('Error in response:', data.error);
                    showError(data.error);
                } else {
                    console.log('Calling showResults with data');
                    showResults(data);
                }
            } catch (error) {
                showError('Failed to generate summary. Please try again.');
                console.error('Error:', error);
            } finally {
                btn.disabled = false;
                loading.classList.remove('show');
            }
        }

        function showResults(data) {
            console.log('showResults called with data:', data);
            console.log('episodeSummaries length:', data.episodeSummaries ? data.episodeSummaries.length : 'undefined');
            console.log('trendAnalysis:', data.trendAnalysis);
            const results = document.getElementById('results');
            console.log('Results element:', results);
            
            let html = '<h3>Key Insights (all channels)</h3>';
            
            // 1. GENERAL OVERVIEW (Trend Analysis) - Display first
            if (data.trendAnalysis) {
                html += '<div class="summary-item overview-section">' +
                    '<h4>🔍 General Overview & Trends</h4>' +
                    '<p><strong>Overview:</strong></p>' +
                    '<p>' + data.trendAnalysis.metaInsights + '</p>' +
                    '<p><strong>Recurring Themes:</strong></p>' +
                    '<ul class="insights-list">' +
                    data.trendAnalysis.recurringThemes.map(theme => '<li>' + theme + '</li>').join('') +
                    '</ul>' +
                    '<p><strong>Emerging Topics:</strong></p>' +
                    '<ul class="insights-list">' +
                    data.trendAnalysis.emergingTopics.map(topic => '<li>' + topic + '</li>').join('') +
                    '</ul>' +
                    '</div>';
            }
            
            // 2. INDIVIDUAL EPISODE SUMMARIES - Display below overview
            if (data.episodeSummaries && data.episodeSummaries.length > 0) {
                html += '<h4>📝 Individual Episode Summaries</h4>';
                html += '<p><em>Detailed breakdown of each episode from all channels:</em></p>';
                
                data.episodeSummaries.forEach((episode, index) => {
                    html += '<div class="summary-item episode-summary">' +
                        '<h4>' + (index + 1) + '. ' + episode.podcastName + ' - ' + episode.title + '</h4>' +
                        '<p><strong>Summary:</strong></p>' +
                        '<p>' + episode.fullSummary + '</p>' +
                        '<p><strong>Key Insights:</strong></p>' +
                        '<ul class="insights-list">' +
                        episode.keyInsights.map(insight => '<li>' + insight + '</li>').join('') +
                        '</ul>' +
                        '<p><strong>Actionable Items:</strong></p>' +
                        '<ul class="insights-list">' +
                        episode.actionableItems.map(item => '<li>' + item + '</li>').join('') +
                        '</ul>' +
                        '</div>';
                });
            } else {
                html += '<div class="error">❌ No episode summaries found in the response.</div>';
                html += '<div class="status">This might be due to:</div>';
                html += '<ul class="insights-list">';
                html += '<li>YouTube API key issues (check if it is expired or invalid)</li>';
                html += '<li>No recent videos found from the selected channels</li>';
                html += '<li>Network connectivity issues</li>';
                html += '</ul>';
                html += '<p><strong>Response data:</strong></p>';
                html += '<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto;">' + JSON.stringify(data, null, 2) + '</pre>';
                console.log('No episodeSummaries found in data:', data);
            }
            
            if (data.warning) {
                html += '<div class="warning">⚠️ ' + data.warning + '</div>';
            }
            
            if (data.emailSent) {
                html += '<div class="status">Summary has been sent to your email!</div>';
            }
            
            results.innerHTML = html;
            console.log('Set innerHTML, now adding show class');
            results.classList.add('show');
            console.log('Results element classes after adding show:', results.className);
        }

        function showError(message) {
            const results = document.getElementById('results');
            results.innerHTML = '<div class="error">Error: ' + message + '</div>';
            results.classList.add('show');
        }

        // Email functionality
        function showEmailForm() {
            document.getElementById('emailForm').style.display = 'block';
            document.getElementById('bulkEmailForm').style.display = 'none';
        }

        function hideEmailForm() {
            document.getElementById('emailForm').style.display = 'none';
        }

        function showBulkEmailForm() {
            document.getElementById('bulkEmailForm').style.display = 'block';
            document.getElementById('emailForm').style.display = 'none';
        }

        function hideBulkEmailForm() {
            document.getElementById('bulkEmailForm').style.display = 'none';
        }

        async function sendEmail() {
            showError('Email functionality temporarily disabled');
        }

        async function sendBulkEmail() {
            showError('Bulk email functionality temporarily disabled');
        }

        function showSuccess(message) {
            const results = document.getElementById('results');
            results.innerHTML = '<div class="success">Success: ' + message + '</div>';
            results.classList.add('show');
        }

        async function loadExistingSummaries() {
            const btn = document.getElementById('loadSummariesBtn');
            const container = document.getElementById('existingSummaries');
            
            btn.disabled = true;
            btn.textContent = 'Loading...';
            
            try {
                const response = await fetch('/api/all-summaries');
                const data = await response.json();
                
                if (data.error) {
                    container.innerHTML = '<div class="error">❌ ' + data.error + '</div>';
                } else if (data.episodes && data.episodes.length > 0) {
                    let html = '<h3>📚 Recent Summaries</h3>';
                    
                    data.episodes.forEach(episode => {
                        const publishDate = new Date(episode.publishDate).toLocaleDateString();
                        html += '<div class="summary-item">' +
                            '<h4>' + (episode.podcastName || 'Unknown Channel') + ' - ' + episode.title + '</h4>' +
                            '<p><small>📅 Published: ' + publishDate + '</small></p>' +
                            '<p><strong>Summary:</strong></p>' +
                            '<p>' + (episode.summary || 'No summary available') + '</p>';
                        
                        if (episode.keyInsights && episode.keyInsights.length > 0) {
                            html += '<p><strong>Key Insights:</strong></p>' +
                                '<ul class="insights-list">' +
                                episode.keyInsights.map(insight => '<li>' + insight + '</li>').join('') +
                                '</ul>';
                        }
                        
                        if (episode.mainTopics && episode.mainTopics.length > 0) {
                            html += '<p><strong>Main Topics:</strong></p>' +
                                '<ul class="insights-list">' +
                                episode.mainTopics.map(topic => '<li>' + topic + '</li>').join('') +
                                '</ul>';
                        }
                        
                        html += '</div>';
                    });
                    
                    container.innerHTML = html;
                } else {
                    container.innerHTML = '<div class="status">No summaries found. Generate your first summary above!</div>';
                }
            } catch (error) {
                container.innerHTML = '<div class="error">❌ Failed to load summaries. Please try again.</div>';
                console.error('Error:', error);
            } finally {
                btn.disabled = false;
                btn.textContent = '📝 View Individual Summaries';
            }
        }

        async function loadWeeklyOverview() {
            const btn = document.getElementById('loadWeeklyOverviewBtn');
            const container = document.getElementById('existingSummaries');
            
            btn.disabled = true;
            btn.textContent = 'Generating Weekly Overview...';
            
            try {
                const response = await fetch('/api/weekly-overview');
                const data = await response.json();
                
                if (data.error) {
                    container.innerHTML = '<div class="error">❌ ' + data.error + '</div>';
                } else if (data.episodeCount === 0) {
                    container.innerHTML = '<div class="status">' + data.message + '</div>';
                } else {
                    let html = '<h3>Weekly Overview (Last 7 Days)</h3>';
                    html += '<p><small>Based on ' + data.episodeCount + ' episodes from ' + 
                           new Date(data.dateRange.from).toLocaleDateString() + ' to ' + 
                           new Date(data.dateRange.to).toLocaleDateString() + '</small></p>';
                    
                    if (data.weeklyOverview) {
                        html += '<div class="weekly-overview">';
                        
                        // Executive Summary
                        html += '<div class="overview-section">';
                        html += '<h4>Executive Summary</h4>';
                        html += '<p>' + data.weeklyOverview.executiveSummary + '</p>';
                        html += '</div>';
                        
                        // Key Trends
                        if (data.weeklyOverview.keyTrends && data.weeklyOverview.keyTrends.length > 0) {
                            html += '<div class="overview-section">';
                            html += '<h4>Key Trends</h4>';
                            html += '<ul class="insights-list">';
                            data.weeklyOverview.keyTrends.forEach(trend => {
                                html += '<li>' + trend + '</li>';
                            });
                            html += '</ul>';
                            html += '</div>';
                        }
                        
                        // Top Insights
                        if (data.weeklyOverview.topInsights && data.weeklyOverview.topInsights.length > 0) {
                            html += '<div class="overview-section">';
                            html += '<h4>Top Insights</h4>';
                            html += '<ul class="insights-list">';
                            data.weeklyOverview.topInsights.forEach(insight => {
                                html += '<li>' + insight + '</li>';
                            });
                            html += '</ul>';
                            html += '</div>';
                        }
                        
                        // Channel Highlights
                        if (data.weeklyOverview.channelHighlights && data.weeklyOverview.channelHighlights.length > 0) {
                            html += '<div class="overview-section">';
                            html += '<h4>Channel Highlights</h4>';
                            html += '<ul class="insights-list">';
                            data.weeklyOverview.channelHighlights.forEach(highlight => {
                                html += '<li>' + highlight + '</li>';
                            });
                            html += '</ul>';
                            html += '</div>';
                        }
                        
                        // Recommendations
                        if (data.weeklyOverview.recommendations && data.weeklyOverview.recommendations.length > 0) {
                            html += '<div class="overview-section">';
                            html += '<h4>Recommendations</h4>';
                            html += '<ul class="insights-list">';
                            data.weeklyOverview.recommendations.forEach(rec => {
                                html += '<li>' + rec + '</li>';
                            });
                            html += '</ul>';
                            html += '</div>';
                        }
                        
                        html += '</div>';
                    }
                    
                    // Show individual episodes
                    html += '<h4>📺 Individual Episodes</h4>';
                    data.episodes.forEach(episode => {
                        const publishDate = new Date(episode.publishDate).toLocaleDateString();
                        html += '<div class="summary-item" style="margin-top: 15px;">' +
                            '<h5>' + episode.channel + ' - ' + episode.title + '</h5>' +
                            '<p><small>📅 Published: ' + publishDate + '</small></p>' +
                            '<p><strong>Summary:</strong> ' + (episode.summary || 'No summary available') + '</p>';
                        
                        if (episode.keyInsights && episode.keyInsights.length > 0) {
                            html += '<p><strong>Key Insights:</strong></p>' +
                                '<ul class="insights-list">' +
                                episode.keyInsights.map(insight => '<li>' + insight + '</li>').join('') +
                                '</ul>';
                        }
                        
                        html += '</div>';
                    });
                    
                    container.innerHTML = html;
                }
            } catch (error) {
                container.innerHTML = '<div class="error">❌ Failed to load weekly overview. Please try again.</div>';
                console.error('Error:', error);
            } finally {
                btn.disabled = false;
                btn.textContent = '📅 Weekly Overview (Last 7 Days)';
            }
        }

        // Modal functions
        function showSettingsModal() {
            document.getElementById('settingsModal').classList.add('show');
        }

        function hideSettingsModal() {
            document.getElementById('settingsModal').classList.remove('show');
        }

        function showEmailPanel() {
            document.getElementById('emailPanel').style.display = 'block';
        }

        function hideEmailPanel() {
            document.getElementById('emailPanel').style.display = 'none';
        }

        function showEmailModal() {
            showError('Email functionality temporarily disabled');
        }

        function hideEmailModal() {
            document.getElementById('emailModal').classList.remove('show');
        }

        function showBulkEmailModal() {
            showError('Bulk email functionality temporarily disabled');
        }

        function hideBulkEmailModal() {
            document.getElementById('bulkEmailModal').classList.remove('show');
        }

        function previewEmail() {
            // Show email preview modal or redirect to preview endpoint
            alert('Email preview functionality coming soon!');
        }

        function saveSettings() {
            // Save settings to backend
            const channel1 = document.getElementById('channel1').value;
            const channel2 = document.getElementById('channel2').value;
            const channel3 = document.getElementById('channel3').value;
            const fallbackTranscription = document.getElementById('fallbackTranscription').checked;
            const emailSchedule = document.getElementById('emailSchedule').value;

            // Here you would typically send this to your backend
            console.log('Settings saved:', { channel1, channel2, channel3, fallbackTranscription, emailSchedule });
            
            hideSettingsModal();
            showSuccess('Settings saved successfully');
        }

        // Update existing functions to work with new interface
        function showEmailForm() {
            showEmailModal();
        }

        function hideEmailForm() {
            hideEmailModal();
        }

        function showBulkEmailForm() {
            showBulkEmailModal();
        }

        function hideBulkEmailForm() {
            hideBulkEmailModal();
        }



        function expandEpisode(element) {
            // Toggle full summary display
            const card = element.closest('.episode-card');
            const quote = card.querySelector('.episode-quote');
            const isExpanded = quote.classList.contains('expanded');
            
            if (isExpanded) {
                quote.classList.remove('expanded');
                element.textContent = 'Show full summary';
            } else {
                quote.classList.add('expanded');
                element.textContent = 'Hide full summary';
            }
        }


    </script>
</body>
</html>`;
  
  return c.html(html);
});

// API Routes
app.get("/api/channels", (c) => {
  return c.json({ channels: SUPPORTED_CHANNELS });
});

app.post("/api/generate-summary", async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    const { channelIds, videoLimit = 3, email = "anonymous@example.com", sendEmail = false } = await c.req.json();

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return c.json({ error: "channelIds array is required" }, 400);
    }

    // Create summary request record
    const [summaryRequest] = await db.insert(schema.summaryRequests).values({
      userEmail: email,
      selectedPodcasts: channelIds, // Keep same field name for DB compatibility
      episodeLimit: Number(videoLimit),
      sendEmail: Boolean(sendEmail),
      status: "processing"
    }).returning();

    // Process podcasts and episodes
    const allEpisodeSummaries = [];
    
    for (const channelId of channelIds) {
      const channel = SUPPORTED_CHANNELS.find(c => c.id === channelId);
      if (!channel) {
        continue;
      }

      try {
        // Fetch videos directly from YouTube API
        const videos = await getChannelVideos(channel.channelId, videoLimit, c.env);

        // Store channel info
        await db.insert(schema.podcasts).values({
          id: channel.id,
          name: channel.name,
          description: channel.description,
          taddyId: channel.channelId, // Reuse field for channelId
          latestEpisodeTitle: videos[0]?.title || null,
          latestEpisodeDate: videos[0]?.publishedAt || null
        }).onConflictDoUpdate({
          target: schema.podcasts.id,
          set: {
            latestEpisodeTitle: videos[0]?.title || null,
            latestEpisodeDate: videos[0]?.publishedAt || null,
            updatedAt: new Date().toISOString()
          }
        });

        // Process each video
        console.log(`📹 Processing ${videos.length} videos for channel ${channel.name}`);
        for (const video of videos) {
          // Get video info (description as transcript alternative)
          const videoInfo = await getVideoInfo(video.id, c.env);
          
          // Use video description as content for summarization
          const contentForSummary = videoInfo.description || video.description || "No content available for summarization";

          // Summarize video using AI
          console.log(`🤖 Starting AI summary for: ${video.title}`);
          const summary = await summarizeEpisode(
            c.env.AI,
            contentForSummary,
            video.title
          );
          console.log(`✅ Generated summary for ${video.title} - Key insights: ${summary.keyInsights.length}`);

          // Store video and summary (prevent duplicates)
          await db.insert(schema.episodes).values({
            podcastId: channel.id,
            title: video.title,
            publishDate: video.publishedAt,
            transcript: contentForSummary,
            summary: summary.fullSummary,
            keyInsights: summary.keyInsights,
            mainTopics: summary.mainTopics,
            actionableItems: summary.actionableItems
          }).onConflictDoNothing();

          allEpisodeSummaries.push({
            podcastName: channel.name,
            title: video.title,
            publishDate: video.publishedAt,
            ...summary
          });
        }
      } catch (error) {
        console.error(`Error processing channel ${channelId}:`, error);
      }
    }

    // Perform trend analysis
    let trendAnalysis = null;
    if (allEpisodeSummaries.length > 1) {
      try {
        trendAnalysis = await analyzeTrends(c.env.AI, allEpisodeSummaries);
        
        // Store trend analysis
        await db.insert(schema.trendAnalyses).values({
          summaryRequestId: summaryRequest.id,
          recurringThemes: trendAnalysis.recurringThemes,
          emergingTopics: trendAnalysis.emergingTopics,
          contradictions: trendAnalysis.contradictions,
          metaInsights: trendAnalysis.metaInsights
        });
      } catch (error) {
        console.error("Error in trend analysis:", error);
      }
    }

    // Send email if requested
    if (sendEmail && email) {
      try {
        await callEmailMcpServer('send_summary_email', {
          recipientEmail: email,
          summaries: allEpisodeSummaries,
          trendAnalysis: trendAnalysis
        });
                    console.log('Summary email sent successfully');
      } catch (error) {
                        console.error('Failed to send summary email:', error);
      }
    }

    // Update request status
    await db.update(schema.summaryRequests)
      .set({ 
        status: "completed",
        completedAt: new Date().toISOString()
      })
      .where(eq(schema.summaryRequests.id, summaryRequest.id));

    // Check if we got any episode summaries
    if (allEpisodeSummaries.length === 0) {
      return c.json({
        requestId: summaryRequest.id,
        episodeSummaries: [],
        trendAnalysis: null,
        emailSent: sendEmail,
        warning: "No episodes were processed. This might be due to YouTube API issues or no recent videos found."
      });
    }

      const responseData = {
    requestId: summaryRequest.id,
    episodeSummaries: allEpisodeSummaries,
    trendAnalysis,
    emailSent: sendEmail
  };
  
  console.log('📤 Sending response to frontend:', {
    requestId: responseData.requestId,
    episodeSummariesCount: responseData.episodeSummaries?.length || 0,
    hasTrendAnalysis: !!responseData.trendAnalysis,
    emailSent: responseData.emailSent
  });
  
  return c.json(responseData);

  } catch (error) {
    console.error("Error in generate-summary:", error);
    return c.json({ 
      error: "Failed to generate summary",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.get("/api/summary-status/:requestId", async (c) => {
  const db = drizzle(c.env.DB);
  const requestId = c.req.param("requestId");

  try {
    const [request] = await db.select()
      .from(schema.summaryRequests)
      .where(eq(schema.summaryRequests.id, requestId));

    if (!request) {
      return c.json({ error: "Request not found" }, 404);
    }

    return c.json({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      errorMessage: request.errorMessage
    });
  } catch (error) {
    return c.json({ 
      error: "Failed to fetch status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.get("/api/recent-summaries", async (c) => {
  const db = drizzle(c.env.DB);
  const limit = Number(c.req.query("limit")) || 10;

  try {
    const requests = await db.select()
      .from(schema.summaryRequests)
      .orderBy(desc(schema.summaryRequests.createdAt))
      .limit(limit);

    return c.json({ requests });
  } catch (error) {
    return c.json({ 
      error: "Failed to fetch recent summaries",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.get("/api/summaries/:requestId", async (c) => {
  const db = drizzle(c.env.DB);
  const requestId = c.req.param("requestId");

  try {
    // Get the summary request
    const [request] = await db.select()
      .from(schema.summaryRequests)
      .where(eq(schema.summaryRequests.id, requestId));

    if (!request) {
      return c.json({ error: "Request not found" }, 404);
    }

    // Get all episodes for this request
    const episodes = await db.select()
      .from(schema.episodes)
      .where(eq(schema.episodes.podcastId, request.selectedPodcasts[0])) // Simplified for now
      .orderBy(desc(schema.episodes.publishDate))
      .limit(10);

    // Get trend analysis if available
    const [trendAnalysis] = await db.select()
      .from(schema.trendAnalyses)
      .where(eq(schema.trendAnalyses.summaryRequestId, requestId));

    return c.json({
      request,
      episodes,
      trendAnalysis
    });
  } catch (error) {
    return c.json({ 
      error: "Failed to fetch summaries",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.get("/api/all-summaries", async (c) => {
  const db = drizzle(c.env.DB);
  const limit = Number(c.req.query("limit")) || 20;

  try {
    // Get recent episodes with summaries
    const episodes = await db.select({
      id: schema.episodes.id,
      title: schema.episodes.title,
      publishDate: schema.episodes.publishDate,
      summary: schema.episodes.summary,
      keyInsights: schema.episodes.keyInsights,
      mainTopics: schema.episodes.mainTopics,
      actionableItems: schema.episodes.actionableItems,
      podcastName: schema.podcasts.name,
      podcastDescription: schema.podcasts.description
    })
    .from(schema.episodes)
    .leftJoin(schema.podcasts, eq(schema.episodes.podcastId, schema.podcasts.id))
    .orderBy(desc(schema.episodes.publishDate))
    .limit(limit);

    return c.json({ episodes });
  } catch (error) {
    return c.json({
      error: "Failed to fetch all summaries",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.post("/api/cleanup-duplicates", async (c) => {
  const db = drizzle(c.env.DB);

  try {
    // Get all episodes ordered by publish date
    const allEpisodes = await db.select({
      id: schema.episodes.id,
      title: schema.episodes.title,
      publishDate: schema.episodes.publishDate
    })
    .from(schema.episodes)
    .orderBy(schema.episodes.publishDate);

    const seenTitles = new Set();
    const duplicatesToDelete = [];

    for (const episode of allEpisodes) {
      if (seenTitles.has(episode.title)) {
        duplicatesToDelete.push(episode.id);
      } else {
        seenTitles.add(episode.title);
      }
    }

    if (duplicatesToDelete.length === 0) {
      return c.json({ message: "No duplicates found", deletedCount: 0 });
    }

    // Delete duplicates
    for (const id of duplicatesToDelete) {
      await db.delete(schema.episodes).where(eq(schema.episodes.id, id));
    }

    return c.json({ 
      message: "Duplicates cleaned up successfully", 
      deletedCount: duplicatesToDelete.length 
    });
  } catch (error) {
    return c.json({
      error: "Failed to cleanup duplicates",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.get("/api/weekly-overview", async (c) => {
  const db = drizzle(c.env.DB);
  const days = Number(c.req.query("days")) || 7;

  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - days);

    // Get episodes from the last 7 days
    const recentEpisodes = await db.select({
      id: schema.episodes.id,
      title: schema.episodes.title,
      publishDate: schema.episodes.publishDate,
      summary: schema.episodes.summary,
      keyInsights: schema.episodes.keyInsights,
      mainTopics: schema.episodes.mainTopics,
      actionableItems: schema.episodes.actionableItems,
      podcastName: schema.podcasts.name
    })
    .from(schema.episodes)
    .leftJoin(schema.podcasts, eq(schema.episodes.podcastId, schema.podcasts.id))
    .where(gte(schema.episodes.publishDate, sevenDaysAgo.toISOString()))
    .orderBy(desc(schema.episodes.publishDate));

    if (recentEpisodes.length === 0) {
      return c.json({
        message: `No episodes found in the last ${days} days`,
        episodeCount: 0,
        weeklyOverview: null
      });
    }

    // Create a comprehensive overview of all recent episodes
    const episodeSummaries = recentEpisodes.map(episode => {
      // Parse the summary if it's a JSON string
      let parsedSummary = episode.summary;
      let keyInsights = episode.keyInsights || [];
      let mainTopics = episode.mainTopics || [];
      let actionableItems = episode.actionableItems || [];

      try {
        if (typeof episode.summary === 'string' && episode.summary.trim().startsWith('{')) {
          const parsed = JSON.parse(episode.summary);
          parsedSummary = parsed.fullSummary || episode.summary;
          keyInsights = parsed.keyInsights || keyInsights;
          mainTopics = parsed.mainTopics || mainTopics;
          actionableItems = parsed.actionableItems || actionableItems;
        }
      } catch (error) {
        console.error('Error parsing episode summary:', error);
      }

      return {
        title: episode.title,
        channel: episode.podcastName || 'Unknown Channel',
        publishDate: episode.publishDate,
        summary: parsedSummary,
        keyInsights: keyInsights,
        mainTopics: mainTopics,
        actionableItems: actionableItems
      };
    });

    // Generate weekly overview using AI
    console.log('🔍 Generating weekly overview for', episodeSummaries.length, 'episodes');
    const weeklyOverview = await generateWeeklyOverview(c.env.AI, episodeSummaries);
                console.log('Weekly overview generated:', weeklyOverview);

    return c.json({
      episodeCount: recentEpisodes.length,
      dateRange: {
        from: sevenDaysAgo.toISOString(),
        to: new Date().toISOString()
      },
      episodes: episodeSummaries,
      weeklyOverview
    });

  } catch (error) {
    return c.json({
      error: "Failed to generate weekly overview",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Email functionality endpoints
app.post("/api/send-email", async (c) => {
  try {
    const { recipientEmail, emailType, content } = await c.req.json();

    if (!recipientEmail || !emailType || !content) {
      return c.json({ error: "recipientEmail, emailType, and content are required" }, 400);
    }

    let result;
    switch (emailType) {
      case 'summary':
        result = await callEmailMcpServer('send_summary_email', {
          recipientEmail,
          summaries: content.summaries,
          trendAnalysis: content.trendAnalysis
        });
        break;
      case 'weekly_overview':
        result = await callEmailMcpServer('send_weekly_overview_email', {
          recipientEmail,
          weeklyOverview: content.weeklyOverview,
          episodeCount: content.episodeCount,
          dateRange: content.dateRange
        });
        break;
      default:
        return c.json({ error: "Invalid email type. Use 'summary' or 'weekly_overview'" }, 400);
    }

    return c.json({ success: true, result });
  } catch (error) {
    return c.json({
      error: "Failed to send email",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.post("/api/send-bulk-email", async (c) => {
  try {
    const { emailList, emailType, content } = await c.req.json();

    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
      return c.json({ error: "emailList is required and must be a non-empty array" }, 400);
    }

    if (!emailType || !content) {
      return c.json({ error: "emailType and content are required" }, 400);
    }

    const result = await callEmailMcpServer('send_bulk_email', {
      emailList,
      emailType,
      content
    });

    return c.json({ success: true, result });
  } catch (error) {
    return c.json({
      error: "Failed to send bulk email",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.get("/api/status", async (c) => {
  return c.json({
    status: "online",
    timestamp: new Date().toISOString(),
    supportedChannels: SUPPORTED_CHANNELS.length,
    note: "Direct YouTube API integration - no MCP servers required"
  });
});

app.get("/openapi.json", c => {
  return c.json(createOpenAPISpec(app, {
    info: {
      title: "AI Podcast Summarizer MCP Client",
      version: "1.0.0",
      description: "Main backend orchestrating podcast summarization workflow"
    },
  }));
});

app.use("/fp/*", createFiberplane({
  app,
  openapi: { url: "/openapi.json" }
}));

export default app;
