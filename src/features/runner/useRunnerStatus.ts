import { useCallback, useEffect, useRef, useState } from 'react';

export interface RunnerProbeCommand {
  ok: boolean;
  command: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

export interface RunnerWorkItem {
  id: string;
  title: string;
  descriptionPreview?: string;
  url?: string;
  project?: {
    id?: string;
    name?: string;
    url?: string;
    state?: string;
  };
  parent?: {
    id: string;
    title?: string;
  };
  assignee?: string;
  priority?: number;
  state: {
    name: string;
    type?: string;
  };
  cycle?: {
    id?: string;
    name?: string;
    number?: number;
    startsAt?: string;
    endsAt?: string;
    completedAt?: string | null;
  };
  runner: {
    status: string;
    claimStatus?: string;
    runId?: string;
    workerRoute?: string;
    workerStatus?: string;
    validation?: string;
    workflowHash?: string;
    lastRunAt?: string;
    lastEventAt?: string;
    lastEventType?: string;
    artifact?: RunnerWorkerArtifact;
    source: 'runner_db' | 'linear';
  };
  readiness?: {
    verdict: 'ready' | 'missing' | 'non_executable';
    executable: boolean;
    hitlClass?: string;
    missing: string[];
    refusalCodes: string[];
    plannedRunDir?: string;
  };
  updatedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface RunnerRunSummary {
  runId: string;
  taskId: string;
  title?: string;
  url?: string;
  status: string;
  claimStatus?: string;
  workerRoute?: string;
  workerStatus?: string;
  validation?: string;
  refusalCode?: string | null;
  artifact?: RunnerWorkerArtifact;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  eventType?: string;
}

export interface RunnerWorkerArtifact {
  route?: string;
  packetId?: string;
  autonomy?: boolean;
  evidenceDir?: string;
  worktreePath?: string;
  workspaceId?: string;
  finalHead?: string;
  manifestPresent: boolean;
  files: Array<{
    path: string;
    sha256?: string;
  }>;
  command?: {
    cwd?: string;
    exitCode?: number | null;
    stdoutRef?: string;
    stderrRef?: string;
    argvRedacted?: string[];
  };
  transcriptRef?: string;
  stderrRef?: string;
  diffRef?: string;
  hasDiff: boolean;
  noDiff: boolean;
  operatorSummary?: {
    outcome?: string;
    nextAction?: string;
    diffState?: string;
    changedFiles: string[];
    validation?: string;
    refusalCodes: string[];
    workerDirectWriteback?: string;
    evidenceRefs: string[];
    threadId?: string;
    commandEventCount?: number;
    workerFinalMessage?: string;
  };
}

export interface RunnerWorkDigest {
  ok: boolean;
  observedAt: string;
  source: {
    runnerDb: boolean;
    linear: {
      ok: boolean;
      project: string;
      stale?: boolean;
      error?: string;
    };
  };
  summary: {
    activeExecutions: number;
    reviewRuns: number;
    observedTasks: number;
    activeLinearIssues: number;
    openLinearIssues: number;
    readyLinearIssues: number;
    dorBlockedLinearIssues: number;
    backlogLinearIssues: number;
    todoLinearIssues: number;
    projects: number;
    lastEventAt: string | null;
  };
  projects: Array<{
    id: string;
    name: string;
    url?: string;
    state?: string;
    active: number;
    review: number;
    total: number;
    completed: number;
  }>;
  items: RunnerWorkItem[];
  queueItems: RunnerWorkItem[];
  recentRuns: RunnerRunSummary[];
  cycles: Array<{
    id: string;
    name: string;
    position: 'current' | 'upcoming' | 'past' | 'uncycled';
    startsAt?: string;
    endsAt?: string;
    completedAt?: string | null;
    active: number;
    review: number;
    backlog: number;
    todo: number;
    completed: number;
    total: number;
    items: Array<{
      id: string;
      title: string;
      url?: string;
      state: string;
      stateType?: string;
      runnerStatus: string;
    }>;
  }>;
  flow: Array<{
    date: string;
    claimed: number;
    launched: number;
    review: number;
    validated: number;
    blocked: number;
    total: number;
  }>;
}

export interface RunnerStatusReport {
  ok: boolean;
  observedAt: string;
  repoPath: string | null;
  branch: string | null;
  head: string | null;
  status: {
    ok?: boolean;
    mode?: string;
    route?: string;
    mutations?: number;
    db_health?: {
      healthy?: boolean;
      status?: string;
      schema_version?: string;
      details?: string[];
    };
  } | null;
  doctor: {
    ok?: boolean;
    strict?: boolean;
    findings?: string[];
    mutations?: number;
    db_health?: {
      healthy?: boolean;
      status?: string;
      schema_version?: string;
      details?: string[];
    };
  } | null;
  scan: {
    ok?: boolean;
    decision?: string;
    dry_run?: boolean;
    claims_created?: number;
    launches?: number;
    mutations?: number;
  } | null;
  liveReadiness: {
    ok?: boolean;
    live_readiness?: {
      status?: string;
      state?: string;
      live_ready?: boolean;
      blocker_count?: number;
      why_blocked?: string[];
      gate_chips?: Array<{
        id: string;
        state: string;
        evidence?: string;
        why_blocked?: string;
      }>;
      service_state?: {
        active?: string;
        enabled?: string;
      };
      kill_switch_state?: {
        active?: boolean;
        valid?: boolean;
        reason?: string;
        source?: string;
      };
      reviewed_git_head?: string;
      next_required_action?: string;
    };
  } | null;
  authoritySnapshot: {
    ok?: boolean;
    authority_snapshot?: {
      schema_version?: string;
      authority?: string;
      verifications?: Record<string, {
        status?: string;
        source?: string;
        path?: string;
        details?: Record<string, unknown>;
      }>;
    };
  } | null;
  work: RunnerWorkDigest | null;
  webhookQueue: {
    ok: boolean;
    state: 'not_configured' | 'unknown' | 'observed';
    lastValidDelivery: string | null;
    lastInvalidSignature: string | null;
    counts: {
      valid: number;
      invalidSignature: number;
      queued: number;
      handled: number;
      ignored: number;
    };
    queue: {
      depth: number;
      lagSeconds: number | null;
    };
    consumer: {
      state: 'not_configured' | 'unknown' | 'healthy' | 'blocked';
      detail: string;
    };
    recent: Array<{
      observedAt: string;
      issueKey?: string;
      eventClass: string;
      state: string;
      reason?: string;
    }>;
    notes: string[];
  };
  autonomy: {
    state: 'autonomous' | 'idle' | 'report_only' | 'blocked' | 'offline';
    label: string;
    tone: 'safe' | 'warning' | 'danger' | 'muted' | 'primary';
    reasons: string[];
    mode?: string;
    liveReady: boolean;
    dispatchEnabled: boolean;
    activeExecutions: number;
    openLinearIssues: number;
    readyLinearIssues: number;
    dorBlockedLinearIssues: number;
    backlogLinearIssues: number;
    todoLinearIssues: number;
  };
  autonomyView: {
    mode?: string;
    activationMode: 'full_autonomy_live' | 'full_autonomy_candidate' | 'class_scoped_autonomy' | 'report_only' | 'disabled' | 'unknown';
    approval: {
      state: 'valid' | 'missing' | 'blocked' | 'unknown';
      approvalId?: string;
      path?: string;
    };
    dispositions: {
      summary: Record<string, number>;
      lanes: {
        running: number;
        ready: number;
        needsInfo: number;
        approvalGated: number;
        reviewOnly: number;
        blocked: number;
        completed: number;
      };
    };
    operatorActions: Array<{
      id: string;
      label: string;
      state: 'clear' | 'attention' | 'blocked';
      reason: string;
    }>;
    workerRoutes: Array<{
      route: string;
      state: 'active' | 'idle' | 'attention';
      active: number;
      recent: number;
      health: string;
    }>;
    routeHealth: Record<string, {
      state: 'active' | 'idle' | 'attention';
      active: number;
      recent: number;
      health: string;
    }>;
    approvalQueue: {
      count: number;
      items: Array<{ id: string; title: string; reason: string }>;
    };
    rollbackReadiness: {
      state: 'ready' | 'attention' | 'unknown';
      reasons: string[];
    };
    writebackHealth: {
      state: 'converged' | 'attention' | 'unknown';
      held: number;
      reasons: string[];
    };
    budget: {
      timeBudgetSeconds?: number;
      tokenBudget?: number;
      costBudgetUsd?: number;
    };
    killSwitch: {
      active?: boolean;
      valid?: boolean;
      source?: string;
      reason?: string;
    };
    dashboardMutations: 0;
  };
  liveDbPath: string;
  safety: {
    dashboardMutations: 0;
    liveDispatchEnabled: false;
    serviceMutationEnabled: false;
    commands: string[];
  };
  commands: Record<string, RunnerProbeCommand | undefined>;
  error?: string;
}

interface RunnerStatusState {
  data: RunnerStatusReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRunnerStatus(): RunnerStatusState {
  const [data, setData] = useState<RunnerStatusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal, options: { force?: boolean; background?: boolean } = {}) => {
    if (inFlight.current && !options.force) return inFlight.current;
    if (!options.background) setLoading(true);

    let request: Promise<void>;
    request = (async () => {
      try {
        const response = await fetch(`/api/runner/status${options.force ? '?refresh=1' : ''}`, { signal });
        const payload = await response.json() as RunnerStatusReport;
        if (signal?.aborted) return;
        setData(payload);
        setError(response.ok ? null : payload.error || 'Runner status unavailable');
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : 'Runner status unavailable');
      } finally {
        if (!signal?.aborted && !options.background) {
          setLoading(false);
        }
      }
    })().finally(() => {
      if (inFlight.current === request) {
        inFlight.current = null;
      }
    });

    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal, { force: true });
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void refresh(undefined, { background: true });
      }
    }, 15000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh: () => refresh(undefined, { force: true }),
  };
}
