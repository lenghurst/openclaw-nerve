import { useCallback, useEffect, useState } from 'react';

export interface RunnerProbeCommand {
  ok: boolean;
  command: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
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

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/runner/status', { signal });
      const payload = await response.json() as RunnerStatusReport;
      if (signal?.aborted) return;
      setData(payload);
      setError(response.ok ? null : payload.error || 'Runner status unavailable');
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Runner status unavailable');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => {
      void refresh();
    }, 60000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh: () => refresh(),
  };
}
