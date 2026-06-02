import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { collectWebhookQueueHealth } from './runner-status.js';

const ORIGINAL_QUEUE_PATH = process.env.RUNNER_LINEAR_WEBHOOK_QUEUE_PATH;
const ORIGINAL_STATUS_PATH = process.env.RUNNER_LINEAR_WEBHOOK_STATUS_PATH;

afterEach(() => {
  if (ORIGINAL_QUEUE_PATH === undefined) {
    delete process.env.RUNNER_LINEAR_WEBHOOK_QUEUE_PATH;
  } else {
    process.env.RUNNER_LINEAR_WEBHOOK_QUEUE_PATH = ORIGINAL_QUEUE_PATH;
  }
  if (ORIGINAL_STATUS_PATH === undefined) {
    delete process.env.RUNNER_LINEAR_WEBHOOK_STATUS_PATH;
  } else {
    process.env.RUNNER_LINEAR_WEBHOOK_STATUS_PATH = ORIGINAL_STATUS_PATH;
  }
});

async function withTempQueue<T>(callback: (queuePath: string, statusPath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'nerve-runner-queue-'));
  const queuePath = join(dir, 'inbox.jsonl');
  const statusPath = join(dir, 'webhook-status.jsonl');
  process.env.RUNNER_LINEAR_WEBHOOK_QUEUE_PATH = queuePath;
  process.env.RUNNER_LINEAR_WEBHOOK_STATUS_PATH = statusPath;
  try {
    return await callback(queuePath, statusPath);
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
      expect(health.handling.state).toBe('not_configured');
      expect(health.handling.classifications.emptyQueue).toBe(1);
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

  it('classifies sanitized webhook status events without exposing raw payload fields', async () => {
    await withTempQueue(async (queuePath, statusPath) => {
      await writeFile(queuePath, '', 'utf8');
      await writeFile(
        statusPath,
        [
          {
            observedAt: '2026-06-02T10:00:00.000Z',
            classification: 'accepted_ingress',
            state: 'accepted',
            eventClass: 'Issue.create',
            issueKey: 'OC-106',
            rawPayload: 'payload must not appear',
          },
          {
            observedAt: '2026-06-02T10:01:00.000Z',
            classification: 'invalid_refusal',
            state: 'refused',
            reason: 'invalid_signature',
            eventClass: 'webhook.refusal',
          },
          {
            observedAt: '2026-06-02T10:02:00.000Z',
            classification: 'ignored_delivery',
            state: 'ignored',
            reason: 'no_routable_actions',
            eventClass: 'Comment.create',
          },
          {
            observedAt: '2026-06-02T10:03:00.000Z',
            classification: 'consumed_noop_wake',
            state: 'handled',
            reason: 'queue_empty_after_complete',
            eventClass: 'linear_queue.complete',
          },
        ].map((item) => JSON.stringify(item)).join('\n') + '\n',
        'utf8',
      );

      const health = await collectWebhookQueueHealth('2026-06-02T10:04:00.000Z');

      expect(health.consumer.state).toBe('healthy');
      expect(health.counts.valid).toBe(1);
      expect(health.counts.invalidSignature).toBe(1);
      expect(health.counts.ignored).toBe(1);
      expect(health.counts.handled).toBe(1);
      expect(health.handling.classifications.acceptedIngress).toBe(1);
      expect(health.handling.classifications.invalidRefusal).toBe(1);
      expect(health.handling.classifications.emptyQueue).toBe(1);
      expect(health.lastValidDelivery).toBe('2026-06-02T10:00:00.000Z');
      expect(health.lastInvalidSignature).toBe('2026-06-02T10:01:00.000Z');
      expect(health.recent[0].classification).toBe('consumed_noop_wake');
      expect(JSON.stringify(health)).not.toContain('payload must not appear');
    });
  });

  it('marks pending queue entries stale after the dashboard threshold', async () => {
    await withTempQueue(async (queuePath, statusPath) => {
      await writeFile(
        queuePath,
        `${JSON.stringify({ id: 'OC-106', issueId: 'OC-106', event: 'ticket', status: 'pending' })}\n`,
        'utf8',
      );
      await writeFile(statusPath, '', 'utf8');
      const staleTime = new Date('2026-06-02T10:00:00.000Z');
      await utimes(queuePath, staleTime, staleTime);

      const health = await collectWebhookQueueHealth('2026-06-02T10:06:00.000Z');

      expect(health.queue.depth).toBe(1);
      expect(health.queue.stale).toBe(true);
      expect(health.consumer.state).toBe('blocked');
      expect(health.handling.classifications.staleQueue).toBe(1);
    });
  });
});
