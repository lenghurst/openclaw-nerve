import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunnerPanel } from './RunnerPanel';
import type { RunnerStatusReport } from './useRunnerStatus';

const { refreshMock, stateRef } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  stateRef: {
    current: null as null | {
      data: RunnerStatusReport | null;
      loading: boolean;
      error: string | null;
      refresh: ReturnType<typeof vi.fn>;
    },
  },
}));

vi.mock('./useRunnerStatus', () => ({
  useRunnerStatus: () => stateRef.current,
}));

function runnerReport(): RunnerStatusReport {
  const artifact = {
    route: 'codex_exec',
    packetId: 'packet-autonomy-OC-55-bba05a44ba03',
    autonomy: true,
    evidenceDir: '/home/ubuntu/.local/state/openclaw-runner/evidence/run-abc',
    worktreePath: '/home/ubuntu/.local/state/openclaw-runner/worktrees/run-abc',
    workspaceId: 'workspace:run-abc',
    finalHead: '70dbebbcea0c95686d83b1bf264eb75184837017',
    manifestPresent: true,
    files: [
      { path: 'manifest.json', sha256: 'abc' },
      { path: 'codex-events.jsonl', sha256: 'def' },
      { path: 'no-diff.json', sha256: 'ghi' },
    ],
    command: {
      cwd: '/home/ubuntu/.local/state/openclaw-runner/worktrees/run-abc',
      exitCode: 0,
      stdoutRef: 'codex-events.jsonl',
      stderrRef: 'codex-stderr.txt',
      argvRedacted: ['codex', 'exec', '--json', '[prompt-redacted]'],
    },
    transcriptRef: 'codex-events.jsonl',
    stderrRef: 'codex-stderr.txt',
    hasDiff: false,
    noDiff: true,
  };

  return {
    ok: true,
    observedAt: '2026-05-27T12:00:00.000Z',
    repoPath: '/home/ubuntu/runnerd-service-checkout-oc52-fixed',
    branch: 'main',
    head: '70dbebbcea0c95686d83b1bf264eb75184837017',
    status: { ok: true, mode: 'class_scoped_autonomy', route: 'codex_exec', mutations: 0 },
    doctor: { ok: true, mutations: 0 },
    scan: { ok: true, decision: 'idle', dry_run: true, claims_created: 0, launches: 0, mutations: 0 },
    liveReadiness: {
      ok: false,
      live_readiness: {
        status: 'blocked_live',
        live_ready: false,
        blocker_count: 1,
        gate_chips: [{ id: 'worker_evidence', state: 'blocked', why_blocked: 'awaiting first dispatch evidence' }],
      },
    },
    authoritySnapshot: null,
    work: {
      ok: true,
      observedAt: '2026-05-27T12:00:00.000Z',
      source: { runnerDb: true, linear: { ok: true, project: 'runner' } },
      summary: {
        activeExecutions: 1,
        reviewRuns: 1,
        observedTasks: 1,
        activeLinearIssues: 1,
        openLinearIssues: 1,
        readyLinearIssues: 1,
        dorBlockedLinearIssues: 0,
        backlogLinearIssues: 0,
        todoLinearIssues: 0,
        projects: 1,
        lastEventAt: '2026-05-27T11:59:00.000Z',
      },
      projects: [{ id: 'runner', name: 'runner', state: 'active', active: 1, review: 1, total: 1, completed: 0 }],
      items: [{
        id: 'OC-55',
        title: 'Prove codex_exec worker visibility',
        url: 'https://linear.app/oc-oracle/issue/OC-55',
        project: { id: 'runner', name: 'runner', state: 'active' },
        state: { name: 'In Progress', type: 'started' },
        runner: {
          status: 'launched',
          workerRoute: 'codex_exec',
          workerStatus: 'launched',
          validation: 'passed',
          runId: 'run-abc',
          lastEventAt: '2026-05-27T11:59:00.000Z',
          source: 'runner_db',
          artifact,
        },
        readiness: {
          verdict: 'ready',
          executable: true,
          hitlClass: 'No-HITL',
          missing: [],
          refusalCodes: [],
          plannedRunDir: '/home/ubuntu/ai-vault/runs/2026-05-27-runner-panel-test',
        },
        updatedAt: '2026-05-27T11:59:00.000Z',
      }],
      queueItems: [],
      recentRuns: [{
        runId: 'run-abc',
        taskId: 'OC-55',
        title: 'Prove codex_exec worker visibility',
        status: 'review',
        workerRoute: 'codex_exec',
        workerStatus: 'launched',
        validation: 'passed',
        createdAt: '2026-05-27T11:58:00.000Z',
        updatedAt: '2026-05-27T11:59:00.000Z',
        durationMs: 60_000,
        artifact,
      }],
      cycles: [],
      flow: [{ date: '2026-05-27', claimed: 1, launched: 1, review: 1, validated: 1, blocked: 0, total: 4 }],
    },
    webhookQueue: {
      ok: true,
      state: 'not_configured',
      lastValidDelivery: null,
      lastInvalidSignature: null,
      counts: {
        valid: 0,
        invalidSignature: 0,
        queued: 0,
        handled: 0,
        ignored: 0,
      },
      queue: { depth: 0, lagSeconds: null },
      consumer: {
        state: 'not_configured',
        detail: 'Linear webhook events are not configured as Runner authority in this deployment.',
      },
      recent: [],
      notes: ['Webhook events are request signals only.'],
    },
    autonomy: {
      state: 'autonomous',
      label: 'Autonomous work active',
      tone: 'safe',
      reasons: ['mode:class_scoped_autonomy'],
      mode: 'class_scoped_autonomy',
      liveReady: false,
      dispatchEnabled: true,
      activeExecutions: 1,
      openLinearIssues: 1,
      readyLinearIssues: 1,
      dorBlockedLinearIssues: 0,
      backlogLinearIssues: 0,
      todoLinearIssues: 0,
    },
    autonomyView: {
      mode: 'class_scoped_autonomy',
      activationMode: 'class_scoped_autonomy',
      approval: {
        state: 'blocked',
        approvalId: 'runnerd-live-ubuntu-v0',
        path: '/home/ubuntu/.local/state/openclaw-runner/approvals/runnerd-full-autonomy-2026-05-30.json',
      },
      dispositions: {
        summary: {
          auto_execute: 1,
          auto_normalize_then_execute: 0,
          auto_review: 0,
          auto_recover: 1,
          auto_plan: 0,
          blocked_by_policy: 0,
        },
        lanes: {
          running: 1,
          ready: 1,
          needsInfo: 0,
          approvalGated: 0,
          reviewOnly: 0,
          blocked: 0,
          completed: 0,
        },
      },
      operatorActions: [
        { id: 'kill_switch', label: 'Kill switch', state: 'clear', reason: 'clear' },
        { id: 'rollback', label: 'Rollback', state: 'attention', reason: 'rollback_verification_missing' },
      ],
      workerRoutes: [
        { route: 'codex_exec', state: 'active', active: 1, recent: 1, health: 'observed' },
      ],
      routeHealth: {
        codex_exec: { state: 'active', active: 1, recent: 1, health: 'observed' },
      },
      approvalQueue: { count: 0, items: [] },
      rollbackReadiness: { state: 'attention', reasons: ['rollback_verification_missing'] },
      writebackHealth: { state: 'attention', held: 0, reasons: ['linear_writeback_verification_missing'] },
      budget: { timeBudgetSeconds: 180, tokenBudget: 2000 },
      killSwitch: { active: false, valid: true, source: 'emergency_sentinel', reason: 'clear' },
      dashboardMutations: 0,
    },
    liveDbPath: '/home/ubuntu/.local/state/openclaw-runner/runnerd.sqlite',
    safety: {
      dashboardMutations: 0,
      liveDispatchEnabled: false,
      serviceMutationEnabled: false,
      commands: [],
    },
    commands: {},
  };
}

beforeEach(() => {
  refreshMock.mockReset();
  stateRef.current = {
    data: runnerReport(),
    loading: false,
    error: null,
    refresh: refreshMock,
  };
});

describe('RunnerPanel', () => {
  it('renders codex_exec worker evidence and isolated worktree paths', () => {
    render(<RunnerPanel />);

    expect(screen.getAllByText('codex_exec').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/home/ubuntu/.local/state/openclaw-runner/worktrees/run-abc').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/home/ubuntu/.local/state/openclaw-runner/evidence/run-abc').length).toBeGreaterThan(0);
    expect(screen.getAllByText('codex-events.jsonl').length).toBeGreaterThan(0);
    expect(screen.getAllByText('no diff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('packet-autonomy-OC-55-bba05a44ba03').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ready for Runner').length).toBeGreaterThan(0);
    expect(screen.getByText('Approval surface')).toBeInTheDocument();
    expect(screen.getAllByText('codex_exec').length).toBeGreaterThan(0);
    expect(screen.getByText('Linear event queue')).toBeInTheDocument();
    expect(screen.getByText('showing 0 of 0')).toBeInTheDocument();
  });

  it('renders healthy idle with no ready issues as idle rather than blocked', () => {
    const report = runnerReport();
    report.liveReadiness = { ok: true, live_readiness: { status: 'live_ready', live_ready: true, blocker_count: 0, gate_chips: [] } };
    report.work!.summary.readyLinearIssues = 0;
    report.work!.summary.dorBlockedLinearIssues = 1;
    report.work!.items = [];
    report.work!.queueItems = [{
      id: 'OC-61',
      title: 'Polish Runner dashboard UX',
      state: { name: 'Todo', type: 'unstarted' },
      runner: { status: 'not claimed', source: 'linear' },
      readiness: {
        verdict: 'missing',
        executable: true,
        hitlClass: 'No-HITL',
        missing: ['evidence_plan'],
        refusalCodes: [],
      },
    }];
    report.autonomy = {
      state: 'idle',
      label: 'Autonomy idle; no ready issues',
      tone: 'safe',
      reasons: ['mode:class_scoped_autonomy', 'not_ready:1'],
      mode: 'class_scoped_autonomy',
      liveReady: true,
      dispatchEnabled: true,
      activeExecutions: 0,
      openLinearIssues: 1,
      readyLinearIssues: 0,
      dorBlockedLinearIssues: 1,
      backlogLinearIssues: 0,
      todoLinearIssues: 1,
    };
    stateRef.current = {
      data: report,
      loading: false,
      error: null,
      refresh: refreshMock,
    };

    render(<RunnerPanel />);

    expect(screen.getAllByText('Autonomy idle; no ready issues').length).toBeGreaterThan(0);
    expect(screen.queryByText('Autonomy blocked')).not.toBeInTheDocument();
    expect(screen.getByText('1 readiness gaps')).toBeInTheDocument();
  });
});
