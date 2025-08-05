#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
// Note: youtube-transcript-api has compatibility issues, so we'll skip transcript functionality for now
// import { YoutubeTranscript } from 'youtube-transcript-api';

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

class YouTubeMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'youtube-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // Register the get_channel_videos tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_channel_videos':
          return await this.getChannelVideos(args);
        case 'get_video_transcript':
          return await this.getVideoTranscript(args);
        case 'search_videos':
          return await this.searchVideos(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async makeYouTubeAPIRequest(endpoint, params = {}) {
    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key is required for channel operations');
    }

    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    url.searchParams.append('key', YOUTUBE_API_KEY);
    url.searchParams.append('part', 'snippet,contentDetails,statistics');
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getChannelVideos(args) {
    const { channelId, maxResults = 5 } = args;

    if (!channelId) {
      throw new Error('channelId is required');
    }

    try {
      // Get channel's upload playlist ID
      const channelResponse = await this.makeYouTubeAPIRequest('channels', {
        id: channelId,
        part: 'contentDetails'
      });

      const uploadsPlaylistId = channelResponse.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      
      if (!uploadsPlaylistId) {
        throw new Error('Could not find uploads playlist for channel');
      }

      // Get videos from uploads playlist
      const videosResponse = await this.makeYouTubeAPIRequest('playlistItems', {
        playlistId: uploadsPlaylistId,
        maxResults: maxResults.toString()
      });

      const videos = videosResponse.items?.map(item => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.high?.url,
        channelTitle: item.snippet.channelTitle
      })) || [];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(videos, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get channel videos: ${error.message}`);
    }
  }

           async getVideoTranscript(args) {
           const { videoId } = args;
       
           if (!videoId) {
             throw new Error('videoId is required');
           }
       
           try {
             // For now, return video description instead of transcript due to API compatibility issues
             const videoResponse = await this.makeYouTubeAPIRequest('videos', {
               id: videoId,
               part: 'snippet'
             });
       
             const video = videoResponse.items?.[0];
             
             if (!video) {
               return {
                 content: [
                   {
                     type: 'text',
                     text: JSON.stringify({ error: 'Video not found' }, null, 2),
                   },
                 ],
               };
             }
       
             const result = {
               videoId,
               title: video.snippet.title,
               description: video.snippet.description,
               publishedAt: video.snippet.publishedAt,
               channelTitle: video.snippet.channelTitle,
               note: 'Transcript API temporarily disabled due to compatibility issues. Using video description instead.'
             };
       
             return {
               content: [
                 {
                   type: 'text',
                   text: JSON.stringify(result, null, 2),
                 },
               ],
             };
           } catch (error) {
             return {
               content: [
                 {
                   type: 'text',
                   text: JSON.stringify({ error: `Failed to get video info: ${error.message}` }, null, 2),
                 },
               ],
             };
           }
         }

  async searchVideos(args) {
    const { query, maxResults = 10 } = args;

    if (!query) {
      throw new Error('query is required');
    }

    try {
      const response = await this.makeYouTubeAPIRequest('search', {
        q: query,
        type: 'video',
        maxResults: maxResults.toString(),
        order: 'relevance'
      });

      const videos = response.items?.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.high?.url,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId
      })) || [];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(videos, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to search videos: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('YouTube MCP Server started');
  }
}

const server = new YouTubeMCPServer();
server.run().catch(console.error); 