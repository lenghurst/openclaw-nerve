# Runner codex_exec Visibility Spec

Status: implementation spec for Nerve Runner worker visibility.
Date: 2026-05-27.

## Problem

`runnerd` can launch `codex_exec` workers, but the operator cannot inspect the worker as a concrete execution unit inside Nerve. The old dashboard state made it too easy to confuse four different things:

- a Linear issue
- a runnerd claim/run
- a `codex exec` subprocess
- an OpenClaw Agent/subagent session

The UI must show the `codex_exec` worker and its isolated worktree without representing it as a native OpenClaw Agent.

## Goals

- Surface the worker route, status, validation, packet id, worktree path, evidence directory, transcript reference, command exit code, final head, and diff/no-diff marker.
- Host the operator-facing Runner view through the existing production Nerve surface at `https://oliver-longhurst.co.uk`, not a temporary localhost Vite server.
- Keep the Runner dashboard read-only.
- Preserve Nerve's compact cockpit aesthetic: dense rows, shell panels, subdued borders, chips, and no marketing-style explanation.
- Fit at mobile widths without horizontal scrolling or text overlap.
- Keep raw secrets out of the response. Only redacted command argv, manifest metadata, refs, and paths are exposed.

## Non-Goals

- Do not launch, cancel, approve, dispatch, or mutate Runner work from the dashboard.
- Do not mount arbitrary local files in the browser.
- Do not show `codex_exec` as a normal OpenClaw Agent session.
- Do not parse prompt text or display full transcripts inline.
- Do not add an `openclaw_session` worker route in this change.

## Data Contract

`GET /api/runner/status` remains the single endpoint.

Production routing is nginx `oliver-longhurst.co.uk` -> `openclaw-nerve.service` on `127.0.0.1:3080`; OAuth protects the public UI/API perimeter and Nerve auth remains enforced behind it.

For each runner DB run, the server reads:

- SQLite tables: `runs`, `claims`, `worker_refs`, `task_snapshots`, `evidence_validations`, `events`
- Evidence manifest: `<evidence_root>/<run_id>/manifest.json`
- Command manifest: `<evidence_root>/<run_id>/commands.json`

The response adds `runner.artifact` on work items and `artifact` on recent run summaries:

```ts
interface RunnerWorkerArtifact {
  route?: string;              // e.g. codex_exec
  packetId?: string;           // worker_refs.details_json.packet_id
  autonomy?: boolean;
  evidenceDir?: string;        // manifest.evidence_dir or expected evidence path
  worktreePath?: string;       // manifest.workspace_path or command cwd
  workspaceId?: string;
  finalHead?: string;
  manifestPresent: boolean;
  files: Array<{ path: string; sha256?: string }>;
  command?: {
    cwd?: string;
    exitCode?: number | null;
    stdoutRef?: string;        // usually codex-events.jsonl
    stderrRef?: string;        // usually codex-stderr.txt
    argvRedacted?: string[];   // prompt is redacted
  };
  transcriptRef?: string;
  stderrRef?: string;
  diffRef?: string;
  hasDiff: boolean;
  noDiff: boolean;
}
```

## UI Requirements

- Work item rows show a compact worker artifact block below the issue metadata when artifact data exists.
- Recent outcomes also show the artifact block in compact mode.
- The block must include:
  - `codex_exec` route chip
  - evidence file count
  - diff/no-diff marker
  - command exit code
  - packet id when present
  - worktree path
  - evidence path
  - transcript reference
  - final head in non-compact rows
- Long paths use `break-all`/truncate-safe styling and cannot overflow the viewport.
- The artifact block uses existing `StatusChip`, `cockpit-kicker`, `shell-panel`, muted border, and compact text patterns.

## Safety Requirements

- Endpoint remains read-only and reports `dashboardMutations: 0`.
- Server reads only manifest/command metadata from the evidence directory.
- Prompt text, raw transcript body, stderr content, and environment values are not returned.
- Missing manifests degrade gracefully to expected evidence/worktree paths.
- The UI labels the worker as `codex_exec`, not as an Agent.

## Acceptance Tests

- Unit/component: `RunnerPanel` renders `codex_exec`, the isolated worktree path, evidence path, transcript ref, no-diff/diff marker, and packet id from mocked Runner status.
- API route: `/api/runner/status` still returns the safety block and preserves non-mutating behavior.
- Type/build: TypeScript accepts the extended `RunnerStatusReport` contract.
- Live smoke: local `/api/runner/status?refresh=1` returns actual runnerd work summaries with artifact fields for existing runs.
- Visual smoke: Runner view renders at desktop and mobile widths without path overflow or panel overlap.

## Residual Risks

- A stale evidence manifest can point at a deleted worktree. The UI should show the recorded path, not claim the path is currently alive.
- Very large evidence file lists are summarized by count and a few refs; raw file browsing remains outside this change.
- If future worker routes use different manifest names, this spec needs a route-specific artifact adapter rather than overloading `codex_exec` assumptions.
