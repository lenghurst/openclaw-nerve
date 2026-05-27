import { Hono } from 'hono';
import { collectRunnerStatus } from '../lib/runner-status.js';

const app = new Hono();

app.get('/api/runner/status', async (c) => {
  const force = c.req.query('refresh') === '1';
  const status = await collectRunnerStatus({ force });
  return c.json(status, status.ok ? 200 : 503);
});

export default app;
