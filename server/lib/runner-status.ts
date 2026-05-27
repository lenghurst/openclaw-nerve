import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type JsonRecord = Record<string, unknown>;
type JsonValue = JsonRecord | unknown[] | string | number | boolean | null;

interface CommandResult {
  ok: boolean;
  command: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  json?: JsonValue;
  error?: string;
}

interface RunnerWorkDigest {
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

interface RunnerWorkItem {
  id: string;
  title: string;
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

interface RunnerRunSummary {
  runId: string;
  taskId: string;
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

export interface RunnerStatusReport {
  ok: boolean;
  observedAt: string;
  repoPath: string | null;
  branch: string | null;
  head: string | null;
  status: JsonRecord | null;
  doctor: JsonRecord | null;
  scan: JsonRecord | null;
  liveReadiness: JsonRecord | null;
  authoritySnapshot: JsonRecord | null;
  work: RunnerWorkDigest | null;
  liveDbPath: string;
  safety: {
    dashboardMutations: 0;
    liveDispatchEnabled: false;
    serviceMutationEnabled: false;
    commands: string[];
  };
  commands: {
    gitBranch?: CommandResult;
    gitHead?: CommandResult;
    runnerStatus?: CommandResult;
    runnerDoctor?: CommandResult;
    runnerScan?: CommandResult;
    runnerLiveReadiness?: CommandResult;
    runnerAuthoritySnapshot?: CommandResult;
  };
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_MAX_BUFFER = 96 * 1024;
const DEFAULT_LIVE_DB_PATH = '/home/ubuntu/.local/state/openclaw-runner/runnerd.sqlite';
const DEFAULT_LINEAR_SECRETS_PATH = '/home/ubuntu/.config/runnerd/secrets.env';
const DEFAULT_LINEAR_PROJECT = 'runner';
const LINEAR_TIMEOUT_MS = 2500;

const DASHBOARD_SQL_SCRIPT = String.raw`
import json
import sqlite3
import sys
from datetime import datetime, timezone

db_path = sys.argv[1]

def iso(ms):
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return None

def parse_json(value):
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}

conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=1)
conn.row_factory = sqlite3.Row

runs = []
for row in conn.execute("""
    SELECT
      r.run_id, r.task_id, r.task_version, r.workflow_hash, r.attempt, r.status,
      r.worker_ref, r.created_at, r.updated_at,
      c.claim_id, c.status AS claim_status,
      wr.route AS worker_route, wr.status AS worker_status, wr.details_json AS worker_details_json,
      ts.status AS snapshot_status, ts.snapshot_json, ts.raw_snapshot_hash, ts.updated_at AS snapshot_observed_at,
      ev.outcome AS validation_outcome, ev.refusal_code AS validation_refusal_code, ev.created_at AS validation_at
    FROM runs r
    LEFT JOIN claims c ON c.run_id = r.run_id
    LEFT JOIN worker_refs wr ON wr.run_id = r.run_id
    LEFT JOIN task_snapshots ts ON ts.task_id = r.task_id
    LEFT JOIN (
      SELECT e1.*
      FROM evidence_validations e1
      JOIN (
        SELECT run_id, MAX(created_at) AS created_at
        FROM evidence_validations
        GROUP BY run_id
      ) latest ON latest.run_id = e1.run_id AND latest.created_at = e1.created_at
    ) ev ON ev.run_id = r.run_id
    ORDER BY r.created_at DESC
    LIMIT 50
"""):
    item = dict(row)
    item["created_at_iso"] = iso(item.get("created_at"))
    item["updated_at_iso"] = iso(item.get("updated_at"))
    item["validation_at_iso"] = iso(item.get("validation_at"))
    item["snapshot_observed_at_iso"] = iso(item.get("snapshot_observed_at"))
    item["snapshot"] = parse_json(item.pop("snapshot_json", None))
    item["worker_details"] = parse_json(item.pop("worker_details_json", None))
    runs.append(item)

snapshots = []
for row in conn.execute("""
    SELECT task_id, version, status, raw_snapshot_hash, snapshot_json, updated_at
    FROM task_snapshots
    ORDER BY updated_at DESC
    LIMIT 100
"""):
    item = dict(row)
    item["updated_at_iso"] = iso(item.get("updated_at"))
    item["snapshot"] = parse_json(item.pop("snapshot_json", None))
    snapshots.append(item)

events = []
for row in conn.execute("""
    SELECT seq, run_id, type, emitter, payload_json, created_at
    FROM events
    ORDER BY created_at DESC
    LIMIT 120
"""):
    item = dict(row)
    item["created_at_iso"] = iso(item.get("created_at"))
    item["payload"] = parse_json(item.pop("payload_json", None))
    events.append(item)

print(json.dumps({
    "ok": True,
    "db_path": db_path,
    "observed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "runs": runs,
    "snapshots": snapshots,
    "events": events,
}, separators=(",", ":")))
`;

const LINEAR_ISSUE_FRAGMENT = `
  identifier
  title
  url
  priority
  updatedAt
  startedAt
  completedAt
  state { name type }
  project { id name url state }
  parent { identifier title }
  assignee { name displayName email }
  cycle { id name number startsAt endsAt completedAt }
`;

const LINEAR_WORK_QUERY = `
query RunnerDashboardWork($project: String!, $first: Int!) {
  started: issues(
    filter: { project: { name: { eq: $project } }, state: { type: { eq: "started" } } }
    first: $first
    orderBy: updatedAt
  ) {
    nodes { ${LINEAR_ISSUE_FRAGMENT} }
  }
  unstarted: issues(
    filter: { project: { name: { eq: $project } }, state: { type: { eq: "unstarted" } } }
    first: 20
    orderBy: updatedAt
  ) {
    nodes { ${LINEAR_ISSUE_FRAGMENT} }
  }
}
`;

function scrubbedEnv(repoPath: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env.HOME || '',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    PYTHONPATH: repoPath,
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '',
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS || '',
  };
}

async function hasRunnerSurface(repoPath: string): Promise<boolean> {
  try {
    await access(resolve(repoPath, 'docs/runnerd/PRD.md'));
    await access(resolve(repoPath, 'runnerd/cli/main.py'));
    return true;
  } catch {
    return false;
  }
}

async function findRunnerRepo(): Promise<{ repoPath: string | null; error?: string }> {
  const configured = process.env.RUNNERD_REPO_PATH?.trim();
  const cwd = process.cwd();
  const candidates = [
    configured,
    cwd,
    dirname(cwd),
    resolve(cwd, '..'),
    '/home/ubuntu/runnerd-service-checkout-oc52-fixed',
    '/home/ubuntu/ai-vault',
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const repoPath = resolve(candidate);
    if (await hasRunnerSurface(repoPath)) {
      return { repoPath };
    }
  }

  if (configured) {
    return { repoPath: null, error: `RUNNERD_REPO_PATH does not contain runnerd docs and CLI: ${configured}` };
  }
  return { repoPath: null, error: 'runnerd repository not found' };
}

function execFileJson(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolveCommand) => {
    execFile(command, args, {
      cwd,
      env: scrubbedEnv(cwd),
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: DEFAULT_MAX_BUFFER,
    }, (error, stdout, stderr) => {
      const result: CommandResult = {
        ok: !error,
        command: [command, ...args],
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };

      if (error && 'code' in error && typeof error.code === 'number') {
        result.exitCode = error.code;
      }
      if (error) {
        result.error = error.message;
      }

      const trimmed = stdout.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          result.json = JSON.parse(trimmed) as JsonValue;
        } catch {
          result.json = null;
        }
      }

      resolveCommand(result);
    });
  });
}

function singleLine(result: CommandResult): string | null {
  if (!result.ok || !result.stdout) return null;
  return result.stdout.split('\n')[0]?.trim() || null;
}

function asRecord(value: JsonValue | undefined): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function runPythonJson(args: string[], cwd: string, timeout = DEFAULT_TIMEOUT_MS): Promise<CommandResult> {
  return new Promise((resolveCommand) => {
    execFile('python3', args, {
      cwd,
      env: scrubbedEnv(cwd),
      timeout,
      maxBuffer: 512 * 1024,
    }, (error, stdout, stderr) => {
      const result: CommandResult = {
        ok: !error,
        command: ['python3', ...args],
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
      if (error && 'code' in error && typeof error.code === 'number') {
        result.exitCode = error.code;
      }
      if (error) {
        result.error = error.message;
      }
      const trimmed = stdout.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          result.json = JSON.parse(trimmed) as JsonValue;
        } catch {
          result.json = null;
        }
      }
      resolveCommand(result);
    });
  });
}

async function readLinearApiKey(): Promise<string | null> {
  const direct = process.env.LINEAR_API_KEY?.trim();
  if (direct) return direct;

  const secretsPath = process.env.RUNNERD_LINEAR_SECRETS_PATH?.trim() || DEFAULT_LINEAR_SECRETS_PATH;
  try {
    const content = await readFile(secretsPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^LINEAR_API_KEY=(.*)$/);
      if (!match) continue;
      const value = match[1]?.trim().replace(/^['"]|['"]$/g, '');
      if (value) return value;
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchLinearIssues(project: string): Promise<{
  ok: boolean;
  issues: JsonRecord[];
  error?: string;
}> {
  const apiKey = await readLinearApiKey();
  if (!apiKey) {
    return { ok: false, issues: [], error: 'linear_api_key_unavailable' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINEAR_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: LINEAR_WORK_QUERY,
        variables: { project, first: 40 },
      }),
      signal: controller.signal,
    });
    const payload = await response.json() as JsonRecord;
    if (!response.ok || Array.isArray(payload.errors)) {
      return {
        ok: false,
        issues: [],
        error: `linear_query_failed:${response.status}`,
      };
    }

    const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data as JsonRecord
      : {};
    const started = data.started && typeof data.started === 'object' && !Array.isArray(data.started)
      ? asArray((data.started as JsonRecord).nodes)
      : [];
    const unstarted = data.unstarted && typeof data.unstarted === 'object' && !Array.isArray(data.unstarted)
      ? asArray((data.unstarted as JsonRecord).nodes)
      : [];
    return { ok: true, issues: [...started, ...unstarted] };
  } catch (err) {
    return {
      ok: false,
      issues: [],
      error: err instanceof Error ? `linear_query_failed:${err.name}` : 'linear_query_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeLinearIssue(issue: JsonRecord): Partial<RunnerWorkItem> & { id?: string } {
  const state = issue.state && typeof issue.state === 'object' && !Array.isArray(issue.state)
    ? issue.state as JsonRecord
    : {};
  const project = issue.project && typeof issue.project === 'object' && !Array.isArray(issue.project)
    ? issue.project as JsonRecord
    : {};
  const parent = issue.parent && typeof issue.parent === 'object' && !Array.isArray(issue.parent)
    ? issue.parent as JsonRecord
    : {};
  const assignee = issue.assignee && typeof issue.assignee === 'object' && !Array.isArray(issue.assignee)
    ? issue.assignee as JsonRecord
    : {};
  const cycle = issue.cycle && typeof issue.cycle === 'object' && !Array.isArray(issue.cycle)
    ? issue.cycle as JsonRecord
    : null;
  const id = asString(issue.identifier);

  return {
    id,
    title: asString(issue.title) || id || 'Untitled Linear issue',
    url: asString(issue.url),
    project: {
      id: asString(project.id),
      name: asString(project.name),
      url: asString(project.url),
      state: asString(project.state),
    },
    parent: asString(parent.identifier) ? {
      id: asString(parent.identifier) || '',
      title: asString(parent.title),
    } : undefined,
    assignee: asString(assignee.displayName) || asString(assignee.name) || asString(assignee.email),
    priority: asNumber(issue.priority),
    state: {
      name: asString(state.name) || 'Unknown',
      type: asString(state.type),
    },
    cycle: cycle ? {
      id: asString(cycle.id),
      name: asString(cycle.name),
      number: asNumber(cycle.number),
      startsAt: asString(cycle.startsAt),
      endsAt: asString(cycle.endsAt),
      completedAt: asString(cycle.completedAt) || null,
    } : undefined,
    updatedAt: asString(issue.updatedAt),
    startedAt: asString(issue.startedAt) || null,
    completedAt: asString(issue.completedAt) || null,
  };
}

function snapshotState(snapshot: JsonRecord): { name: string; type?: string } {
  const state = snapshot.state;
  if (typeof state === 'string' && state.trim()) return { name: state };
  if (state && typeof state === 'object' && !Array.isArray(state)) {
    const record = state as JsonRecord;
    return { name: asString(record.name) || 'Unknown', type: asString(record.type) };
  }
  return { name: asString(snapshot.status) || 'Unknown', type: asString(snapshot.status_type) };
}

function projectFromSnapshot(snapshot: JsonRecord): RunnerWorkItem['project'] {
  const project = snapshot.project && typeof snapshot.project === 'object' && !Array.isArray(snapshot.project)
    ? snapshot.project as JsonRecord
    : {};
  return {
    id: asString(project.id) || asString(snapshot.projectId) || asString(snapshot.project_id),
    name: asString(project.name) || asString(snapshot.project) || asString(snapshot.project_name),
    url: asString(project.url),
    state: asString(project.state),
  };
}

function latestEventByRun(events: JsonRecord[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const event of events) {
    const runId = asString(event.run_id);
    if (!runId || map.has(runId)) continue;
    map.set(runId, event);
  }
  return map;
}

function statusRank(item: RunnerWorkItem): number {
  const runnerStatus = item.runner.status;
  const stateType = item.state.type;
  if (runnerStatus === 'launched' || runnerStatus === 'claimed' || runnerStatus === 'validating') return 0;
  if (runnerStatus === 'review') return 1;
  if (stateType === 'started') return 2;
  if (stateType === 'unstarted') return 3;
  return 4;
}

function buildFlow(events: JsonRecord[]): RunnerWorkDigest['flow'] {
  const byDate = new Map<string, RunnerWorkDigest['flow'][number]>();
  for (const event of events) {
    const iso = asString(event.created_at_iso);
    if (!iso) continue;
    const date = iso.slice(0, 10);
    const current = byDate.get(date) || {
      date,
      claimed: 0,
      launched: 0,
      review: 0,
      validated: 0,
      blocked: 0,
      total: 0,
    };
    const type = asString(event.type) || '';
    if (type === 'claim.acquired') current.claimed += 1;
    else if (type === 'worker.launched') current.launched += 1;
    else if (type === 'run.resolved') {
      const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
        ? event.payload as JsonRecord
        : {};
      if (asString(payload.status) === 'review') current.review += 1;
      else current.blocked += 1;
    } else if (type.includes('validation')) {
      current.validated += 1;
    }
    current.total += 1;
    byDate.set(date, current);
  }

  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
}

function projectKey(item: RunnerWorkItem): string {
  return item.project?.id || item.project?.name || 'unprojected';
}

function buildProjectSummary(items: RunnerWorkItem[]): RunnerWorkDigest['projects'] {
  const projects = new Map<string, RunnerWorkDigest['projects'][number]>();
  for (const item of items) {
    const key = projectKey(item);
    const current = projects.get(key) || {
      id: item.project?.id || key,
      name: item.project?.name || 'No project captured',
      url: item.project?.url,
      state: item.project?.state,
      active: 0,
      review: 0,
      total: 0,
      completed: 0,
    };
    current.total += 1;
    if (item.runner.status === 'review' || item.state.name.toLowerCase().includes('review')) current.review += 1;
    if (item.runner.status === 'launched' || item.runner.status === 'claimed' || item.state.type === 'started') current.active += 1;
    if (item.state.type === 'completed' || item.completedAt) current.completed += 1;
    projects.set(key, current);
  }
  return [...projects.values()].sort((a, b) => b.active - a.active || b.total - a.total || a.name.localeCompare(b.name));
}

function buildRecentRunSummaries(runs: JsonRecord[], events: JsonRecord[]): RunnerRunSummary[] {
  const eventByRun = latestEventByRun(events);
  return runs.slice(0, 12).map((run) => {
    const createdMs = asNumber(run.created_at) || 0;
    const updatedMs = asNumber(run.updated_at) || createdMs;
    const runId = asString(run.run_id) || '';
    const event = eventByRun.get(runId);
    return {
      runId,
      taskId: asString(run.task_id) || '',
      status: asString(run.status) || 'unknown',
      claimStatus: asString(run.claim_status),
      workerRoute: asString(run.worker_route),
      workerStatus: asString(run.worker_status),
      validation: asString(run.validation_outcome),
      refusalCode: asString(run.validation_refusal_code) || null,
      createdAt: asString(run.created_at_iso) || '',
      updatedAt: asString(run.updated_at_iso) || '',
      durationMs: Math.max(0, updatedMs - createdMs),
      eventType: asString(event?.type),
    };
  });
}

async function collectRunnerWorkDigest(repoPath: string, liveDbPath: string): Promise<RunnerWorkDigest> {
  const observedAt = new Date().toISOString();
  const dbResult = await runPythonJson(['-c', DASHBOARD_SQL_SCRIPT, liveDbPath], repoPath, DEFAULT_TIMEOUT_MS);
  const dbPayload = asRecord(dbResult.json);
  const runs = asArray(dbPayload?.runs);
  const snapshots = asArray(dbPayload?.snapshots);
  const events = asArray(dbPayload?.events);
  const linearProject = process.env.RUNNERD_LINEAR_PROJECT?.trim() || DEFAULT_LINEAR_PROJECT;
  const linearResult = await fetchLinearIssues(linearProject);
  const linearItems = new Map<string, RunnerWorkItem>();

  for (const issue of linearResult.issues) {
    const normalized = normalizeLinearIssue(issue);
    if (!normalized.id) continue;
    linearItems.set(normalized.id, {
      id: normalized.id,
      title: normalized.title || normalized.id,
      url: normalized.url,
      project: normalized.project,
      parent: normalized.parent,
      assignee: normalized.assignee,
      priority: normalized.priority,
      state: normalized.state || { name: 'Unknown' },
      cycle: normalized.cycle,
      updatedAt: normalized.updatedAt,
      startedAt: normalized.startedAt,
      completedAt: normalized.completedAt,
      runner: {
        status: 'not claimed',
        source: 'linear',
      },
    });
  }

  const eventByRun = latestEventByRun(events);
  for (const run of runs) {
    const taskId = asString(run.task_id);
    if (!taskId) continue;
    const snapshot = run.snapshot && typeof run.snapshot === 'object' && !Array.isArray(run.snapshot)
      ? run.snapshot as JsonRecord
      : {};
    const existing = linearItems.get(taskId);
    if (existing?.runner.source === 'runner_db') continue;
    const event = eventByRun.get(asString(run.run_id) || '');
    const fallbackTitle = existing?.title || asString(snapshot.title) || taskId;
    const fallbackProject = existing?.project || projectFromSnapshot(snapshot);
    linearItems.set(taskId, {
      id: taskId,
      title: fallbackTitle,
      url: existing?.url || asString(snapshot.url),
      project: fallbackProject,
      parent: existing?.parent,
      assignee: existing?.assignee || asString(snapshot.assignee),
      priority: existing?.priority || asNumber(snapshot.priority),
      state: existing?.state || snapshotState(snapshot),
      cycle: existing?.cycle,
      updatedAt: existing?.updatedAt || asString(snapshot.updatedAt) || asString(snapshot.updated_at),
      startedAt: existing?.startedAt,
      completedAt: existing?.completedAt,
      runner: {
        status: asString(run.status) || 'unknown',
        claimStatus: asString(run.claim_status),
        runId: asString(run.run_id),
        workerRoute: asString(run.worker_route),
        workerStatus: asString(run.worker_status),
        validation: asString(run.validation_outcome),
        workflowHash: asString(run.workflow_hash),
        lastRunAt: asString(run.updated_at_iso) || asString(run.created_at_iso),
        lastEventAt: asString(event?.created_at_iso),
        lastEventType: asString(event?.type),
        source: 'runner_db',
      },
    });
  }

  for (const snapshotRow of snapshots) {
    const taskId = asString(snapshotRow.task_id);
    if (!taskId || linearItems.has(taskId)) continue;
    const snapshot = snapshotRow.snapshot && typeof snapshotRow.snapshot === 'object' && !Array.isArray(snapshotRow.snapshot)
      ? snapshotRow.snapshot as JsonRecord
      : {};
    linearItems.set(taskId, {
      id: taskId,
      title: asString(snapshot.title) || taskId,
      url: asString(snapshot.url),
      project: projectFromSnapshot(snapshot),
      state: snapshotState(snapshot),
      priority: asNumber(snapshot.priority),
      updatedAt: asString(snapshot.updatedAt) || asString(snapshot.updated_at),
      runner: {
        status: 'observed',
        source: 'runner_db',
      },
    });
  }

  const items = [...linearItems.values()].sort((a, b) => statusRank(a) - statusRank(b) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const projects = buildProjectSummary(items);
  const recentRuns = buildRecentRunSummaries(runs, events);
  const activeExecutions = runs.filter((run) => ['claimed', 'launched', 'validating'].includes(asString(run.status) || '')).length;
  const reviewRuns = runs.filter((run) => asString(run.status) === 'review').length;
  const activeLinearIssues = items.filter((item) => item.state.type === 'started').length;
  const lastEventAt = asString(events[0]?.created_at_iso) || null;

  return {
    ok: Boolean(dbResult.ok && dbPayload),
    observedAt,
    source: {
      runnerDb: Boolean(dbResult.ok && dbPayload),
      linear: {
        ok: linearResult.ok,
        project: linearProject,
        error: linearResult.error,
      },
    },
    summary: {
      activeExecutions,
      reviewRuns,
      observedTasks: items.length,
      activeLinearIssues,
      projects: projects.length,
      lastEventAt,
    },
    projects,
    items,
    recentRuns,
    flow: buildFlow(events),
  };
}

export async function collectRunnerStatus(): Promise<RunnerStatusReport> {
  const repo = await findRunnerRepo();
  const observedAt = new Date().toISOString();
  const liveDbPath = process.env.RUNNERD_DB_PATH?.trim() || DEFAULT_LIVE_DB_PATH;
  const liveEvidencePath = process.env.RUNNERD_LIVE_EVIDENCE_PATH?.trim();
  const liveReadinessArgs = liveEvidencePath
    ? ['-m', 'runnerd.cli', 'live-readiness', '--live-evidence', liveEvidencePath, '--json']
    : ['-m', 'runnerd.cli', 'live-readiness', '--json'];

  if (!repo.repoPath) {
    return {
      ok: false,
      observedAt,
      repoPath: null,
      branch: null,
      head: null,
      status: null,
      doctor: null,
      scan: null,
      liveReadiness: null,
      authoritySnapshot: null,
      work: null,
      liveDbPath,
      safety: {
        dashboardMutations: 0,
        liveDispatchEnabled: false,
        serviceMutationEnabled: false,
        commands: [],
      },
      commands: {},
      error: repo.error,
    };
  }

  const [gitBranch, gitHead, runnerStatus, runnerDoctor, runnerScan, runnerLiveReadiness, runnerAuthoritySnapshot, runnerWork] = await Promise.all([
    execFileJson('git', ['branch', '--show-current'], repo.repoPath),
    execFileJson('git', ['rev-parse', 'HEAD'], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'status', '--json', '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'doctor', '--strict', '--json', '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'scan', '--dry-run', '--json', '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', liveReadinessArgs, repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'live', 'authority', 'snapshot', '--json'], repo.repoPath),
    collectRunnerWorkDigest(repo.repoPath, liveDbPath).catch((err: unknown): RunnerWorkDigest => ({
      ok: false,
      observedAt,
      source: {
        runnerDb: false,
        linear: {
          ok: false,
          project: process.env.RUNNERD_LINEAR_PROJECT?.trim() || DEFAULT_LINEAR_PROJECT,
          error: err instanceof Error ? err.message : 'work_digest_failed',
        },
      },
      summary: {
        activeExecutions: 0,
        reviewRuns: 0,
        observedTasks: 0,
        activeLinearIssues: 0,
        projects: 0,
        lastEventAt: null,
      },
      projects: [],
      items: [],
      recentRuns: [],
      flow: [],
    })),
  ]);

  const ok = Boolean(
    runnerStatus.ok && runnerStatus.json
    && runnerDoctor.ok && runnerDoctor.json
    && runnerScan.ok && runnerScan.json
    && runnerLiveReadiness.ok && runnerLiveReadiness.json
    && runnerAuthoritySnapshot.ok && runnerAuthoritySnapshot.json,
  );

  return {
    ok,
    observedAt,
    repoPath: repo.repoPath,
    branch: singleLine(gitBranch),
    head: singleLine(gitHead),
    status: asRecord(runnerStatus.json),
    doctor: asRecord(runnerDoctor.json),
    scan: asRecord(runnerScan.json),
    liveReadiness: asRecord(runnerLiveReadiness.json),
    authoritySnapshot: asRecord(runnerAuthoritySnapshot.json),
    work: runnerWork,
    liveDbPath,
    safety: {
      dashboardMutations: 0,
      liveDispatchEnabled: false,
      serviceMutationEnabled: false,
      commands: [
        'git branch --show-current',
        'git rev-parse HEAD',
        `python3 -m runnerd.cli status --json --db ${liveDbPath}`,
        `python3 -m runnerd.cli doctor --strict --json --db ${liveDbPath}`,
        `python3 -m runnerd.cli scan --dry-run --json --db ${liveDbPath}`,
        liveEvidencePath
          ? `python3 -m runnerd.cli live-readiness --live-evidence ${liveEvidencePath} --json`
          : 'python3 -m runnerd.cli live-readiness --json',
        'python3 -m runnerd.cli live authority snapshot --json',
      ],
    },
    commands: {
      gitBranch,
      gitHead,
      runnerStatus,
      runnerDoctor,
      runnerScan,
      runnerLiveReadiness,
      runnerAuthoritySnapshot,
    },
    error: ok ? undefined : 'runnerd local status probe failed',
  };
}
