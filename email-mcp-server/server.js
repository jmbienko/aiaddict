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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
          .section { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
          .episode { margin: 20px 0; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #667eea; }
          .insights { background: #e8f4fd; padding: 10px; border-radius: 4px; margin: 10px 0; }
          .trends { background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; }
          h1, h2, h3 { color: #667eea; }
          .footer { text-align: center; margin-top: 40px; padding: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎙️ AI Podcast Summary</h1>
            <p>Your personalized podcast insights are ready!</p>
          </div>
    `;

    // Add trend analysis if available
    if (trendAnalysis) {
      html += `
        <div class="section">
          <h2>🔍 Trend Analysis</h2>
          <div class="trends">
            <p><strong>Meta Insights:</strong></p>
            <p>${trendAnalysis}</p>
          </div>
        </div>
      `;
    }

    // Add episode summaries
    if (summaries && summaries.length > 0) {
      html += `
        <div class="section">
          <h2>📝 Episode Summaries</h2>
      `;

      summaries.forEach(episode => {
        html += `
          <div class="episode">
            <h3>${episode.podcastName} - ${episode.title}</h3>
            <p><strong>Summary:</strong></p>
            <p>${episode.fullSummary}</p>
            
            <div class="insights">
              <p><strong>Key Insights:</strong></p>
              <ul>
                ${episode.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
              </ul>
            </div>
            
            <div class="insights">
              <p><strong>Actionable Items:</strong></p>
              <ul>
                ${episode.actionableItems.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    html += `
          <div class="footer">
            <p>Generated by AI Podcast Summarizer</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
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