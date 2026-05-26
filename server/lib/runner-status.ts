import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type JsonRecord = Record<string, unknown>;

interface CommandResult {
  ok: boolean;
  command: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  json?: JsonRecord | null;
  error?: string;
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
      if (trimmed.startsWith('{')) {
        try {
          result.json = JSON.parse(trimmed) as JsonRecord;
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

export async function collectRunnerStatus(): Promise<RunnerStatusReport> {
  const repo = await findRunnerRepo();
  const observedAt = new Date().toISOString();
  const liveDbPath = process.env.RUNNERD_DB_PATH?.trim() || DEFAULT_LIVE_DB_PATH;

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

  const [gitBranch, gitHead, runnerStatus, runnerDoctor, runnerScan, runnerLiveReadiness, runnerAuthoritySnapshot] = await Promise.all([
    execFileJson('git', ['branch', '--show-current'], repo.repoPath),
    execFileJson('git', ['rev-parse', 'HEAD'], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'status', '--json', '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'doctor', '--strict', '--json', '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'scan', '--dry-run', '--json', '--db', liveDbPath], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'live-readiness', '--json'], repo.repoPath),
    execFileJson('python3', ['-m', 'runnerd.cli', 'live', 'authority', 'snapshot', '--json'], repo.repoPath),
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
    status: runnerStatus.json ?? null,
    doctor: runnerDoctor.json ?? null,
    scan: runnerScan.json ?? null,
    liveReadiness: runnerLiveReadiness.json ?? null,
    authoritySnapshot: runnerAuthoritySnapshot.json ?? null,
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
        'python3 -m runnerd.cli live-readiness --json',
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
