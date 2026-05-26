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

The dashboard must not mutate Linear, Runner SQLite, GitHub, worktrees, or service state. Linear access is read-only GraphQL using the Runner secret reference already present on the host.

## Information Hierarchy

Primary content:

- Active Linear issue count.
- Runner executing count for `claimed`, `launched`, and `validating`.
- Runs in review.
- Last Runner event time.
- A table-like active work list grouped around issue identity, title, project, parent issue, state, runner status, worker route, validation, cycle, and timestamp.

Secondary content:

- Linear project rollup with active, review, scoped, and completed counts.
- Recent Runner runs from SQLite.
- Execution flow over recent days: claimed, launched, review.

Tertiary content:

- Readiness gate summary for agents/operators.
- Codex `/goal` handoff status. Until a real Linear-to-Codex Desktop protocol exists, it must say that the bridge is not established.

## UI Rules

- Match Nerve’s shell-panel, cockpit-kicker, chip, and compact toolbar visual language.
- Keep mobile first-class. At 320 px width the top navigation must remain visible without horizontal overflow.
- Hide the local Tasks/Kanban top-level button by default. Keep the existing Kanban implementation available behind Settings as a local Nerve feature.
- Prefer actual issue titles and project names over opaque runner command output.
- Keep readiness available, but never make it the main dashboard story.

## Current Limitations

- Linear cycles are shown when present; the current runner issues do not appear to be assigned to cycles.
- Subsessions are not yet represented as first-class Runner work units. The page currently shows worker refs and recent runs. A future Runner protocol should persist subsession/session references if they need dashboard visibility.
- Linear tagging to this Codex Desktop `/goal` context is not established. It needs a separate protocol before automation can safely act on tasks from this chat harness.
