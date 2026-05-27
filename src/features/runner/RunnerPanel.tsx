import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Folder,
  ListChecks,
  RefreshCw,
  Route,
  ShieldCheck,
  Workflow,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRunnerStatus, type RunnerStatusReport, type RunnerWorkItem, type RunnerRunSummary } from './useRunnerStatus';

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

function readinessLabel(report: RunnerStatusReport | null): { label: string; tone: Tone } {
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
          </div>
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
    <div className="grid grid-cols-[minmax(72px,0.8fr)_minmax(0,1.5fr)_minmax(64px,0.7fr)] items-center gap-2 border-b border-border/50 px-3 py-2.5 text-[0.733rem] last:border-b-0">
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

export function RunnerPanel() {
  const { data, loading, error, refresh } = useRunnerStatus();
  const work = data?.work;
  const readiness = readinessLabel(data);
  const items = work?.items || [];
  const primaryItems = items.slice(0, 10);
  const activeExecutions = work?.summary.activeExecutions ?? 0;
  const activeLinearIssues = work?.summary.activeLinearIssues ?? 0;
  const reviewRuns = work?.summary.reviewRuns ?? 0;
  const observedTasks = work?.summary.observedTasks ?? 0;
  const currentMode = data?.status?.mode || 'unknown';

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
              <h1 className="text-lg font-semibold text-foreground">Active work</h1>
              <StatusChip icon={<Activity size={12} aria-hidden="true" />} label={currentMode} tone={currentMode === 'disabled' || currentMode === 'report_only' ? 'safe' : 'warning'} />
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              icon={<Activity size={14} aria-hidden="true" />}
              label="Active Linear"
              value={activeLinearIssues}
              caption={`${observedTasks} issues observed`}
              tone={activeLinearIssues > 0 ? 'primary' : 'muted'}
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
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
