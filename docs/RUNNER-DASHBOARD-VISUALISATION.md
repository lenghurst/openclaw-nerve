# Runner Dashboard Visualisation

## Purpose

The Runner dashboard is the present-tense view of Runner work inside Nerve. It should answer:

- What is being worked on now?
- Which Linear project or parent issue does it belong to?
- Is Runner actively executing it, reviewing it, or only observing it from Linear?
- What has Runner recently claimed, launched, and handed to review?
- Is there a Codex handoff path, and is it actually established?

It is not a raw runner diagnostics page. Probe commands, JSON reports, and readiness internals are agent/operator support data and should not dominate the end-user view.

## Data Model

The page combines two read-only sources:

- Linear project work for the `runner` project: issue id, title, URL, state, state type, project, parent issue, assignee, priority, cycle, and timestamps.
- Runner SQLite execution state: claims, runs, worker refs, evidence validations, task snapshots, and recent event flow.
- The present-tense list is filtered from Linear state plus active Runner execution state. Completed/cancelled Linear issues are not active work even if older Runner runs still exist in SQLite.
- Linear descriptions are reduced to short previews before they reach the UI, so the dashboard shows task context without shipping entire issue bodies on every refresh.

The dashboard must not mutate Linear, Runner SQLite, GitHub, worktrees, or service state. Linear access is read-only GraphQL using the Runner secret reference already present on the host.

## Information Hierarchy

Primary content:

- Active Linear issue count.
- Runner executing count for `claimed`, `launched`, and `validating`.
- Runs in review.
- Last Runner event time.
- A table-like active work list grouped around issue identity, title, project, parent issue, state, runner status, worker route, validation, cycle, and timestamp.
- Recent Runner outcomes remain available as history, but they do not imply current manual review work once Linear says the task is complete.

Secondary content:

- Linear project rollup with total, active, review, and completed counts.
- Recent Runner outcomes from SQLite.
- Execution history over recent days: claimed, launched, resolved, and validated event counts.

Tertiary content:

- Readiness gate summary for agents/operators.
- Codex `/goal` handoff state should not be shown as dashboard content until there is an actionable, tested start protocol.

## UI Rules

- Match Nerve’s shell-panel, cockpit-kicker, chip, and compact toolbar visual language.
- Keep mobile first-class. At 320 px width the top navigation must remain visible without horizontal overflow.
- Hide the local Tasks/Kanban top-level button by default. Keep the existing Kanban implementation available behind Settings as a local Nerve feature.
- Prefer actual issue titles and project names over opaque runner command output.
- Prefer Linear completion state over stale Runner worker refs when deciding whether work is current.
- Keep readiness available, but never make it the main dashboard story.
- Background refresh should use deterministic HTTP/SQLite/Linear reads. It does not spend model tokens. The server caches status probes briefly so multiple open dashboards do not rerun the full command set at once.

## Current Limitations

- Linear cycles are shown when present; the current runner issues do not appear to be assigned to cycles.
- Subsessions are not yet represented as first-class Runner work units. The page currently shows worker refs and recent runs. A future Runner protocol should persist subsession/session references if they need dashboard visibility.
- Linear-to-Codex Desktop start automation is still a separate protocol. The dashboard stays read-only until that route is explicit, authenticated, and tested.
