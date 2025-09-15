#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.HTTP_PORT || process.env.PORT || 3000;

// Serve static assets from the assets folder
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export function createServer() {
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  return server;
}

export default app;