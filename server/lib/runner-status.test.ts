import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { collectWebhookQueueHealth } from './runner-status.js';

const ORIGINAL_QUEUE_PATH = process.env.RUNNER_LINEAR_WEBHOOK_QUEUE_PATH;

afterEach(() => {
  if (ORIGINAL_QUEUE_PATH === undefined) {
    delete process.env.RUNNER_LINEAR_WEBHOOK_QUEUE_PATH;
  } else {
    process.env.RUNNER_LINEAR_WEBHOOK_QUEUE_PATH = ORIGINAL_QUEUE_PATH;
  }
});

async function withTempQueue<T>(callback: (queuePath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'nerve-runner-queue-'));
  const queuePath = join(dir, 'inbox.jsonl');
  process.env.RUNNER_LINEAR_WEBHOOK_QUEUE_PATH = queuePath;
  try {
    return await callback(queuePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('collectWebhookQueueHealth', () => {
  it('reports a missing configured queue path without assuming webhook authority', async () => {
    await withTempQueue(async () => {
      const health = await collectWebhookQueueHealth('2026-06-02T10:00:00.000Z');

      expect(health.ok).toBe(false);
      expect(health.state).toBe('not_configured');
      expect(health.consumer.state).toBe('not_configured');
      expect(health.queue.depth).toBe(0);
      expect(health.counts.queued).toBe(0);
    });
  });

  it('reports an observed empty queue as read-only dashboard truth', async () => {
    await withTempQueue(async (queuePath) => {
      await writeFile(queuePath, '', 'utf8');

      const health = await collectWebhookQueueHealth('2026-06-02T10:00:00.000Z');

      expect(health.ok).toBe(true);
      expect(health.state).toBe('observed');
      expect(health.queue.depth).toBe(0);
      expect(health.consumer.state).toBe('unknown');
      expect(health.notes.join(' ')).toContain('read-only');
    });
  });

  it('summarizes queued JSONL entries without exposing raw payload fields', async () => {
    await withTempQueue(async (queuePath) => {
      await writeFile(
        queuePath,
        `${JSON.stringify({
          type: 'Issue',
          action: 'create',
          issue: { identifier: 'OC-106', title: 'OC-106 synthetic smoke' },
          rawPayload: 'payload must not appear',
        })}\n`,
        'utf8',
      );

      const health = await collectWebhookQueueHealth('2026-06-02T10:00:00.000Z');

      expect(health.ok).toBe(true);
      expect(health.queue.depth).toBe(1);
      expect(health.counts.queued).toBe(1);
      expect(health.recent[0]).toMatchObject({
        issueKey: 'OC-106',
        eventClass: 'Issue.create',
        state: 'queued',
      });
      expect(JSON.stringify(health)).not.toContain('payload must not appear');
    });
  });
});
