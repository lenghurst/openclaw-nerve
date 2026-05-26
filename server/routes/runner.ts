import { Hono } from 'hono';
import { collectRunnerStatus } from '../lib/runner-status.js';

const app = new Hono();

app.get('/api/runner/status', async (c) => {
  const status = await collectRunnerStatus();
  return c.json(status, status.ok ? 200 : 503);
});

export default app;
