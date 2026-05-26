import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';

const collectRunnerStatusMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/runner-status.js', () => ({
  collectRunnerStatus: collectRunnerStatusMock,
}));

async function importRunnerApp() {
  vi.resetModules();
  const mod = await import('./runner.js');
  const app = new Hono();
  app.route('/', mod.default);
  return app;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('GET /api/runner/status', () => {
  it('returns the non-mutating runner status report', async () => {
    collectRunnerStatusMock.mockResolvedValue({
      ok: true,
      observedAt: '2026-05-26T00:00:00.000Z',
      repoPath: '/tmp/repo',
      branch: 'runner',
      head: 'abc123',
      status: { ok: true, mode: 'disabled', mutations: 0 },
      doctor: { ok: true, mutations: 0 },
      safety: {
        dashboardMutations: 0,
        liveDispatchEnabled: false,
        serviceMutationEnabled: false,
        commands: ['python3 -m runnerd.cli status --json'],
      },
      commands: {},
    });

    const app = await importRunnerApp();
    const res = await app.request('/api/runner/status');
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.safety).toMatchObject({
      dashboardMutations: 0,
      liveDispatchEnabled: false,
      serviceMutationEnabled: false,
    });
  });

  it('reports unavailable runner status as a service-unavailable probe failure', async () => {
    collectRunnerStatusMock.mockResolvedValue({
      ok: false,
      observedAt: '2026-05-26T00:00:00.000Z',
      repoPath: null,
      branch: null,
      head: null,
      status: null,
      doctor: null,
      safety: {
        dashboardMutations: 0,
        liveDispatchEnabled: false,
        serviceMutationEnabled: false,
        commands: [],
      },
      commands: {},
      error: 'runnerd repository not found',
    });

    const app = await importRunnerApp();
    const res = await app.request('/api/runner/status');
    expect(res.status).toBe(503);
    const json = await res.json() as Record<string, unknown>;
    expect(json.error).toBe('runnerd repository not found');
  });
});
