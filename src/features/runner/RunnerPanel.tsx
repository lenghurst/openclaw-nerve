import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Folder,
  GitBranch,
  HardDrive,
  ListChecks,
  RefreshCw,
  Route,
  ShieldCheck,
  Terminal,
  Workflow,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRunnerStatus, type RunnerStatusReport, type RunnerWorkItem, type RunnerRunSummary, type RunnerWorkerArtifact } from './useRunnerStatus';

type Tone = 'safe' | 'warning' | 'danger' | 'muted' | 'primary';

function toneClass(tone: Tone): string {
  if (tone === 'safe') return 'border-green/25 bg-green/10 text-green';
  if (tone === 'warning') return 'border-orange/25 bg-orange/10 text-orange';
  if (tone === 'danger') return 'border-destructive/25 bg-destructive/10 text-destructive';
  if (tone === 'primary') return 'border-primary/25 bg-primary/10 text-primary';
  return 'border-border/70 bg-background/70 text-muted-foreground';
}

function statusTone(status?: string, stateType?: string): Tone {
  const normalized = (status || '').toLowerCase();
  if (['launched', 'claimed', 'validating'].includes(normalized)) return 'primary';
  if (normalized === 'done' || normalized === 'completed') return 'safe';
  if (normalized === 'review' || normalized.includes('review')) return 'warning';
  if (stateType === 'started') return 'primary';
  if (stateType === 'completed') return 'safe';
  if (normalized === 'blocked' || normalized === 'failed') return 'danger';
  return 'muted';
}

function readinessTone(item: RunnerWorkItem): Tone {
  if (item.readiness?.verdict === 'ready' && item.readiness.hitlClass === 'No-HITL') return 'safe';
  if (item.readiness?.verdict === 'ready') return 'warning';
  if (item.readiness?.verdict === 'missing') return 'warning';
  return 'muted';
}

function readinessLabel(item: RunnerWorkItem): string {
  if (!item.readiness) return 'readiness unknown';
  if (item.readiness.verdict === 'ready' && item.readiness.hitlClass === 'No-HITL') return 'ready for Runner';
  if (item.readiness.verdict === 'ready') return `${item.readiness.hitlClass || 'HITL'} gated`;
  const missing = item.readiness.missing.length;
  const refusals = item.readiness.refusalCodes.length;
  if (missing || refusals) return `${missing + refusals} readiness gaps`;
  return item.readiness.verdict.replace('_', ' ');
}

function formatObservedAt(value?: string | null): string {
  if (!value) return 'not observed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatShortTime(value?: string | null): string {
  if (!value) return 'not observed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '0s';
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function shortenHash(value?: string): string {
  if (!value) return 'unknown';
  return value.startsWith('sha256:') ? value.slice(7, 19) : value.slice(0, 12);
}

function liveReadinessLabel(report: RunnerStatusReport | null): { label: string; tone: Tone } {
  const readiness = report?.liveReadiness?.live_readiness;
  if (!readiness) return { label: 'Gates unknown', tone: 'muted' };
  if (readiness.live_ready) return { label: 'Live gates clear', tone: 'safe' };
  const blockerCount = typeof readiness.blocker_count === 'number' ? readiness.blocker_count : null;
  if (blockerCount !== null) return { label: `${blockerCount} live blockers`, tone: blockerCount === 0 ? 'safe' : 'warning' };
  return { label: readiness.status || readiness.state || 'Live gated', tone: 'warning' };
}

function StatusChip({ icon, label, tone }: { icon: ReactNode; label: string; tone: Tone }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.667rem] font-medium ${toneClass(tone)}`}>
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

function MetricTile({
  icon,
  label,
  value,
  caption,
  tone = 'muted',
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  caption?: string;
  tone?: Tone;
}) {
  return (
    <div className="min-h-[96px] rounded-[24px] border border-border/70 bg-background/54 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase text-muted-foreground">
        <span className={`inline-flex size-8 items-center justify-center rounded-xl border ${toneClass(tone)}`}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      {caption && <div className="mt-1 truncate text-xs text-muted-foreground">{caption}</div>}
    </div>
  );
}

function ArtifactPathLine({ icon, label, value }: { icon: ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-start gap-2 text-[0.7rem]">
      <div className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0 break-all font-mono text-foreground/90" title={value}>{value}</div>
    </div>
  );
}

function WorkerArtifactBlock({ artifact, compact = false }: { artifact?: RunnerWorkerArtifact; compact?: boolean }) {
  if (!artifact) return null;
  const fileCount = artifact.files?.length || 0;
  const operator = artifact.operatorSummary;
  const diffLabel = artifact.hasDiff
    ? artifact.diffRef || 'diff.patch'
    : artifact.noDiff
      ? 'no diff'
      : 'diff unknown';
  const exitLabel = artifact.command?.exitCode === null || artifact.command?.exitCode === undefined
    ? 'exit unknown'
    : `exit ${artifact.command.exitCode}`;

  return (
    <div className={`min-w-0 rounded-2xl border border-border/60 bg-secondary/22 ${compact ? 'mt-2 px-2.5 py-2' : 'mt-3 px-3 py-2.5'}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <StatusChip icon={<Terminal size={12} aria-hidden="true" />} label={artifact.route || 'codex_exec'} tone="primary" />
        <StatusChip icon={<FileText size={12} aria-hidden="true" />} label={`${fileCount} evidence files`} tone={artifact.manifestPresent ? 'safe' : 'warning'} />
        <StatusChip icon={<GitBranch size={12} aria-hidden="true" />} label={diffLabel} tone={artifact.hasDiff ? 'warning' : 'muted'} />
        <StatusChip icon={<Clock3 size={12} aria-hidden="true" />} label={exitLabel} tone={artifact.command?.exitCode === 0 ? 'safe' : artifact.command?.exitCode === undefined ? 'muted' : 'danger'} />
        {artifact.packetId && (
          <span className="min-w-0 truncate rounded-full border border-border/60 bg-background/45 px-2 py-1 font-mono text-[0.667rem] text-muted-foreground" title={artifact.packetId}>
            {artifact.packetId}
          </span>
        )}
      </div>
      {operator && (
        <div className="mt-2 grid gap-1.5 rounded-xl border border-border/50 bg-background/35 px-2.5 py-2 text-[0.7rem]">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusChip icon={<ShieldCheck size={12} aria-hidden="true" />} label={operator.outcome || 'summary'} tone={operator.outcome === 'passed' ? 'safe' : operator.outcome === 'blocked' ? 'danger' : 'warning'} />
            <StatusChip icon={<ListChecks size={12} aria-hidden="true" />} label={operator.validation || 'validation unknown'} tone={operator.validation === 'passed' ? 'safe' : operator.refusalCodes?.length ? 'danger' : 'muted'} />
            <StatusChip icon={<GitBranch size={12} aria-hidden="true" />} label={operator.diffState || diffLabel} tone={operator.diffState === 'diff' ? 'warning' : 'muted'} />
          </div>
          <div className="min-w-0 truncate text-muted-foreground">
            {operator.changedFiles?.length ? operator.changedFiles.slice(0, 3).join(', ') : 'no changed files recorded'}
          </div>
          {operator.workerFinalMessage && (
            <p className="line-clamp-3 min-w-0 text-foreground/85">{operator.workerFinalMessage}</p>
          )}
        </div>
      )}
      <div className="mt-2 grid min-w-0 gap-1.5">
        <ArtifactPathLine icon={<HardDrive size={12} aria-hidden="true" />} label="Worktree" value={artifact.worktreePath} />
        <ArtifactPathLine icon={<FileText size={12} aria-hidden="true" />} label="Evidence" value={artifact.evidenceDir} />
        <ArtifactPathLine icon={<Terminal size={12} aria-hidden="true" />} label="Transcript" value={artifact.transcriptRef} />
        {!compact && <ArtifactPathLine icon={<GitBranch size={12} aria-hidden="true" />} label="Head" value={artifact.finalHead ? shortenHash(artifact.finalHead) : undefined} />}
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  kicker,
  title,
  aside,
}: {
  icon: ReactNode;
  kicker: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 bg-secondary/24 px-3 py-3">
      <div className="min-w-0">
        <div className="cockpit-kicker text-[0.6rem]">
          {icon}
          {kicker}
        </div>
        <h2 className="mt-1 truncate text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function WorkItemRow({ item }: { item: RunnerWorkItem }) {
  const tone = statusTone(item.runner.status, item.state.type);
  const runnerStatus = item.runner.status === 'not claimed' ? item.state.name : item.runner.status;
  const route = item.runner.workerRoute || item.runner.source.replace('_', ' ');
  const lastAt = item.runner.lastEventAt || item.runner.lastRunAt || item.updatedAt;

  return (
    <article className="border-b border-border/50 px-3 py-3 last:border-b-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-mono text-[0.733rem] font-semibold text-primary">{item.id}</span>
            <StatusChip
              icon={tone === 'safe' ? <CheckCircle2 size={12} aria-hidden="true" /> : <Activity size={12} aria-hidden="true" />}
              label={runnerStatus}
              tone={tone}
            />
            <StatusChip
              icon={<ListChecks size={12} aria-hidden="true" />}
              label={readinessLabel(item)}
              tone={readinessTone(item)}
            />
            {item.parent && (
              <span className="truncate text-[0.733rem] text-muted-foreground">under {item.parent.id}</span>
            )}
          </div>
          <div className="mt-1 min-w-0 text-sm font-medium text-foreground">
            {item.url ? (
              <a className="inline-flex min-w-0 items-center gap-1.5 hover:text-primary" href={item.url} target="_blank" rel="noreferrer">
                <span className="truncate">{item.title}</span>
                <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
              </a>
            ) : (
              <span>{item.title}</span>
            )}
          </div>
          {item.descriptionPreview && (
            <p className="mt-1 line-clamp-2 text-[0.733rem] leading-5 text-muted-foreground">
              {item.descriptionPreview}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.733rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Folder size={12} aria-hidden="true" />
              {item.project?.name || 'No project captured'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Route size={12} aria-hidden="true" />
              {route}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 size={12} aria-hidden="true" />
              {formatObservedAt(lastAt)}
            </span>
            {item.cycle?.name ? (
              <span className="inline-flex items-center gap-1">
                <BarChart3 size={12} aria-hidden="true" />
                {item.cycle.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <BarChart3 size={12} aria-hidden="true" />
                no cycle
              </span>
            )}
            {item.readiness?.missing && item.readiness.missing.length > 0 && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <AlertTriangle size={12} aria-hidden="true" />
                <span className="truncate">missing {item.readiness.missing.slice(0, 2).join(', ')}</span>
              </span>
            )}
          </div>
          <WorkerArtifactBlock artifact={item.runner.artifact} />
        </div>

        <div className="grid min-w-[180px] grid-cols-2 gap-2 text-[0.667rem] md:text-right">
          <div className="rounded-2xl border border-border/60 bg-background/48 px-2.5 py-2">
            <div className="text-muted-foreground">Worker</div>
            <div className="mt-0.5 truncate font-mono text-foreground">{item.runner.workerStatus || 'idle'}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/48 px-2.5 py-2">
            <div className="text-muted-foreground">Validation</div>
            <div className="mt-0.5 truncate font-mono text-foreground">{item.runner.validation || 'pending'}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProjectCard({ project }: { project: NonNullable<RunnerStatusReport['work']>['projects'][number] }) {
  const progress = project.total > 0 ? Math.round(((project.completed + project.review) / project.total) * 100) : 0;

  return (
    <div className="rounded-[24px] border border-border/70 bg-background/52 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{project.name}</div>
          <div className="mt-1 truncate text-[0.733rem] text-muted-foreground">{project.state || 'state unknown'}</div>
        </div>
        <StatusChip icon={<Activity size={12} aria-hidden="true" />} label={`${project.active} active`} tone={project.active > 0 ? 'primary' : 'muted'} />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[0.667rem]">
        <div className="rounded-2xl border border-border/60 bg-background/48 px-2 py-2">
          <div className="font-semibold text-foreground">{project.total}</div>
          <div className="text-muted-foreground">Total</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/48 px-2 py-2">
          <div className="font-semibold text-foreground">{project.active}</div>
          <div className="text-muted-foreground">Active</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/48 px-2 py-2">
          <div className="font-semibold text-foreground">{project.review}</div>
          <div className="text-muted-foreground">Review</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/48 px-2 py-2">
          <div className="font-semibold text-foreground">{project.completed}</div>
          <div className="text-muted-foreground">Done</div>
        </div>
      </div>
    </div>
  );
}

function AutonomyBanner({ report }: { report: RunnerStatusReport | null }) {
  const autonomy = report?.autonomy;
  if (!autonomy) {
    return (
      <div className="cockpit-note px-3 py-2 text-[0.733rem]" data-tone="danger">
        Runner autonomy state is not available.
      </div>
    );
  }

  const visibleReasons = autonomy.reasons.slice(0, 6);
  return (
    <div className="rounded-2xl border border-border/70 bg-background/54 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="cockpit-kicker text-[0.6rem]">
            <Workflow size={12} className="text-primary" aria-hidden="true" />
            Autonomy state
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <StatusChip icon={<Activity size={12} aria-hidden="true" />} label={autonomy.label} tone={autonomy.tone} />
            <StatusChip
              icon={<Zap size={12} aria-hidden="true" />}
              label={autonomy.dispatchEnabled ? 'dispatch enabled' : 'dispatch disabled'}
              tone={autonomy.dispatchEnabled ? 'safe' : 'warning'}
            />
            <StatusChip
              icon={<ListChecks size={12} aria-hidden="true" />}
              label={`${autonomy.openLinearIssues} open Linear`}
              tone={autonomy.openLinearIssues > 0 ? 'warning' : 'safe'}
            />
            <StatusChip
              icon={<CheckCircle2 size={12} aria-hidden="true" />}
              label={`${autonomy.readyLinearIssues} ready`}
              tone={autonomy.readyLinearIssues > 0 ? 'safe' : 'muted'}
            />
            <StatusChip
              icon={<AlertTriangle size={12} aria-hidden="true" />}
              label={`${autonomy.dorBlockedLinearIssues} not ready`}
              tone={autonomy.dorBlockedLinearIssues > 0 ? 'warning' : 'safe'}
            />
          </div>
        </div>
        <div className="grid min-w-[220px] grid-cols-3 gap-2 text-center text-[0.667rem]">
          <div className="rounded-2xl border border-border/60 bg-background/48 px-2 py-2">
            <div className="font-semibold text-foreground">{autonomy.activeExecutions}</div>
            <div className="text-muted-foreground">Running</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/48 px-2 py-2">
            <div className="font-semibold text-foreground">{autonomy.todoLinearIssues}</div>
            <div className="text-muted-foreground">Todo</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/48 px-2 py-2">
            <div className="font-semibold text-foreground">{autonomy.backlogLinearIssues}</div>
            <div className="text-muted-foreground">Backlog</div>
          </div>
        </div>
      </div>
      {visibleReasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleReasons.map((reason) => (
            <span key={reason} className="rounded-full border border-border/60 bg-secondary/35 px-2 py-1 font-mono text-[0.667rem] text-muted-foreground">
              {reason}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FullAutonomySurface({ report }: { report: RunnerStatusReport | null }) {
  const view = report?.autonomyView;
  if (!view) return null;
  const lanes = [
    ['Running', view.dispositions.lanes.running, 'primary' as Tone],
    ['Ready', view.dispositions.lanes.ready, 'safe' as Tone],
    ['Needs info', view.dispositions.lanes.needsInfo, 'warning' as Tone],
    ['Approval', view.dispositions.lanes.approvalGated, 'warning' as Tone],
    ['Review', view.dispositions.lanes.reviewOnly, 'primary' as Tone],
    ['Blocked', view.dispositions.lanes.blocked, 'danger' as Tone],
    ['Completed', view.dispositions.lanes.completed, 'muted' as Tone],
  ];
  const routes = view.workerRoutes.slice(0, 4);
  const actions = view.operatorActions.slice(0, 4);

  return (
    <section className="shell-panel overflow-hidden rounded-[24px]">
      <SectionHeader
        icon={<ShieldCheck size={12} className="text-primary" aria-hidden="true" />}
        kicker="Full autonomy"
        title="Approval surface"
        aside={<StatusChip icon={<Activity size={12} aria-hidden="true" />} label={view.activationMode.replace(/_/g, ' ')} tone={view.approval.state === 'valid' ? 'safe' : 'warning'} />}
      />
      <div className="grid gap-3 p-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
          <div className="rounded-2xl border border-border/60 bg-background/48 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip icon={<ShieldCheck size={12} aria-hidden="true" />} label={`approval ${view.approval.state}`} tone={view.approval.state === 'valid' ? 'safe' : 'warning'} />
              <StatusChip icon={<AlertTriangle size={12} aria-hidden="true" />} label={view.killSwitch.active ? 'kill switch active' : 'kill switch clear'} tone={view.killSwitch.active ? 'danger' : 'safe'} />
              <StatusChip icon={<GitBranch size={12} aria-hidden="true" />} label={`rollback ${view.rollbackReadiness.state}`} tone={view.rollbackReadiness.state === 'ready' ? 'safe' : 'warning'} />
              <StatusChip icon={<Route size={12} aria-hidden="true" />} label={`writeback ${view.writebackHealth.state}`} tone={view.writebackHealth.state === 'converged' ? 'safe' : 'warning'} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {lanes.map(([label, count, tone]) => (
                <div key={label as string} className={`rounded-xl border px-2 py-2 text-center text-[0.667rem] ${toneClass(tone as Tone)}`}>
                  <div className="font-semibold text-foreground">{count as number}</div>
                  <div className="text-muted-foreground">{label as string}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/48 p-3">
            <div className="mb-2 text-[0.733rem] font-semibold text-foreground">Operator actions</div>
            <div className="space-y-1.5">
              {actions.map((action) => (
                <div key={action.id} className="flex min-w-0 items-center justify-between gap-2 text-[0.7rem]">
                  <span className="truncate text-foreground">{action.label}</span>
                  <StatusChip icon={<Activity size={12} aria-hidden="true" />} label={action.reason} tone={action.state === 'clear' ? 'safe' : action.state === 'blocked' ? 'danger' : 'warning'} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {routes.map((route) => (
            <div key={route.route} className="rounded-2xl border border-border/60 bg-background/48 px-3 py-2 text-[0.733rem]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-primary">{route.route}</span>
                <StatusChip icon={<Activity size={12} aria-hidden="true" />} label={route.state} tone={route.state === 'active' ? 'primary' : route.state === 'attention' ? 'warning' : 'muted'} />
              </div>
              <div className="mt-1 text-muted-foreground">{route.active} active / {route.recent} recent</div>
              <div className="truncate text-muted-foreground">{route.health}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CycleCard({ cycle }: { cycle: NonNullable<RunnerStatusReport['work']>['cycles'][number] }) {
  const tone: Tone = cycle.position === 'current'
    ? 'primary'
    : cycle.position === 'upcoming'
      ? 'warning'
      : cycle.position === 'past'
        ? 'muted'
        : 'muted';
  const activeOpen = cycle.active + cycle.review + cycle.todo + cycle.backlog;
  return (
    <div className="rounded-2xl border border-border/70 bg-background/52 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{cycle.name}</div>
          <div className="mt-1 truncate text-[0.733rem] text-muted-foreground">
            {cycle.startsAt ? formatObservedAt(cycle.startsAt) : 'no start'} to {cycle.endsAt ? formatObservedAt(cycle.endsAt) : 'no end'}
          </div>
        </div>
        <StatusChip icon={<BarChart3 size={12} aria-hidden="true" />} label={cycle.position} tone={tone} />
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-[0.633rem]">
        <div className="rounded-xl border border-border/60 bg-background/48 px-1.5 py-2">
          <div className="font-semibold text-foreground">{activeOpen}</div>
          <div className="text-muted-foreground">Open</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/48 px-1.5 py-2">
          <div className="font-semibold text-foreground">{cycle.active}</div>
          <div className="text-muted-foreground">Active</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/48 px-1.5 py-2">
          <div className="font-semibold text-foreground">{cycle.todo}</div>
          <div className="text-muted-foreground">Todo</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/48 px-1.5 py-2">
          <div className="font-semibold text-foreground">{cycle.backlog}</div>
          <div className="text-muted-foreground">Backlog</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/48 px-1.5 py-2">
          <div className="font-semibold text-foreground">{cycle.completed}</div>
          <div className="text-muted-foreground">Done</div>
        </div>
      </div>

      {cycle.items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {cycle.items.map((item) => (
            <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-background/35 px-2 py-1.5 text-[0.7rem]">
              <span className="shrink-0 font-mono font-semibold text-primary">{item.id}</span>
              {item.url ? (
                <a className="min-w-0 flex-1 truncate text-foreground hover:text-primary" href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
              )}
              <span className="shrink-0 text-muted-foreground">{item.state}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CycleVisibility({ cycles }: { cycles: NonNullable<RunnerStatusReport['work']>['cycles'] }) {
  return (
    <section className="shell-panel overflow-hidden rounded-[24px]">
      <SectionHeader
        icon={<BarChart3 size={12} className="text-primary" aria-hidden="true" />}
        kicker="Forward and backward"
        title="Linear cycle visibility"
      />
      <div className="grid gap-3 p-3">
        {cycles.length === 0 ? (
          <div className="cockpit-note text-sm">No Linear cycle data captured yet.</div>
        ) : (
          cycles.map((cycle) => <CycleCard key={cycle.id} cycle={cycle} />)
        )}
      </div>
    </section>
  );
}

function FlowSummary({ flow }: { flow: NonNullable<RunnerStatusReport['work']>['flow'] }) {
  if (flow.length === 0) {
    return <div className="cockpit-note m-3 text-sm">No runner execution history captured yet.</div>;
  }

  return (
    <div className="divide-y divide-border/50">
        {flow.map((item) => {
          return (
            <div key={item.date} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 px-3 py-3 text-[0.733rem]">
              <div className="min-w-0">
                <div className="font-mono font-semibold text-foreground">{item.date.slice(5)}</div>
                <div className="text-muted-foreground">{item.total} events</div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StatusChip icon={<Activity size={12} aria-hidden="true" />} label={`claimed ${item.claimed}`} tone={item.claimed ? 'primary' : 'muted'} />
                <StatusChip icon={<Zap size={12} aria-hidden="true" />} label={`launched ${item.launched}`} tone={item.launched ? 'primary' : 'muted'} />
                <StatusChip icon={<CheckCircle2 size={12} aria-hidden="true" />} label={`resolved ${item.review + item.blocked}`} tone={item.review + item.blocked ? 'safe' : 'muted'} />
                <StatusChip icon={<ListChecks size={12} aria-hidden="true" />} label={`validated ${item.validated}`} tone={item.validated ? 'safe' : 'muted'} />
              </div>
            </div>
          );
        })}
    </div>
  );
}

function RecentRunRow({ run }: { run: RunnerRunSummary }) {
  const tone = statusTone(run.status);
  return (
    <div className="border-b border-border/50 px-3 py-2.5 text-[0.733rem] last:border-b-0">
      <div className="grid grid-cols-[minmax(72px,0.8fr)_minmax(0,1.5fr)_minmax(64px,0.7fr)] items-center gap-2">
        <div className="min-w-0">
          <div className="font-mono font-semibold text-primary">{run.taskId}</div>
          <div className="truncate text-muted-foreground">{formatShortTime(run.updatedAt)}</div>
        </div>
        <div className="min-w-0">
          {run.url ? (
            <a className="inline-flex min-w-0 items-center gap-1.5 text-foreground hover:text-primary" href={run.url} target="_blank" rel="noreferrer">
              <span className="truncate">{run.title || run.workerRoute || 'worker completed'}</span>
              <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <div className="truncate text-foreground">{run.title || run.workerRoute || 'worker completed'}</div>
          )}
          <div className="truncate text-muted-foreground">{run.runId}</div>
        </div>
        <div className="justify-self-end">
          <StatusChip icon={<Clock3 size={12} aria-hidden="true" />} label={`${run.status} ${formatDuration(run.durationMs)}`} tone={tone} />
        </div>
      </div>
      <WorkerArtifactBlock artifact={run.artifact} compact />
    </div>
  );
}

function GateSummary({ report }: { report: RunnerStatusReport | null }) {
  const readiness = report?.liveReadiness?.live_readiness;
  const gates = readiness?.gate_chips || [];
  const passCount = gates.filter((gate) => gate.state === 'pass').length;
  const blocked = gates.filter((gate) => gate.state !== 'pass').slice(0, 4);

  return (
    <section className="shell-panel overflow-hidden rounded-[24px]">
      <SectionHeader
        icon={<ShieldCheck size={12} className="text-primary" aria-hidden="true" />}
        kicker="Readiness"
        title="Live activation blockers"
        aside={<StatusChip icon={<ListChecks size={12} aria-hidden="true" />} label={`${passCount}/${gates.length || 0} clear`} tone={blocked.length === 0 && gates.length > 0 ? 'safe' : 'warning'} />}
      />
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {blocked.length === 0 ? (
          <div className="cockpit-note sm:col-span-2 text-sm">
            {gates.length === 0 ? 'No readiness gate data observed.' : 'No live readiness blockers in the current report.'}
          </div>
        ) : (
          blocked.map((gate) => (
            <div key={gate.id} className="rounded-2xl border border-border/60 bg-background/48 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{gate.id.replace(/_/g, ' ')}</span>
                <StatusChip icon={<AlertTriangle size={12} aria-hidden="true" />} label={gate.state} tone={gate.state === 'blocked' ? 'danger' : 'warning'} />
              </div>
              {gate.why_blocked && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{gate.why_blocked}</div>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function WebhookQueueSummary({ report }: { report: RunnerStatusReport | null }) {
  const webhook = report?.webhookQueue;
  const consumerTone: Tone = webhook?.consumer.state === 'healthy'
    ? 'safe'
    : webhook?.consumer.state === 'blocked'
      ? 'danger'
      : webhook?.consumer.state === 'not_configured'
        ? 'muted'
        : 'warning';

  return (
    <section className="shell-panel overflow-hidden rounded-[24px]">
      <SectionHeader
        icon={<Route size={12} className="text-primary" aria-hidden="true" />}
        kicker="Webhook signals"
        title="Linear event queue"
        aside={<StatusChip icon={<ShieldCheck size={12} aria-hidden="true" />} label={webhook?.state.replace('_', ' ') || 'unknown'} tone={consumerTone} />}
      />
      {!webhook ? (
        <div className="cockpit-note m-3 text-sm">No webhook queue status captured.</div>
      ) : (
        <div className="grid gap-3 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <MetricTile icon={<Activity size={14} aria-hidden="true" />} label="Queue depth" value={webhook.queue.depth} caption={webhook.queue.lagSeconds === null ? 'lag unknown' : `${webhook.queue.lagSeconds}s lag`} tone={webhook.queue.depth > 0 ? 'warning' : 'safe'} />
            <MetricTile icon={<CheckCircle2 size={14} aria-hidden="true" />} label="Valid" value={webhook.counts.valid} caption={webhook.lastValidDelivery ? formatObservedAt(webhook.lastValidDelivery) : 'none observed'} tone={webhook.counts.valid > 0 ? 'safe' : 'muted'} />
            <MetricTile icon={<AlertTriangle size={14} aria-hidden="true" />} label="Rejected" value={webhook.counts.invalidSignature} caption={webhook.lastInvalidSignature ? formatObservedAt(webhook.lastInvalidSignature) : 'none observed'} tone={webhook.counts.invalidSignature > 0 ? 'danger' : 'safe'} />
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/48 px-3 py-2 text-[0.733rem] text-muted-foreground">
            <div className="font-medium text-foreground">{webhook.consumer.detail}</div>
            <div className="mt-1">Events are visibility signals only; this dashboard cannot replay events or authorise Runner mutation.</div>
          </div>
          {webhook.recent.length > 0 && (
            <div className="divide-y divide-border/50 rounded-2xl border border-border/60">
              {webhook.recent.slice(0, 4).map((event) => (
                <div key={`${event.observedAt}-${event.eventClass}-${event.issueKey || ''}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 px-3 py-2 text-[0.733rem]">
                  <div className="font-mono text-muted-foreground">{formatShortTime(event.observedAt)}</div>
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{event.issueKey ? `${event.issueKey} ` : ''}{event.eventClass}</div>
                    <div className="truncate text-muted-foreground">{event.state}{event.reason ? `: ${event.reason}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function RunnerPanel() {
  const { data, loading, error, refresh } = useRunnerStatus();
  const work = data?.work;
  const readiness = liveReadinessLabel(data);
  const items = work?.items || [];
  const queueItems = work?.queueItems || [];
  const cycles = work?.cycles || [];
  const primaryItems = items.slice(0, 10);
  const activeExecutions = work?.summary.activeExecutions ?? 0;
  const activeLinearIssues = work?.summary.activeLinearIssues ?? 0;
  const openLinearIssues = work?.summary.openLinearIssues ?? 0;
  const readyLinearIssues = work?.summary.readyLinearIssues ?? 0;
  const dorBlockedLinearIssues = work?.summary.dorBlockedLinearIssues ?? 0;
  const backlogLinearIssues = work?.summary.backlogLinearIssues ?? 0;
  const todoLinearIssues = work?.summary.todoLinearIssues ?? 0;
  const reviewRuns = work?.summary.reviewRuns ?? 0;
  const observedTasks = work?.summary.observedTasks ?? 0;
  const currentMode = data?.status?.mode || 'unknown';
  const forwardQueueTotal = Math.max(0, openLinearIssues - items.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="shrink-0 space-y-3 border-b border-border/50 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="cockpit-kicker">
              <Workflow size={14} className="text-primary" aria-hidden="true" />
              Runner dashboard
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">Runner control plane</h1>
              <StatusChip icon={<Activity size={12} aria-hidden="true" />} label={currentMode} tone={currentMode === 'disabled' || currentMode === 'report_only' ? 'safe' : 'warning'} />
              {data?.autonomy && <StatusChip icon={<Zap size={12} aria-hidden="true" />} label={data.autonomy.label} tone={data.autonomy.tone} />}
              <StatusChip icon={<ListChecks size={12} aria-hidden="true" />} label={readiness.label} tone={readiness.tone} />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            className="text-[0.733rem] uppercase"
            title="Refresh runner state now. Background refresh uses cached deterministic HTTP probes and no model tokens."
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{loading ? 'Refreshing' : 'Refresh'}</span>
          </Button>
        </div>

        {error && (
          <div className="cockpit-note px-3 py-2 text-[0.733rem]" data-tone="danger">
            {error}
          </div>
        )}

        <AutonomyBanner report={data} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              icon={<Activity size={14} aria-hidden="true" />}
              label="Open Linear"
              value={openLinearIssues}
              caption={`${observedTasks} issues observed`}
              tone={openLinearIssues > 0 ? 'warning' : 'safe'}
            />
            <MetricTile
              icon={<CheckCircle2 size={14} aria-hidden="true" />}
              label="Ready"
              value={readyLinearIssues}
              caption="No-HITL and complete DoR"
              tone={readyLinearIssues > 0 ? 'safe' : 'muted'}
            />
            <MetricTile
              icon={<AlertTriangle size={14} aria-hidden="true" />}
              label="Not ready"
              value={dorBlockedLinearIssues}
              caption="missing DoR/HITL metadata"
              tone={dorBlockedLinearIssues > 0 ? 'warning' : 'safe'}
            />
            <MetricTile
              icon={<Folder size={14} aria-hidden="true" />}
              label="Backlog"
              value={backlogLinearIssues}
              caption="not currently being worked"
              tone={backlogLinearIssues > 0 ? 'warning' : 'muted'}
            />
            <MetricTile
              icon={<ListChecks size={14} aria-hidden="true" />}
              label="Todo"
              value={todoLinearIssues}
              caption={`${activeLinearIssues} active in Linear`}
              tone={todoLinearIssues > 0 ? 'warning' : 'muted'}
            />
            <MetricTile
              icon={<Zap size={14} aria-hidden="true" />}
              label="Runner executing"
              value={activeExecutions}
              caption="claimed / launched / validating"
              tone={activeExecutions > 0 ? 'primary' : 'safe'}
            />
            <MetricTile
              icon={<CheckCircle2 size={14} aria-hidden="true" />}
              label="Awaiting decision"
              value={reviewRuns}
              caption="worker output not closed in Linear"
              tone={reviewRuns > 0 ? 'warning' : 'muted'}
            />
            <MetricTile
              icon={<Clock3 size={14} aria-hidden="true" />}
              label="Last runner event"
              value={formatShortTime(work?.summary.lastEventAt)}
              caption={work?.source.linear.ok ? 'Linear enriched' : work?.source.linear.error || 'Linear unavailable'}
              tone={work?.source.linear.ok ? 'safe' : 'warning'}
            />
          </div>

          <FullAutonomySurface report={data} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <section className="shell-panel min-w-0 overflow-hidden rounded-[24px]">
                <SectionHeader
                  icon={<Activity size={12} className="text-primary" aria-hidden="true" />}
                  kicker="Present tense"
                  title="What is being worked on now"
                  aside={<span className="font-mono text-[0.667rem] text-muted-foreground">{formatObservedAt(work?.observedAt || data?.observedAt)}</span>}
                />
                <div className="divide-y divide-border/50">
                  {primaryItems.length === 0 ? (
                    <div className="cockpit-note m-3 text-sm">No runner or Linear work is currently visible.</div>
                  ) : (
                    primaryItems.map((item) => <WorkItemRow key={item.id} item={item} />)
                  )}
                </div>
              </section>

              <section className="shell-panel min-w-0 overflow-hidden rounded-[24px]">
                <SectionHeader
                  icon={<ListChecks size={12} className="text-primary" aria-hidden="true" />}
                  kicker="Forward queue"
                  title="Open work not currently claimed"
                  aside={<span className="font-mono text-[0.667rem] text-muted-foreground">showing {queueItems.length} of {forwardQueueTotal}</span>}
                />
                <div className="divide-y divide-border/50">
                  {queueItems.length === 0 ? (
                    <div className="cockpit-note m-3 text-sm">No unclaimed open Linear work captured.</div>
                  ) : (
                    queueItems.map((item) => <WorkItemRow key={item.id} item={item} />)
                  )}
                </div>
              </section>
            </div>

            <aside className="flex min-w-0 flex-col gap-4">
              <section className="shell-panel overflow-hidden rounded-[24px]">
                <SectionHeader
                  icon={<Folder size={12} className="text-primary" aria-hidden="true" />}
                  kicker="Project rollup"
                  title="Grouped by Linear project"
                />
                <div className="grid gap-3 p-3">
                  {(work?.projects || []).length === 0 ? (
                    <div className="cockpit-note text-sm">No project data captured yet.</div>
                  ) : (
                    work?.projects.map((project) => <ProjectCard key={project.id} project={project} />)
                  )}
                </div>
              </section>
              <CycleVisibility cycles={cycles} />
              <WebhookQueueSummary report={data} />
            </aside>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)]">
            <section className="shell-panel min-w-0 overflow-hidden rounded-[24px]">
              <SectionHeader
                icon={<BarChart3 size={12} className="text-primary" aria-hidden="true" />}
                kicker="Execution history"
                title="Runner events by day"
              />
              <FlowSummary flow={work?.flow || []} />
            </section>

            <section className="shell-panel min-w-0 overflow-hidden rounded-[24px]">
              <SectionHeader
                icon={<Clock3 size={12} className="text-primary" aria-hidden="true" />}
                kicker="Recent outcomes"
                title="Completed worker activity"
              />
              <div className="divide-y divide-border/50">
                {(work?.recentRuns || []).length === 0 ? (
                  <div className="cockpit-note m-3 text-sm">No recent runner runs captured.</div>
                ) : (
                  work?.recentRuns.map((run) => <RecentRunRow key={run.runId} run={run} />)
                )}
              </div>
            </section>
          </div>

          <GateSummary report={data} />
        </div>
      </div>
    </div>
  );
}
