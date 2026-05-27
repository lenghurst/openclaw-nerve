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
    source: 'runner_db' | 'linear';
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
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  eventType?: string;
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
  recentRuns: RunnerRunSummary[];
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
    void refresh(controller.signal);
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
