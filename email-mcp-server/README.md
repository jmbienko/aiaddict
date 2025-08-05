# Email MCP Server

This is a Model Context Protocol (MCP) server that provides email functionality for sending podcast summaries.

## Features

- **Summary Emails**: Send beautifully formatted podcast summaries via email
- **Test Emails**: Send test emails to verify configuration
- **HTML Templates**: Rich HTML email templates with styling

## Setup

### 1. Install Dependencies

```bash
cd email-mcp-server
npm install
```

### 2. Environment Variables

Create a `.env` file in the `email-mcp-server` directory:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com
```

### 3. Email Configuration

#### Gmail Setup (Recommended)

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Use the generated password as `EMAIL_PASS`

#### Other Email Providers

- **Outlook/Hotmail**: Use `smtp-mail.outlook.com` as host
- **Yahoo**: Use `smtp.mail.yahoo.com` as host
- **Custom SMTP**: Use your provider's SMTP settings

## Usage

### Start the Server

```bash
npm start
```

### Available Tools

The server provides the following MCP tools:

#### `send_summary_email`

Sends a formatted podcast summary email to the specified recipient.

**Parameters:**
- `recipientEmail` (string, required): Email address to send to
- `summaries` (array, optional): Array of episode summaries
- `trendAnalysis` (string, optional): Trend analysis text

**Example:**
```json
{
  "name": "send_summary_email",
  "arguments": {
    "recipientEmail": "user@example.com",
    "summaries": [
      {
        "podcastName": "Huberman Lab",
        "title": "Episode Title",
        "fullSummary": "Summary text...",
        "keyInsights": ["Insight 1", "Insight 2"],
        "actionableItems": ["Action 1", "Action 2"]
      }
    ],
    "trendAnalysis": "Trend analysis text..."
  }
}
```

#### `send_test_email`

Sends a test email to verify the email configuration.

**Parameters:**
- `recipientEmail` (string, required): Email address to send to

**Example:**
```json
{
  "name": "send_test_email",
  "arguments": {
    "recipientEmail": "user@example.com"
  }
}
```

## Email Template

The server generates beautiful HTML emails with:

- **Header**: Gradient background with title
- **Trend Analysis**: Highlighted section for meta insights
- **Episode Summaries**: Individual cards for each episode
- **Key Insights**: Bulleted lists of main takeaways
- **Actionable Items**: Specific actions listeners can take
- **Responsive Design**: Works on desktop and mobile

## Integration with Main Application

The main application expects this MCP server to be running and accessible via the `EMAIL_MCP_SERVER_URL` environment variable. The server communicates using JSON-RPC over stdio.

## Development

For development with auto-restart:

```bash
npm run dev
```

## Troubleshooting

1. **"EMAIL_USER and EMAIL_PASS environment variables are required"**
   - Make sure you've set up the `.env` file correctly
   - Verify your email credentials are valid

2. **"Authentication failed"**
   - For Gmail: Make sure you're using an App Password, not your regular password
   - Check that 2-Factor Authentication is enabled
   - Verify the email and password are correct

3. **"Connection timeout"**
   - Check your internet connection
   - Verify the SMTP host and port are correct
   - Some networks may block SMTP traffic

4. **"Message rejected"**
   - Check that the recipient email is valid
   - Some email providers may block emails from certain sources
   - Verify your email provider allows SMTP sending

## Security Notes

- Never commit your `.env` file to version control
- Use App Passwords instead of regular passwords for Gmail
- Consider using environment variables in production
- The server only accepts requests via stdio, not HTTP 