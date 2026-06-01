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
  cycles: RunnerCycleSummary[];
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

interface RunnerCycleSummary {
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
}

interface RunnerEvidenceFile {
  path: string;
  sha256?: string;
}

interface RunnerWorkerCommand {
  cwd?: string;
  exitCode?: number | null;
  stdoutRef?: string;
  stderrRef?: string;
  argvRedacted?: string[];
}

interface RunnerWorkerArtifact {
  route?: string;
  packetId?: string;
  autonomy?: boolean;
  evidenceDir?: string;
  worktreePath?: string;
  workspaceId?: string;
  finalHead?: string;
  manifestPresent: boolean;
  files: RunnerEvidenceFile[];
  command?: RunnerWorkerCommand;
  transcriptRef?: string;
  stderrRef?: string;
  diffRef?: string;
  hasDiff: boolean;
  noDiff: boolean;
  operatorSummary?: RunnerOperatorSummaryDigest;
}

interface RunnerOperatorSummaryDigest {
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
}

interface RunnerWorkItem {
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
  readiness?: RunnerIssueReadiness;
  updatedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface RunnerIssueReadiness {
  verdict: 'ready' | 'missing' | 'non_executable';
  executable: boolean;
  hitlClass?: string;
  missing: string[];
  refusalCodes: string[];
  plannedRunDir?: string;
}

interface RunnerRunSummary {
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
  webhookQueue: RunnerWebhookQueueHealth;
  autonomyView: RunnerAutonomyView;
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

interface RunnerAutonomyView {
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
}

interface RunnerWebhookQueueHealth {
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
}

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_MAX_BUFFER = 96 * 1024;
const DEFAULT_LIVE_DB_PATH = '/home/ubuntu/.local/state/openclaw-runner/runnerd.sqlite';
const DEFAULT_RUNNERD_CONFIG_PATH = '/home/ubuntu/.config/runnerd/config.toml';
const DEFAULT_RUNNERD_EVIDENCE_ROOT = '/home/ubuntu/.local/state/openclaw-runner/evidence';
const DEFAULT_RUNNERD_WORKTREE_ROOT = '/home/ubuntu/.local/state/openclaw-runner/worktrees';
const DEFAULT_LINEAR_SECRETS_PATH = '/home/ubuntu/.config/runnerd/secrets.env';
const DEFAULT_LINEAR_PROJECT = 'runner';
const LINEAR_TIMEOUT_MS = 2500;
const DEFAULT_STATUS_CACHE_MS = 10_000;

let cachedStatus: { report: RunnerStatusReport; cachedAt: number } | null = null;
let pendingStatus: Promise<RunnerStatusReport> | null = null;

const DASHBOARD_SQL_SCRIPT = String.raw`
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

db_path = sys.argv[1]
evidence_root = Path(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else None

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

def read_json_file(path):
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}

def run_evidence(run_id):
    if not evidence_root or not run_id:
        return {}
    evidence_dir = evidence_root / run_id
    manifest = read_json_file(evidence_dir / "manifest.json")
    commands = read_json_file(evidence_dir / "commands.json")
    operator_summary = read_json_file(evidence_dir / "operator-summary.json")
    return {
        "evidence_dir": str(evidence_dir),
        "manifest_present": bool(manifest),
        "commands_present": bool(commands),
        "operator_summary_present": bool(operator_summary),
        "manifest": manifest,
        "commands": commands,
        "operator_summary": operator_summary,
    }

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
    item["evidence_info"] = run_evidence(item.get("run_id"))
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
  description
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
  projectIssues: issues(
    filter: { project: { name: { eq: $project } } }
    first: $first
    orderBy: updatedAt
  ) {
    nodes { ${LINEAR_ISSUE_FRAGMENT} }
  }
}
`;

function statusCacheMs(): number {
  const raw = process.env.RUNNERD_DASHBOARD_CACHE_MS?.trim();
  if (!raw) return DEFAULT_STATUS_CACHE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_STATUS_CACHE_MS;
}

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
    await access(resolve(repoPath, 'runnerd/live_readiness.py'));
    await access(resolve(repoPath, 'runnerd/authority_verifier.py'));
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

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function asNestedRecord(value: unknown, key: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const nested = (value as JsonRecord)[key];
  return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as JsonRecord : {};
}

function descriptionPreview(value: unknown): string | undefined {
  const text = asString(value);
  if (!text) return undefined;
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+]\(([^)]+)\)/g, ' ')
    .replace(/[#>*_[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  return cleaned.length > 280 ? `${cleaned.slice(0, 277)}...` : cleaned;
}

const REQUIRED_DOR_MARKERS: Array<[string, string[]]> = [
  ['objective_hypothesis', ['objective / hypothesis', 'objective', 'hypothesis']],
  ['target_coordinates', ['target coordinates']],
  ['execution_constraints', ['execution constraints', 'non-scope']],
  ['deterministic_success_criteria', ['deterministic success criteria']],
  ['evidence_plan', ['evidence plan', 'planned run directory']],
];
const VALID_HITL_CLASSES = ['No-HITL', 'HITL-input', 'HITL-approval'];
const PLANNED_RUN_ROOT = '/home/ubuntu/ai-vault/runs/';

function issueReadiness(issue: JsonRecord, stateName?: string): RunnerIssueReadiness {
  const state = (stateName || '').trim().toLowerCase();
  if (['done', 'completed', 'canceled', 'cancelled'].includes(state)) {
    return { verdict: 'non_executable', executable: false, missing: [], refusalCodes: [] };
  }

  const text = asString(issue.description) || '';
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  const missing = REQUIRED_DOR_MARKERS
    .filter(([, markers]) => !markers.some((marker) => normalized.includes(marker)))
    .map(([key]) => key);
  const hitlMatch = text.match(/hitl class:\s*(No-HITL|HITL-input|HITL-approval)\b/i);
  const hitlClass = hitlMatch
    ? VALID_HITL_CLASSES.find((item) => item.toLowerCase() === hitlMatch[1].toLowerCase())
    : undefined;
  const refusalCodes: string[] = [];
  if (!hitlClass) refusalCodes.push('invalid_hitl_class');
  const duplicateHitl = text.match(/hitl class:/gi);
  if (duplicateHitl && duplicateHitl.length > 1) refusalCodes.push('duplicate_hitl_class');

  const plannedRunDir = plannedRunDirectory(text);
  if (!plannedRunDir && !missing.includes('evidence_plan')) missing.push('evidence_plan');

  return {
    verdict: missing.length > 0 || refusalCodes.length > 0 ? 'missing' : 'ready',
    executable: true,
    hitlClass,
    missing: [...new Set(missing)],
    refusalCodes,
    plannedRunDir,
  };
}

function plannedRunDirectory(text: string): string | undefined {
  const match = text.match(/planned run directory:\s*([^\s]+)/i);
  if (!match) return undefined;
  const value = match[1].trim().replace(/^[`'"]|[`'",.;)]$/g, '');
  if (!value.startsWith(PLANNED_RUN_ROOT) || value.includes('/../')) return undefined;
  return value;
}

function isReadyForRunner(item: RunnerWorkItem): boolean {
  return (
    item.readiness?.verdict === 'ready'
    && item.readiness.hitlClass === 'No-HITL'
    && !isCompletedItem(item)
  );
}

function isRunnerSourceQueueItem(item: RunnerWorkItem): boolean {
  return !isCompletedItem(item) && (isBacklogItem(item) || isTodoItem(item));
}

function isReadyForRunnerClaim(item: RunnerWorkItem): boolean {
  return isReadyForRunner(item) && isRunnerSourceQueueItem(item);
}

function defaultWebhookQueueHealth(): RunnerWebhookQueueHealth {
  return {
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
    queue: {
      depth: 0,
      lagSeconds: null,
    },
    consumer: {
      state: 'not_configured',
      detail: 'Linear webhook events are not configured as Runner authority in this deployment.',
    },
    recent: [],
    notes: [
      'Webhook events are request signals only.',
      'Dashboard status is read-only and cannot replay, forge, or dispatch events.',
    ],
  };
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
        variables: { project, first: 80 },
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
    const projectIssues = data.projectIssues && typeof data.projectIssues === 'object' && !Array.isArray(data.projectIssues)
      ? asArray((data.projectIssues as JsonRecord).nodes)
      : [];
    return { ok: true, issues: projectIssues };
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
    descriptionPreview: descriptionPreview(issue.description),
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
    readiness: issueReadiness(issue, asString(state.name)),
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

function buildOperatorSummaryDigest(summary: JsonRecord): RunnerOperatorSummaryDigest | undefined {
  if (!Object.keys(summary).length) return undefined;
  const changes = asNestedRecord(summary, 'changes');
  const validation = asNestedRecord(summary, 'validation');
  const authority = asNestedRecord(summary, 'writeback_authority');
  const model = asNestedRecord(summary, 'model_session');
  const commands = asNestedRecord(summary, 'commands');
  const codexEvents = asNestedRecord(commands, 'codex_event_summary');
  const changedFiles = Array.isArray(changes.changed_files)
    ? changes.changed_files.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const refusalCodes = Array.isArray(validation.refusal_codes)
    ? validation.refusal_codes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const evidenceRefs = Array.isArray(summary.evidence_refs)
    ? summary.evidence_refs.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const workerFinalMessage = asString(summary.worker_final_message);
  return {
    outcome: asString(summary.outcome),
    nextAction: asString(summary.next_action),
    diffState: asString(changes.state),
    changedFiles,
    validation: asString(validation.outcome),
    refusalCodes,
    workerDirectWriteback: asString(authority.worker_direct_writeback),
    evidenceRefs,
    threadId: asString(model.thread_id),
    commandEventCount: asNumber(codexEvents.command_event_count),
    workerFinalMessage: workerFinalMessage ? workerFinalMessage.slice(0, 700) : undefined,
  };
}

function buildWorkerArtifact(run: JsonRecord, evidenceRoot: string, worktreeRoot: string): RunnerWorkerArtifact | undefined {
  const runId = asString(run.run_id);
  if (!runId) return undefined;

  const workerDetails = run.worker_details && typeof run.worker_details === 'object' && !Array.isArray(run.worker_details)
    ? run.worker_details as JsonRecord
    : {};
  const evidenceInfo = run.evidence_info && typeof run.evidence_info === 'object' && !Array.isArray(run.evidence_info)
    ? run.evidence_info as JsonRecord
    : {};
  const manifest = asNestedRecord(evidenceInfo, 'manifest');
  const commands = asNestedRecord(evidenceInfo, 'commands');
  const operatorSummary = asNestedRecord(evidenceInfo, 'operator_summary');
  const commandRecord = asArray(commands.commands)[0];
  const files = asArray(manifest.files)
    .map((file): RunnerEvidenceFile | null => {
      const path = asString(file.path);
      if (!path) return null;
      return { path, sha256: asString(file.sha256) };
    })
    .filter((file): file is RunnerEvidenceFile => Boolean(file));
  const filePaths = new Set(files.map((file) => file.path));
  const diffRef = filePaths.has('diff.patch')
    ? 'diff.patch'
    : [...filePaths].find((path) => path.endsWith('.patch') || path.includes('diff'));
  const noDiff = filePaths.has('no-diff.json');
  const stdoutRef = asString(commandRecord?.stdout_ref);
  const stderrRef = asString(commandRecord?.stderr_ref);
  const evidenceDir = asString(manifest.evidence_dir)
    || asString(evidenceInfo.evidence_dir)
    || `${evidenceRoot}/${runId}`;
  const worktreePath = asString(manifest.workspace_path)
    || asString(commandRecord?.cwd)
    || `${worktreeRoot}/${runId}`;
  const route = asString(run.worker_route);
  const manifestPresent = evidenceInfo.manifest_present === true || Object.keys(manifest).length > 0;
  const commandsPresent = evidenceInfo.commands_present === true || Object.keys(commands).length > 0;

  if (!route && !manifestPresent && !commandsPresent) return undefined;

  return {
    route,
    packetId: asString(workerDetails.packet_id),
    autonomy: asBoolean(workerDetails.autonomy),
    evidenceDir,
    worktreePath,
    workspaceId: asString(manifest.workspace_id),
    finalHead: asString(manifest.final_head),
    manifestPresent,
    files,
    command: commandRecord ? {
      cwd: asString(commandRecord.cwd),
      exitCode: typeof commandRecord.exit_code === 'number' ? commandRecord.exit_code : commandRecord.exit_code === null ? null : undefined,
      stdoutRef,
      stderrRef,
      argvRedacted: asStringList(commandRecord.argv_redacted),
    } : undefined,
    transcriptRef: stdoutRef || (filePaths.has('codex-events.jsonl') ? 'codex-events.jsonl' : undefined),
    stderrRef: stderrRef || (filePaths.has('codex-stderr.txt') ? 'codex-stderr.txt' : undefined),
    diffRef,
    hasDiff: Boolean(diffRef && diffRef !== 'no-diff.json'),
    noDiff,
    operatorSummary: buildOperatorSummaryDigest(operatorSummary),
  };
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

function isCompletedItem(item?: RunnerWorkItem): boolean {
  if (!item) return false;
  const stateName = item.state.name.toLowerCase();
  return Boolean(
    item.completedAt
    || item.state.type === 'completed'
    || stateName === 'done'
    || stateName === 'completed'
    || stateName === 'canceled'
    || stateName === 'cancelled',
  );
}

function isRunnerExecuting(status?: string): boolean {
  return ['claimed', 'launched', 'validating'].includes((status || '').toLowerCase());
}

function isPresentWorkItem(item: RunnerWorkItem): boolean {
  if (isCompletedItem(item)) return false;
  return isRunnerExecuting(item.runner.status) || item.state.type === 'started';
}

function isBacklogItem(item: RunnerWorkItem): boolean {
  return item.state.type === 'backlog' || item.state.name.toLowerCase() === 'backlog';
}

function isTodoItem(item: RunnerWorkItem): boolean {
  const stateName = item.state.name.toLowerCase();
  return item.state.type === 'unstarted' || stateName === 'todo' || stateName === 'to do';
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
    const completed = isCompletedItem(item);
    if (!completed && (item.runner.status === 'review' || item.state.name.toLowerCase().includes('review'))) current.review += 1;
    if (isPresentWorkItem(item)) current.active += 1;
    if (completed) current.completed += 1;
    projects.set(key, current);
  }
  return [...projects.values()].sort((a, b) => b.active - a.active || b.total - a.total || a.name.localeCompare(b.name));
}

function cyclePosition(item: RunnerWorkItem, observedAt: string): RunnerCycleSummary['position'] {
  if (!item.cycle?.id && !item.cycle?.name) return 'uncycled';
  if (item.cycle.completedAt) return 'past';

  const observedMs = Date.parse(observedAt);
  const startsMs = item.cycle.startsAt ? Date.parse(item.cycle.startsAt) : Number.NaN;
  const endsMs = item.cycle.endsAt ? Date.parse(item.cycle.endsAt) : Number.NaN;
  if (Number.isFinite(startsMs) && startsMs > observedMs) return 'upcoming';
  if (Number.isFinite(endsMs) && endsMs < observedMs) return 'past';
  return 'current';
}

function cycleRank(position: RunnerCycleSummary['position']): number {
  if (position === 'current') return 0;
  if (position === 'upcoming') return 1;
  if (position === 'uncycled') return 2;
  return 3;
}

function buildCycleSummary(items: RunnerWorkItem[], observedAt: string): RunnerCycleSummary[] {
  const cycles = new Map<string, RunnerCycleSummary>();
  for (const item of items) {
    const key = item.cycle?.id || item.cycle?.name || 'uncycled';
    const current = cycles.get(key) || {
      id: item.cycle?.id || key,
      name: item.cycle?.name || 'No cycle',
      position: cyclePosition(item, observedAt),
      startsAt: item.cycle?.startsAt,
      endsAt: item.cycle?.endsAt,
      completedAt: item.cycle?.completedAt,
      active: 0,
      review: 0,
      backlog: 0,
      todo: 0,
      completed: 0,
      total: 0,
      items: [],
    };
    current.total += 1;
    if (isCompletedItem(item)) current.completed += 1;
    else if (isPresentWorkItem(item)) current.active += 1;
    else if (item.runner.status === 'review' || item.state.name.toLowerCase().includes('review')) current.review += 1;
    else if (isBacklogItem(item)) current.backlog += 1;
    else if (isTodoItem(item)) current.todo += 1;

    if (current.items.length < 6 && !isCompletedItem(item)) {
      current.items.push({
        id: item.id,
        title: item.title,
        url: item.url,
        state: item.state.name,
        stateType: item.state.type,
        runnerStatus: item.runner.status,
      });
    }
    cycles.set(key, current);
  }

  return [...cycles.values()]
    .sort((a, b) => (
      cycleRank(a.position) - cycleRank(b.position)
      || (a.startsAt || '').localeCompare(b.startsAt || '')
      || b.total - a.total
      || a.name.localeCompare(b.name)
    ))
    .slice(0, 12);
}

function buildRecentRunSummaries(
  runs: JsonRecord[],
  events: JsonRecord[],
  issuesById: Map<string, RunnerWorkItem>,
  evidenceRoot: string,
  worktreeRoot: string,
): RunnerRunSummary[] {
  const eventByRun = latestEventByRun(events);
  return runs.slice(0, 12).map((run) => {
    const createdMs = asNumber(run.created_at) || 0;
    const updatedMs = asNumber(run.updated_at) || createdMs;
    const runId = asString(run.run_id) || '';
    const taskId = asString(run.task_id) || '';
    const event = eventByRun.get(runId);
    const issue = issuesById.get(taskId);
    const rawStatus = asString(run.status) || 'unknown';
    return {
      runId,
      taskId,
      title: issue?.title,
      url: issue?.url,
      status: rawStatus === 'review' && isCompletedItem(issue) ? 'done' : rawStatus,
      claimStatus: asString(run.claim_status),
      workerRoute: asString(run.worker_route),
      workerStatus: asString(run.worker_status),
      validation: asString(run.validation_outcome),
      refusalCode: asString(run.validation_refusal_code) || null,
      artifact: buildWorkerArtifact(run, evidenceRoot, worktreeRoot),
      createdAt: asString(run.created_at_iso) || '',
      updatedAt: asString(run.updated_at_iso) || '',
      durationMs: Math.max(0, updatedMs - createdMs),
      eventType: asString(event?.type),
    };
  });
}

async function collectRunnerWorkDigest(
  repoPath: string,
  liveDbPath: string,
  evidenceRoot: string,
  worktreeRoot: string,
): Promise<RunnerWorkDigest> {
  const observedAt = new Date().toISOString();
  const dbResult = await runPythonJson(['-c', DASHBOARD_SQL_SCRIPT, liveDbPath, evidenceRoot], repoPath, DEFAULT_TIMEOUT_MS);
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
      descriptionPreview: normalized.descriptionPreview,
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
      readiness: normalized.readiness,
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
    const artifact = buildWorkerArtifact(run, evidenceRoot, worktreeRoot);
    const fallbackTitle = existing?.title || asString(snapshot.title) || taskId;
    const fallbackProject = existing?.project || projectFromSnapshot(snapshot);
    linearItems.set(taskId, {
      id: taskId,
      title: fallbackTitle,
      descriptionPreview: existing?.descriptionPreview || descriptionPreview(snapshot.description),
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
        artifact,
        source: 'runner_db',
      },
      readiness: existing?.readiness || issueReadiness(snapshot, existing?.state.name || asString(snapshot.status)),
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
      descriptionPreview: descriptionPreview(snapshot.description),
      url: asString(snapshot.url),
      project: projectFromSnapshot(snapshot),
      state: snapshotState(snapshot),
      priority: asNumber(snapshot.priority),
      updatedAt: asString(snapshot.updatedAt) || asString(snapshot.updated_at),
      runner: {
        status: 'observed',
        source: 'runner_db',
      },
      readiness: issueReadiness(snapshot, asString(snapshotRow.status)),
    });
  }

  const allItems = [...linearItems.values()].sort((a, b) => statusRank(a) - statusRank(b) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const issuesById = new Map(allItems.map((item) => [item.id, item]));
  const items = allItems.filter(isPresentWorkItem);
  const queueItems = allItems
    .filter((item) => !isCompletedItem(item) && !isPresentWorkItem(item))
    .slice(0, 16);
  const projects = buildProjectSummary(allItems);
  const recentRuns = buildRecentRunSummaries(runs, events, issuesById, evidenceRoot, worktreeRoot);
  const cycles = buildCycleSummary(allItems, observedAt);
  const activeExecutions = runs.filter((run) => ['claimed', 'launched', 'validating'].includes(asString(run.status) || '')).length;
  const reviewRuns = runs.filter((run) => asString(run.status) === 'review' && !isCompletedItem(issuesById.get(asString(run.task_id) || ''))).length;
  const activeLinearIssues = allItems.filter((item) => item.state.type === 'started' && !isCompletedItem(item)).length;
  const openLinearIssues = allItems.filter((item) => !isCompletedItem(item)).length;
  const readyLinearIssues = allItems.filter(isReadyForRunnerClaim).length;
  const dorBlockedLinearIssues = allItems.filter((item) => !isCompletedItem(item) && item.readiness?.verdict !== 'ready').length;
  const backlogLinearIssues = allItems.filter((item) => !isCompletedItem(item) && isBacklogItem(item)).length;
  const todoLinearIssues = allItems.filter((item) => !isCompletedItem(item) && isTodoItem(item)).length;
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
      observedTasks: allItems.length,
      activeLinearIssues,
      openLinearIssues,
      readyLinearIssues,
      dorBlockedLinearIssues,
      backlogLinearIssues,
      todoLinearIssues,
      projects: projects.length,
      lastEventAt,
    },
    projects,
    items,
    queueItems,
    recentRuns,
    cycles,
    flow: buildFlow(events),
  };
}

function deriveAutonomy(
  status: JsonRecord | null,
  scan: JsonRecord | null,
  liveReadiness: JsonRecord | null,
  work: RunnerWorkDigest | null,
  dispatchEnabled: boolean,
): RunnerStatusReport['autonomy'] {
  const mode = asString(status?.mode);
  const readiness = liveReadiness?.live_readiness && typeof liveReadiness.live_readiness === 'object' && !Array.isArray(liveReadiness.live_readiness)
    ? liveReadiness.live_readiness as JsonRecord
    : {};
  const liveReady = readiness.live_ready === true;
  const activeExecutions = work?.summary.activeExecutions ?? 0;
  const openLinearIssues = work?.summary.openLinearIssues ?? 0;
  const readyLinearIssues = work?.summary.readyLinearIssues ?? 0;
  const dorBlockedLinearIssues = work?.summary.dorBlockedLinearIssues ?? 0;
  const backlogLinearIssues = work?.summary.backlogLinearIssues ?? 0;
  const todoLinearIssues = work?.summary.todoLinearIssues ?? 0;
  const reasons: string[] = [];

  if (!status) {
    return {
      state: 'offline',
      label: 'Runner offline',
      tone: 'danger',
      reasons: ['runner_status_unavailable'],
      liveReady: false,
      dispatchEnabled,
      activeExecutions,
      openLinearIssues,
      readyLinearIssues,
      dorBlockedLinearIssues,
      backlogLinearIssues,
      todoLinearIssues,
    };
  }

  const scanDecision = asString(scan?.decision);
  const blockerCount = asNumber(readiness.blocker_count);
  if (mode) reasons.push(`mode:${mode}`);
  if (scanDecision) reasons.push(`scan:${scanDecision}`);
  if (typeof blockerCount === 'number' && blockerCount > 0) reasons.push(`live_blockers:${blockerCount}`);
  if (!dispatchEnabled) reasons.push('dashboard_dispatch_disabled');
  if (openLinearIssues > 0) reasons.push(`open_linear:${openLinearIssues}`);
  if (readyLinearIssues > 0) reasons.push(`ready:${readyLinearIssues}`);
  if (dorBlockedLinearIssues > 0) reasons.push(`not_ready:${dorBlockedLinearIssues}`);
  if (backlogLinearIssues > 0) reasons.push(`backlog:${backlogLinearIssues}`);
  if (todoLinearIssues > 0) reasons.push(`todo:${todoLinearIssues}`);

  if (mode === 'disabled' || mode === 'report_only') {
    return {
      state: 'report_only',
      label: mode === 'report_only' ? 'Report-only, not autonomous' : 'Disabled, not autonomous',
      tone: openLinearIssues > 0 ? 'warning' : 'muted',
      reasons,
      mode,
      liveReady,
      dispatchEnabled,
      activeExecutions,
      openLinearIssues,
      readyLinearIssues,
      dorBlockedLinearIssues,
      backlogLinearIssues,
      todoLinearIssues,
    };
  }

  if (!liveReady || !dispatchEnabled) {
    return {
      state: 'blocked',
      label: 'Autonomy blocked',
      tone: 'danger',
      reasons,
      mode,
      liveReady,
      dispatchEnabled,
      activeExecutions,
      openLinearIssues,
      readyLinearIssues,
      dorBlockedLinearIssues,
      backlogLinearIssues,
      todoLinearIssues,
    };
  }

  if (activeExecutions > 0) {
    return {
      state: 'autonomous',
      label: 'Autonomous work active',
      tone: 'safe',
      reasons,
      mode,
      liveReady,
      dispatchEnabled,
      activeExecutions,
      openLinearIssues,
      readyLinearIssues,
      dorBlockedLinearIssues,
      backlogLinearIssues,
      todoLinearIssues,
    };
  }

  return {
    state: 'idle',
    label: readyLinearIssues > 0
      ? 'Autonomy idle with ready queue'
      : openLinearIssues > 0
        ? 'Autonomy idle; no ready issues'
        : 'Autonomy idle',
    tone: readyLinearIssues > 0 ? 'warning' : 'safe',
    reasons,
    mode,
    liveReady,
    dispatchEnabled,
    activeExecutions,
    openLinearIssues,
    readyLinearIssues,
    dorBlockedLinearIssues,
    backlogLinearIssues,
    todoLinearIssues,
  };
}

function deriveAutonomyView(
  status: JsonRecord | null,
  liveReadiness: JsonRecord | null,
  authoritySnapshot: JsonRecord | null,
  work: RunnerWorkDigest | null,
): RunnerAutonomyView {
  const mode = asString(status?.mode);
  const config = asRecord(status?.config as JsonValue | undefined);
  const readiness = liveReadiness?.live_readiness && typeof liveReadiness.live_readiness === 'object' && !Array.isArray(liveReadiness.live_readiness)
    ? liveReadiness.live_readiness as JsonRecord
    : {};
  const readinessEvidence = asRecord(readiness.evidence as JsonValue | undefined) || {};
  const fullAutonomyApproval = asRecord(readinessEvidence.full_autonomy_approval as JsonValue | undefined);
  const fullAutonomyEnvelope = asRecord(fullAutonomyApproval?.envelope as JsonValue | undefined) || {};
  const fullAutonomyBudgets = asRecord(fullAutonomyEnvelope.budgets as JsonValue | undefined) || {};
  const fullAutonomyApprovalOk = fullAutonomyApproval?.ok === true
    && ['valid_live', 'valid_report_only'].includes(String(fullAutonomyApproval.status || ''));
  const killSwitch = asRecord(readiness.kill_switch_state as JsonValue | undefined) || {};
  const authority = asRecord(authoritySnapshot?.authority_snapshot as JsonValue | undefined) || {};
  const verifications = asRecord(authority.verifications as JsonValue | undefined) || {};
  const approvalVerification = asRecord(verifications.approval_records as JsonValue | undefined);
  const rollbackVerification = asRecord(verifications.rollback as JsonValue | undefined);
  const linearVerification = asRecord(verifications.linear_writeback as JsonValue | undefined);
  const githubVerification = asRecord(verifications.github_writeback as JsonValue | undefined);
  const lanes = queueBands(work);
  const approvalItems = (work?.queueItems || [])
    .filter(isRunnerSourceQueueItem)
    .filter((item) => item.readiness?.hitlClass && item.readiness.hitlClass !== 'No-HITL')
    .slice(0, 5)
    .map((item) => ({ id: item.id, title: item.title, reason: item.readiness?.hitlClass || 'approval required' }));
  const routeHealth = workerRouteHealth(work);
  const rollbackReasons: string[] = [];
  if (!rollbackVerification && !fullAutonomyApprovalOk) rollbackReasons.push('rollback_verification_missing');
  if (rollbackVerification && rollbackVerification.status !== 'pass') rollbackReasons.push(`rollback:${String(rollbackVerification.status || 'unknown')}`);
  const writebackReasons: string[] = [];
  if (!linearVerification) writebackReasons.push(fullAutonomyApprovalOk ? 'writeback convergence not yet observed' : 'linear_writeback_verification_missing');
  if (linearVerification && linearVerification.status !== 'pass') writebackReasons.push(`linear:${String(linearVerification.status || 'unknown')}`);
  if (githubVerification && githubVerification.status !== 'pass') writebackReasons.push(`github:${String(githubVerification.status || 'unknown')}`);
  const held = (work?.recentRuns || []).filter((run) => run.status === 'held').length;
  if (held > 0) writebackReasons.push(`held:${held}`);
  const approvalState: RunnerAutonomyView['approval']['state'] = approvalVerification?.status === 'pass' || fullAutonomyApprovalOk
    ? 'valid'
    : config?.approval_envelope_path || config?.approval_envelope_id
      ? 'blocked'
      : 'missing';
  const rollbackReason = rollbackReasons[0]
    || (fullAutonomyApprovalOk ? 'rollback covered by approval envelope' : 'rollback verification pass');
  const operatorActions: RunnerAutonomyView['operatorActions'] = [
    {
      id: 'kill_switch',
      label: 'Kill switch',
      state: killSwitch.active === true || killSwitch.valid === false ? 'blocked' : 'clear',
      reason: asString(killSwitch.reason) || 'not reported',
    },
    {
      id: 'approval_queue',
      label: 'Approval queue',
      state: approvalItems.length > 0 ? 'attention' : 'clear',
      reason: `${approvalItems.length} approval-gated item${approvalItems.length === 1 ? '' : 's'}`,
    },
    {
      id: 'rollback',
      label: 'Rollback',
      state: rollbackReasons.length > 0 ? 'attention' : 'clear',
      reason: rollbackReason,
    },
    {
      id: 'writeback',
      label: 'Writeback',
      state: writebackReasons.length > 0 ? 'attention' : 'clear',
      reason: writebackReasons[0] || 'writeback verification pass',
    },
  ];

  return {
    mode,
    activationMode: activationMode(mode),
    approval: {
      state: approvalState,
      approvalId: asString(config?.approval_envelope_id) || asString(fullAutonomyApproval?.approval_id),
      path: asString(config?.approval_envelope_path) || asString(fullAutonomyApproval?.path),
    },
    dispositions: {
      summary: {
        auto_execute: lanes.ready,
        auto_normalize_then_execute: lanes.needsInfo,
        auto_review: lanes.reviewOnly,
        auto_recover: lanes.running,
        auto_plan: lanes.approvalGated + lanes.completed,
        blocked_by_policy: lanes.blocked,
      },
      lanes,
    },
    operatorActions,
    workerRoutes: Object.entries(routeHealth).map(([route, health]) => ({ route, ...health })),
    routeHealth,
    approvalQueue: {
      count: approvalItems.length,
      items: approvalItems,
    },
    rollbackReadiness: {
      state: rollbackReasons.length > 0 ? 'attention' : 'ready',
      reasons: rollbackReasons,
    },
    writebackHealth: {
      state: writebackReasons.length > 0 ? 'attention' : 'converged',
      held,
      reasons: writebackReasons,
    },
    budget: {
      timeBudgetSeconds: asNumber(config?.autonomy_time_budget_seconds) || asNumber(fullAutonomyBudgets.time_budget_seconds),
      tokenBudget: asNumber(config?.autonomy_work_budget) || asNumber(fullAutonomyBudgets.token_budget),
      costBudgetUsd: asNumber(fullAutonomyBudgets.cost_budget_usd),
    },
    killSwitch: {
      active: asBoolean(killSwitch.active),
      valid: asBoolean(killSwitch.valid),
      source: asString(killSwitch.source),
      reason: asString(killSwitch.reason),
    },
    dashboardMutations: 0,
  };
}

function activationMode(mode?: string): RunnerAutonomyView['activationMode'] {
  if (mode === 'full_autonomy_live' || mode === 'full_autonomy_candidate' || mode === 'class_scoped_autonomy' || mode === 'report_only' || mode === 'disabled') {
    return mode;
  }
  return 'unknown';
}

function queueBands(work: RunnerWorkDigest | null): RunnerAutonomyView['dispositions']['lanes'] {
  const lanes = {
    running: 0,
    ready: 0,
    needsInfo: 0,
    approvalGated: 0,
    reviewOnly: 0,
    blocked: 0,
    completed: 0,
  };
  for (const item of work?.items || []) {
    const runnerStatus = item.runner.status.toLowerCase();
    const state = item.state.name.toLowerCase();
    const stateType = (item.state.type || '').toLowerCase();
    if (['claimed', 'launched', 'validating'].includes(runnerStatus) || ['started'].includes(stateType)) {
      lanes.running += 1;
      continue;
    }
    if (['review', 'in review'].includes(runnerStatus) || state === 'in review') {
      lanes.reviewOnly += 1;
      continue;
    }
    if (['done', 'completed', 'canceled', 'cancelled'].includes(state) || ['completed', 'canceled'].includes(stateType)) {
      lanes.completed += 1;
      continue;
    }
    if (['blocked', 'failed', 'quarantined'].includes(runnerStatus)) {
      lanes.blocked += 1;
      continue;
    }
    if (item.readiness?.hitlClass && item.readiness.hitlClass !== 'No-HITL') {
      lanes.approvalGated += 1;
      continue;
    }
    if (item.readiness?.verdict === 'missing') {
      lanes.needsInfo += 1;
      continue;
    }
    if (item.readiness?.verdict === 'ready') {
      lanes.ready += 1;
      continue;
    }
    lanes.needsInfo += 1;
  }
  for (const item of work?.queueItems || []) {
    const runnerStatus = item.runner.status.toLowerCase();
    const state = item.state.name.toLowerCase();
    if (['review', 'in review'].includes(runnerStatus) || state === 'in review') {
      lanes.reviewOnly += 1;
      continue;
    }
    if (!isRunnerSourceQueueItem(item)) continue;
    if (item.readiness?.hitlClass && item.readiness.hitlClass !== 'No-HITL') lanes.approvalGated += 1;
    else if (item.readiness?.verdict === 'ready') lanes.ready += 1;
    else if (item.readiness?.verdict === 'missing') lanes.needsInfo += 1;
  }
  return lanes;
}

function workerRouteHealth(work: RunnerWorkDigest | null): RunnerAutonomyView['routeHealth'] {
  const routes: RunnerAutonomyView['routeHealth'] = {};
  for (const run of work?.recentRuns || []) {
    const route = run.workerRoute || 'unknown';
    const current = routes[route] || { state: 'idle' as const, active: 0, recent: 0, health: 'observed' };
    current.recent += 1;
    if (['claimed', 'launched', 'validating'].includes(run.status)) current.active += 1;
    if (['failed', 'blocked', 'quarantined'].includes(run.status)) current.health = run.status;
    routes[route] = current;
  }
  if (!routes.codex_exec) {
    routes.codex_exec = { state: 'idle', active: 0, recent: 0, health: 'no recent runs' };
  }
  for (const route of Object.values(routes)) {
    route.state = route.active > 0 ? 'active' : route.health === 'observed' || route.health === 'no recent runs' ? 'idle' : 'attention';
  }
  return routes;
}

async function collectRunnerStatusFresh(): Promise<RunnerStatusReport> {
  const repo = await findRunnerRepo();
  const observedAt = new Date().toISOString();
  const liveDbPath = process.env.RUNNERD_DB_PATH?.trim() || DEFAULT_LIVE_DB_PATH;
  const liveConfigPath = process.env.RUNNERD_CONFIG_PATH?.trim() || DEFAULT_RUNNERD_CONFIG_PATH;
  const liveEvidenceRoot = process.env.RUNNERD_EVIDENCE_ROOT?.trim() || DEFAULT_RUNNERD_EVIDENCE_ROOT;
  const liveWorktreeRoot = process.env.RUNNERD_WORKTREE_ROOT?.trim() || DEFAULT_RUNNERD_WORKTREE_ROOT;
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
      webhookQueue: defaultWebhookQueueHealth(),
      autonomy: {
        state: 'offline',
        label: 'Runner offline',
        tone: 'danger',
        reasons: ['runnerd_repository_not_found'],
        liveReady: false,
        dispatchEnabled: false,
        activeExecutions: 0,
        openLinearIssues: 0,
        readyLinearIssues: 0,
        dorBlockedLinearIssues: 0,
        backlogLinearIssues: 0,
        todoLinearIssues: 0,
      },
      liveDbPath,
      safety: {
        dashboardMutations: 0,
        liveDispatchEnabled: false,
        serviceMutationEnabled: false,
        commands: [],
      },
      commands: {},
      autonomyView: deriveAutonomyView(null, null, null, null),
      error: repo.error,
    };
  }

  const [gitBranch, gitHead, runnerStatus, runnerDoctor, runnerScan, runnerLiveReadiness, runnerAuthoritySnapshot, runnerWork] = await Promise.all([
    execFileJson('git', ['branch', '--show-current'], repo.repoPath),
    execFileJson('git', ['rev-parse', 'HEAD'], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'status', '--json', '--config', liveConfigPath, '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'doctor', '--strict', '--json', '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'scan', '--dry-run', '--json', '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', liveReadinessArgs, repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'live', 'authority', 'snapshot', '--json'], repo.repoPath),
    collectRunnerWorkDigest(repo.repoPath, liveDbPath, liveEvidenceRoot, liveWorktreeRoot).catch((err: unknown): RunnerWorkDigest => ({
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
        openLinearIssues: 0,
        readyLinearIssues: 0,
        dorBlockedLinearIssues: 0,
        backlogLinearIssues: 0,
        todoLinearIssues: 0,
        projects: 0,
        lastEventAt: null,
      },
      projects: [],
      items: [],
      queueItems: [],
      recentRuns: [],
      cycles: [],
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
  const statusRecord = asRecord(runnerStatus.json);
  const scanRecord = asRecord(runnerScan.json);
  const liveReadinessRecord = asRecord(runnerLiveReadiness.json);
  const authoritySnapshotRecord = asRecord(runnerAuthoritySnapshot.json);
  const dispatchEnabled = statusRecord?.dispatch_enabled === true;

  return {
    ok,
    observedAt,
    repoPath: repo.repoPath,
    branch: singleLine(gitBranch),
    head: singleLine(gitHead),
    status: statusRecord,
    doctor: asRecord(runnerDoctor.json),
    scan: scanRecord,
    liveReadiness: liveReadinessRecord,
    authoritySnapshot: authoritySnapshotRecord,
    work: runnerWork,
    webhookQueue: defaultWebhookQueueHealth(),
    autonomyView: deriveAutonomyView(statusRecord, liveReadinessRecord, authoritySnapshotRecord, runnerWork),
    autonomy: deriveAutonomy(statusRecord, scanRecord, liveReadinessRecord, runnerWork, dispatchEnabled),
    liveDbPath,
    safety: {
      dashboardMutations: 0,
      liveDispatchEnabled: false,
      serviceMutationEnabled: false,
      commands: [
        'git branch --show-current',
        'git rev-parse HEAD',
        `python3 -m runnerd.cli status --json --config ${liveConfigPath} --db ${liveDbPath}`,
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

export async function collectRunnerStatus(options: { force?: boolean } = {}): Promise<RunnerStatusReport> {
  const cacheMs = statusCacheMs();
  const now = Date.now();
  if (!options.force && cacheMs > 0 && cachedStatus && now - cachedStatus.cachedAt < cacheMs) {
    return cachedStatus.report;
  }
  if (!options.force && pendingStatus) {
    return pendingStatus;
  }

  pendingStatus = collectRunnerStatusFresh()
    .then((report) => {
      cachedStatus = { report, cachedAt: Date.now() };
      return report;
    })
    .finally(() => {
      pendingStatus = null;
    });

  return pendingStatus;
}
