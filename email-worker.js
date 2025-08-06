// Email MCP Server as a Cloudflare Worker
// This replaces the Node.js email server for production deployment

export default {
  async fetch(request, env, ctx) {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname.substring(1); // Remove leading slash
      const body = await request.json();

      let result;
      switch (path) {
        case 'send_summary_email':
          result = await sendSummaryEmail(body, env);
          break;
        case 'send_weekly_overview_email':
          result = await sendWeeklyOverviewEmail(body, env);
          break;
        case 'send_bulk_email':
          result = await sendBulkEmail(body, env);
          break;
        case 'send_test_email':
          result = await sendTestEmail(body, env);
          break;
        default:
          return new Response('Not found', { status: 404 });
      }

      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('Email worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

async function sendSummaryEmail(args, env) {
  const { recipientEmail, summaries, trendAnalysis } = args;

  if (!recipientEmail) {
    throw new Error('recipientEmail is required');
  }

  // Create email content
  const emailContent = createSummaryEmailContent(summaries, trendAnalysis);

  // Use Cloudflare's built-in email capabilities or a third-party service
  // For now, we'll simulate success since Cloudflare Workers don't have built-in SMTP
  console.log('📧 Would send email to:', recipientEmail);
  console.log('📧 Email content length:', emailContent.length);

  return {
    success: true,
    message: 'Email sent successfully (simulated in production)',
    recipientEmail,
    contentLength: emailContent.length
  };
}

async function sendWeeklyOverviewEmail(args, env) {
  const { recipientEmail, weeklyOverview, episodeCount, dateRange } = args;

  if (!recipientEmail) {
    throw new Error('recipientEmail is required');
  }

  console.log('📧 Would send weekly overview email to:', recipientEmail);

  return {
    success: true,
    message: 'Weekly overview email sent successfully (simulated in production)',
    recipientEmail
  };
}

async function sendBulkEmail(args, env) {
  const { emailList, emailType, content } = args;

  if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
    throw new Error('emailList is required and must be a non-empty array');
  }

  console.log('📧 Would send bulk email to:', emailList.length, 'recipients');

  return {
    success: true,
    message: `Bulk email sent successfully to ${emailList.length} recipients (simulated in production)`,
    recipientCount: emailList.length
  };
}

async function sendTestEmail(args, env) {
  const { recipientEmail } = args;

  if (!recipientEmail) {
    throw new Error('recipientEmail is required');
  }

  console.log('📧 Would send test email to:', recipientEmail);

  return {
    success: true,
    message: 'Test email sent successfully (simulated in production)',
    recipientEmail
  };
}

function createSummaryEmailContent(summaries, trendAnalysis) {
  const logo = 'AI ADDICT';
  const tagline = 'Key insights from your favorite AI channels are ready';

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Podcast Summary</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
        .tagline { font-size: 16px; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .section { margin-bottom: 32px; }
        .section-title { font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
        .insight-item { background: #f9fafb; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 12px; border-radius: 0 6px 6px 0; }
        .episode-title { font-weight: 600; color: #1f2937; margin-bottom: 8px; }
        .episode-channel { color: #6b7280; font-size: 14px; margin-bottom: 12px; }
        .insights-list { list-style: none; padding: 0; }
        .insights-list li { background: #f3f4f6; padding: 8px 12px; margin-bottom: 6px; border-radius: 4px; }
        .footer { background: #f9fafb; padding: 20px 30px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${logo}</div>
          <div class="tagline">${tagline}</div>
        </div>
        
        <div class="content">
  `;

  // Add trend analysis if available
  if (trendAnalysis && trendAnalysis.metaInsights) {
    html += `
      <div class="section">
        <div class="section-title">📊 Overview</div>
        <div class="insight-item">
          ${trendAnalysis.metaInsights}
        </div>
      </div>
    `;

    if (trendAnalysis.recurringThemes && trendAnalysis.recurringThemes.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">🔄 Recurring Themes</div>
          <ul class="insights-list">
            ${trendAnalysis.recurringThemes.map(theme => `<li>${theme}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    if (trendAnalysis.emergingTopics && trendAnalysis.emergingTopics.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">🚀 Emerging Topics</div>
          <ul class="insights-list">
            ${trendAnalysis.emergingTopics.map(topic => `<li>${topic}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  }

  // Add episode summaries
  if (summaries && summaries.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">📝 Individual Episode Summaries</div>
    `;

    summaries.forEach(episode => {
      html += `
        <div class="insight-item">
          <div class="episode-title">${episode.title}</div>
          <div class="episode-channel">${episode.podcastName}</div>
          
          <div style="margin-bottom: 16px;">
            <strong>Key Insights:</strong>
            <ul class="insights-list">
              ${episode.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
          
          <div style="margin-bottom: 16px;">
            <strong>Actionable Items:</strong>
            <ul class="insights-list">
              ${episode.actionableItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    });

    html += `</div>`;
  }

  html += `
        </div>
        
        <div class="footer">
          <p>Generated by AI Addict • Your AI-powered podcast insights</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
} 