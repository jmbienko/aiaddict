#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import nodemailer from 'nodemailer';

// Email configuration - will be loaded from environment variables
let EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM;

function loadEmailConfig() {
  EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
  EMAIL_PORT = process.env.EMAIL_PORT || 587;
  EMAIL_USER = process.env.EMAIL_USER;
  EMAIL_PASS = process.env.EMAIL_PASS;
  EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required');
  }
}

class EmailMCPServer {
  constructor() {
    // Load email configuration
    loadEmailConfig();
    
    this.server = new Server(
      {
        name: 'email-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupTransporter();
  }

  setupTransporter() {
    this.transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'send_summary_email':
          return await this.sendSummaryEmail(args);
        case 'send_weekly_overview_email':
          return await this.sendWeeklyOverviewEmail(args);
        case 'send_bulk_email':
          return await this.sendBulkEmail(args);
        case 'send_test_email':
          return await this.sendTestEmail(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async sendSummaryEmail(args) {
    const { recipientEmail, summaries, trendAnalysis } = args;

    if (!recipientEmail) {
      throw new Error('recipientEmail is required');
    }

    try {
      // Create email content
      const emailContent = this.createSummaryEmailContent(summaries, trendAnalysis);

      const mailOptions = {
        from: EMAIL_FROM,
        to: recipientEmail,
        subject: '🎙️ Your AI Podcast Summary is Ready!',
        html: emailContent,
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              messageId: result.messageId,
              recipient: recipientEmail,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to send summary email: ${error.message}`);
    }
  }

  async sendWeeklyOverviewEmail(args) {
    const { recipientEmail, weeklyOverview, episodeCount, dateRange } = args;

    if (!recipientEmail) {
      throw new Error('recipientEmail is required');
    }

    try {
      // Create weekly overview email content
      const emailContent = this.createWeeklyOverviewEmailContent(weeklyOverview, episodeCount, dateRange);

      const mailOptions = {
        from: EMAIL_FROM,
        to: recipientEmail,
        subject: '📅 Your Weekly AI Podcast Overview',
        html: emailContent,
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              messageId: result.messageId,
              recipient: recipientEmail,
              type: 'weekly_overview',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to send weekly overview email: ${error.message}`);
    }
  }

  async sendBulkEmail(args) {
    const { emailList, emailType, content } = args;

    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
      throw new Error('emailList is required and must be a non-empty array');
    }

    if (!emailType || !content) {
      throw new Error('emailType and content are required');
    }

    try {
      const results = [];
      const errors = [];

      for (const email of emailList) {
        try {
          let emailContent, subject;

          switch (emailType) {
            case 'summary':
              emailContent = this.createSummaryEmailContent(content.summaries, content.trendAnalysis);
              subject = '🎙️ Your AI Podcast Summary is Ready!';
              break;
            case 'weekly_overview':
              emailContent = this.createWeeklyOverviewEmailContent(content.weeklyOverview, content.episodeCount, content.dateRange);
              subject = '📅 Your Weekly AI Podcast Overview';
              break;
            default:
              throw new Error(`Unknown email type: ${emailType}`);
          }

          const mailOptions = {
            from: EMAIL_FROM,
            to: email,
            subject: subject,
            html: emailContent,
          };

          const result = await this.transporter.sendMail(mailOptions);
          results.push({
            email,
            success: true,
            messageId: result.messageId,
          });
        } catch (error) {
          errors.push({
            email,
            error: error.message,
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              totalSent: results.length,
              totalErrors: errors.length,
              results,
              errors,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to send bulk email: ${error.message}`);
    }
  }

  async sendTestEmail(args) {
    const { recipientEmail } = args;

    if (!recipientEmail) {
      throw new Error('recipientEmail is required');
    }

    try {
      const mailOptions = {
        from: EMAIL_FROM,
        to: recipientEmail,
        subject: '🧪 Email MCP Server Test',
        html: `
          <h2>Email MCP Server Test</h2>
          <p>This is a test email from your Email MCP Server.</p>
          <p>If you received this email, your email configuration is working correctly!</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `,
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              messageId: result.messageId,
              recipient: recipientEmail,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to send test email: ${error.message}`);
    }
  }

  createSummaryEmailContent(summaries, trendAnalysis) {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
            line-height: 1.6; 
            color: #1f2937; 
            background-color: #f9fafb;
            -webkit-font-smoothing: antialiased;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #22BFFD 0%, #1e40af 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            pointer-events: none;
          }
          .logo { 
            font-size: 32px; 
            font-weight: 700; 
            margin-bottom: 8px;
            position: relative;
            z-index: 1;
          }
          .tagline { 
            font-size: 16px; 
            opacity: 0.9; 
            font-weight: 400;
            position: relative;
            z-index: 1;
          }
          .content { padding: 40px 30px; }
          .section { 
            margin-bottom: 40px; 
            background: #ffffff; 
            border-radius: 12px; 
            border: 1px solid #e5e7eb;
            overflow: hidden;
          }
          .section-header { 
            background: #f8fafc; 
            padding: 20px 24px; 
            border-bottom: 1px solid #e5e7eb;
          }
          .section-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .section-content { padding: 24px; }
          .episode { 
            margin-bottom: 32px; 
            padding: 24px; 
            background: #f9fafb; 
            border-radius: 8px; 
            border-left: 4px solid #22BFFD;
          }
          .episode:last-child { margin-bottom: 0; }
          .episode-title { 
            font-size: 16px; 
            font-weight: 600; 
            color: #1f2937; 
            margin-bottom: 12px;
            line-height: 1.4;
          }
          .episode-channel { 
            font-size: 14px; 
            color: #6b7280; 
            margin-bottom: 16px;
            font-weight: 500;
          }
          .insights-section { 
            background: #eff6ff; 
            padding: 16px; 
            border-radius: 6px; 
            margin: 16px 0;
            border-left: 3px solid #3b82f6;
          }
          .insights-title { 
            font-size: 14px; 
            font-weight: 600; 
            color: #1e40af; 
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .insights-list { 
            list-style: none; 
            margin: 0; 
            padding: 0;
          }
          .insights-list li { 
            padding: 4px 0; 
            color: #374151;
            position: relative;
            padding-left: 16px;
          }
          .insights-list li::before { 
            content: '•'; 
            color: #3b82f6; 
            font-weight: bold; 
            position: absolute;
            left: 0;
          }
          .trends { 
            background: #fef3c7; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 4px solid #f59e0b;
          }
          .trends-title { 
            font-size: 16px; 
            font-weight: 600; 
            color: #92400e; 
            margin-bottom: 12px;
          }
          .footer { 
            text-align: center; 
            padding: 30px; 
            background: #f8fafc;
            border-top: 1px solid #e5e7eb;
            color: #6b7280; 
            font-size: 14px;
          }
          .footer-text { margin-bottom: 8px; }
          .timestamp { font-size: 12px; opacity: 0.7; }
          @media (max-width: 600px) {
            .container { margin: 0; }
            .header { padding: 30px 20px; }
            .content { padding: 20px; }
            .section-content { padding: 16px; }
            .episode { padding: 16px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">AI ADDICT</div>
            <div class="tagline">Key insights from your favorite AI channels are ready</div>
          </div>
          <div class="content">
    `;

    // Add trend analysis if available
    if (trendAnalysis) {
      html += `
        <div class="section">
          <div class="section-header">
            <div class="section-title">🔍 Trend Analysis</div>
          </div>
          <div class="section-content">
            <div class="trends">
              <div class="trends-title">Meta Insights</div>
              <p style="color: #374151; line-height: 1.6; margin-bottom: 16px;">${trendAnalysis.metaInsights || 'No meta insights available'}</p>
              
              ${trendAnalysis.recurringThemes && trendAnalysis.recurringThemes.length > 0 ? `
              <div class="insights-section">
                <div class="insights-title">Recurring Themes</div>
                <ul class="insights-list">
                  ${trendAnalysis.recurringThemes.map(theme => `<li>${theme}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
              
              ${trendAnalysis.emergingTopics && trendAnalysis.emergingTopics.length > 0 ? `
              <div class="insights-section">
                <div class="insights-title">Emerging Topics</div>
                <ul class="insights-list">
                  ${trendAnalysis.emergingTopics.map(topic => `<li>${topic}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }

    // Add episode summaries
    if (summaries && summaries.length > 0) {
      html += `
        <div class="section">
          <div class="section-header">
            <div class="section-title">📝 Episode Summaries</div>
          </div>
          <div class="section-content">
      `;

      summaries.forEach(episode => {
        html += `
          <div class="episode">
            <div class="episode-channel">${episode.podcastName}</div>
            <div class="episode-title">${episode.title}</div>
            <p style="color: #374151; line-height: 1.6; margin-bottom: 16px;">${episode.fullSummary}</p>
            
            <div class="insights-section">
              <div class="insights-title">Key Insights</div>
              <ul class="insights-list">
                ${episode.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
              </ul>
            </div>
            
            <div class="insights-section">
              <div class="insights-title">Actionable Items</div>
              <ul class="insights-list">
                ${episode.actionableItems.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          </div>
        `;
      });

      html += `</div></div>`;
    }

    html += `
          </div>
          <div class="footer">
            <div class="footer-text">Generated by AI Addict</div>
            <div class="timestamp">${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  createWeeklyOverviewEmailContent(weeklyOverview, episodeCount, dateRange) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly AI Podcast Overview</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; margin-bottom: 30px; }
          .overview-section { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ff6b6b; }
          .stats { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 10px 0; text-align: center; }
          .insights-list { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .insights-list ul { margin: 0; padding-left: 20px; }
          .insights-list li { margin: 5px 0; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📅 Weekly AI Podcast Overview</h1>
          <p>Your comprehensive weekly summary of AI insights</p>
        </div>

        <div class="stats">
          <h3>📊 This Week's Stats</h3>
          <p><strong>${episodeCount}</strong> episodes analyzed</p>
          <p>Date range: ${new Date(dateRange.from).toLocaleDateString()} - ${new Date(dateRange.to).toLocaleDateString()}</p>
        </div>

        <div class="overview-section">
          <h2>📋 Executive Summary</h2>
          <p>${weeklyOverview.executiveSummary}</p>
        </div>

        <div class="overview-section">
          <h2>📈 Key Trends</h2>
          <div class="insights-list">
            <ul>
              ${weeklyOverview.keyTrends.map(trend => `<li>${trend}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="overview-section">
          <h2>💡 Top Insights</h2>
          <div class="insights-list">
            <ul>
              ${weeklyOverview.topInsights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="overview-section">
          <h2>🎯 Channel Highlights</h2>
          <div class="insights-list">
            <ul>
              ${weeklyOverview.channelHighlights.map(highlight => `<li>${highlight}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="overview-section">
          <h2>🚀 Recommendations</h2>
          <div class="insights-list">
            <ul>
              ${weeklyOverview.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Generated by AI Podcast Summarizer</p>
          <p>Stay ahead with weekly AI insights!</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Email MCP Server started');
  }
}

// Export the class for use in HTTP server
export { EmailMCPServer };

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EmailMCPServer();
  server.run().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
} 