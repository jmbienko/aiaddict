import express from 'express';
import cors from 'cors';
import { EmailMCPServer } from './server.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Debug: Check if environment variables are loaded
console.log('Environment variables loaded:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Not set');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize email MCP server
const emailServer = new EmailMCPServer();

// Routes
app.post('/send_summary_email', async (req, res) => {
  try {
    const result = await emailServer.sendSummaryEmail(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/send_weekly_overview_email', async (req, res) => {
  try {
    const result = await emailServer.sendWeeklyOverviewEmail(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/send_bulk_email', async (req, res) => {
  try {
    const result = await emailServer.sendBulkEmail(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/send_test_email', async (req, res) => {
  try {
    const result = await emailServer.sendTestEmail(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'email-mcp-server' });
});

// Start server
app.listen(port, () => {
  console.log(`📧 Email MCP HTTP Server running on port ${port}`);
}); 