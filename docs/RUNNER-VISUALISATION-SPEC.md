# Runner Visualisation Spec

Status: implementation spec for the Nerve runner view. This spec does not approve runner live dispatch, service mutation, credential changes, public-edge changes, or OpenClaw Gateway mutation.

## Goal

Add a first-class Runner view to Nerve so the operator can inspect runnerd posture from the cockpit without leaving the dashboard.

The view must look and behave like the rest of Nerve: same shell panel, top-bar view switcher, cockpit typography, compact cards, subdued borders, status chips, and operator-focused density. It must not look like a separate marketing page or standalone admin console.

## Entry Point

- The top bar exposes a `Runner` view button beside `Chat` and `Tasks`.
- The button uses the same `shell-chip` treatment, icon sizing, active state, responsive wrapping, and keyboard focus styling as the existing `Tasks` button.
- The command palette exposes `Open Runner View`.
- Persisted `nerve:viewMode=runner` reopens the runner view.

## Data Contract

Nerve exposes one read-only endpoint:

```text
GET /api/runner/status
```

The endpoint runs only bounded local probes:

- `git branch --show-current`
- `git rev-parse HEAD`
- `python3 -m runnerd.cli status --json --db <configured-live-db-path>`
- `python3 -m runnerd.cli doctor --strict --json --db <configured-live-db-path>`
- `python3 -m runnerd.cli scan --dry-run --json --db <configured-live-db-path>`
- `python3 -m runnerd.cli live-readiness --json`
- `python3 -m runnerd.cli live authority snapshot --json`

The response includes branch/head metadata, the live DB path used for read-only probes, runner status, strict doctor output, dry-run scan output, live-readiness gate output, host authority snapshot output, command success/failure metadata, and an explicit safety block.

## Safety Requirements

- Dashboard mutations are always `0`.
- The dashboard never calls `runnerd live dispatch`, `runnerd live service`, service manager commands, package managers, Linear/GitHub writeback, or OpenClaw Gateway mutation methods.
- The endpoint uses scrubbed environment variables and a short command timeout.
- The endpoint must fail closed when the runner repo cannot be found or probes fail.
- Raw secrets must not be returned. The runner command set should produce structured status, not credential dumps.
- Live readiness may show blocked states; the UI must present those as operator posture, not as errors to hide.

## Visual Layout

The Runner view is wrapped by the existing App-level `shell-panel boot-panel rounded-[28px]` container, matching Tasks.

Inside the view:

- A header mirrors `KanbanHeader`: `cockpit-kicker`, `h1`, compact status chips, right-aligned refresh button, and bottom border.
- Summary tiles show mode, dry-run scan, DB health, and branch/head.
- Readiness gates are rendered as compact Nerve cards using status chips derived from `live_readiness.gate_chips`.
- Authority snapshot rows show observed service, DB, kill switch, credential-reference, worker, evidence, writeback, rollback, and approval-record state without exposing secret values.
- Safety and command probes are secondary panels using `cockpit-note`, `shell-panel`, mono command text, and existing green/orange/destructive tones.
- Raw JSON is available for auditability but visually secondary.

## Acceptance Checks

- The source tree can build the client bundle without running `npm install`.
- TypeScript checks pass for new/touched files using available existing dependencies.
- `/api/runner/status` works in a local Hono probe and returns no mutations.
- The frontend bundle contains the Runner route and fetches `/api/runner/status`.
- Playwright visual checks confirm the Runner button and panel render at desktop and mobile widths without overlap.
- DB health is read from the configured live DB path, while live-readiness remains the source of truth for whether that DB proof can count toward live activation.
- Hosted deployment, if performed, preserves OAuth protection on `https://oliver-longhurst.co.uk`.

## Current OpenClaw Test Posture

Safe OpenClaw checks may prove gateway and task/session read surfaces are alive, but they do not prove a live runner dispatch. A first live runner cycle remains blocked until runnerd live-readiness reports the required service, DB, worker, approval, writeback, and rollback evidence.
