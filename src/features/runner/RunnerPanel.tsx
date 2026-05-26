import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  ListChecks,
  RefreshCw,
  Route,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRunnerStatus, type RunnerStatusReport } from './useRunnerStatus';

type Tone = 'safe' | 'warning' | 'danger' | 'muted';

function formatHead(head: string | null): string {
  return head ? head.slice(0, 12) : 'unknown';
}

function formatObservedAt(value?: string): string {
  if (!value) return 'not observed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function getModePosture(report: RunnerStatusReport | null): { label: string; tone: Tone } {
  if (!report) return { label: 'Unknown mode', tone: 'muted' };
  if (!report.ok) return { label: 'Probe blocked', tone: 'warning' };
  if (report.status?.mode === 'disabled') return { label: 'Disabled', tone: 'safe' };
  if (report.status?.mode === 'report_only') return { label: 'Report-only', tone: 'safe' };
  return { label: report.status?.mode || 'Unknown mode', tone: 'warning' };
}

function getReadinessPosture(report: RunnerStatusReport | null): { label: string; tone: Tone } {
  const readiness = report?.liveReadiness?.live_readiness;
  if (!readiness) return { label: 'Readiness unknown', tone: 'muted' };
  if (readiness.live_ready) return { label: 'Live ready', tone: 'safe' };
  if (readiness.status === 'blocked_live' || readiness.state === 'blocked_live') return { label: 'Blocked live', tone: 'danger' };
  return { label: readiness.status || readiness.state || 'Readiness blocked', tone: 'warning' };
}

function toneClass(tone: Tone | string): string {
  if (tone === 'safe') return 'border-green/25 bg-green/10 text-green';
  if (tone === 'warning') return 'border-orange/25 bg-orange/10 text-orange';
  if (tone === 'danger') return 'border-destructive/25 bg-destructive/10 text-destructive';
  return 'border-border/70 bg-background/70 text-muted-foreground';
}

function gateTone(state?: string): Tone {
  if (state === 'pass') return 'safe';
  if (state === 'blocked') return 'danger';
  if (state === 'warn' || state === 'warning') return 'warning';
  return 'muted';
}

function StatusChip({
  icon,
  label,
  tone,
}: {
  icon: ReactNode;
  label: string;
  tone: Tone;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.667rem] font-medium ${toneClass(tone)}`}>
      {icon}
      {label}
    </span>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone = 'muted',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="min-h-[104px] rounded-[24px] border border-border/70 bg-background/54 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-2 text-[0.667rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className={`inline-flex size-8 items-center justify-center rounded-xl border ${toneClass(tone)}`}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-3 break-words font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function SafetyRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 last:border-b-0">
      <span className="min-w-0 text-sm text-foreground/86">{label}</span>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${ok ? toneClass('safe') : toneClass('danger')}`}>
        {ok ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
        {ok ? 'Clear' : 'Blocked'}
      </span>
    </div>
  );
}

function AuthorityRow({
  label,
  status,
  source,
}: {
  label: string;
  status?: string;
  source?: string;
}) {
  const ok = status === 'pass';
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm text-foreground/86">{label.replace(/_/g, ' ')}</div>
        <div className="mt-0.5 truncate font-mono text-[0.667rem] text-muted-foreground">{source || 'not observed'}</div>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${toneClass(ok ? 'safe' : 'danger')}`}>
        {ok ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
        {status || 'unknown'}
      </span>
    </div>
  );
}

function GateCard({
  id,
  state,
  evidence,
  whyBlocked,
}: {
  id: string;
  state: string;
  evidence?: string;
  whyBlocked?: string;
}) {
  const tone = gateTone(state);
  return (
    <div className="min-h-[112px] rounded-[24px] border border-border/70 bg-background/52 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{id.replace(/_/g, ' ')}</div>
          <div className="mt-1 truncate font-mono text-[0.667rem] text-muted-foreground">{evidence || 'no evidence ref'}</div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${toneClass(tone)}`}>
          {tone === 'safe' ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
          {state || 'unknown'}
        </span>
      </div>
      {whyBlocked && (
        <div className="mt-3 text-xs leading-5 text-muted-foreground">{whyBlocked}</div>
      )}
    </div>
  );
}

export function RunnerPanel() {
  const { data, loading, error, refresh } = useRunnerStatus();
  const modePosture = getModePosture(data);
  const readinessPosture = getReadinessPosture(data);
  const dbHealth = data?.status?.db_health || data?.doctor?.db_health;
  const findings = data?.doctor?.findings || [];
  const readiness = data?.liveReadiness?.live_readiness;
  const gateChips = readiness?.gate_chips || [];
  const authorityVerifications = data?.authoritySnapshot?.authority_snapshot?.verifications || {};
  const authorityRows = Object.entries(authorityVerifications);
  const commands = useMemo(() => Object.values(data?.commands || {}).filter(Boolean), [data?.commands]);
  const dryRunClear = data?.scan?.dry_run === true
    && (data?.scan?.claims_created ?? 0) === 0
    && (data?.scan?.launches ?? 0) === 0
    && (data?.scan?.mutations ?? 0) === 0;

  return (
    <div className="flex-1 flex min-h-0 flex-col bg-background">
      <div className="shrink-0 space-y-3 border-b border-border/50 px-4 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0 space-y-2">
            <div className="cockpit-kicker">
              <ShieldCheck size={14} className="text-primary" aria-hidden="true" />
              Runner control plane
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-[-0.03em] text-foreground">Runner</h1>
              <StatusChip icon={<Activity size={12} aria-hidden="true" />} label={modePosture.label} tone={modePosture.tone} />
              <StatusChip icon={<ListChecks size={12} aria-hidden="true" />} label={readinessPosture.label} tone={readinessPosture.tone} />
              {typeof readiness?.blocker_count === 'number' && (
                <StatusChip
                  icon={<AlertTriangle size={12} aria-hidden="true" />}
                  label={`${readiness.blocker_count} blockers`}
                  tone={readiness.blocker_count === 0 ? 'safe' : 'warning'}
                />
              )}
            </div>
          </div>

          <div className="flex-1" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            className="text-[0.733rem] uppercase tracking-[0.16em]"
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

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              icon={<Activity size={14} aria-hidden="true" />}
              label="Mode"
              value={`${data?.status?.mode || 'unknown'} / ${data?.status?.route || 'unknown'}`}
              tone={modePosture.tone}
            />
            <SummaryTile
              icon={<FileCheck2 size={14} aria-hidden="true" />}
              label="Dry-run scan"
              value={`${data?.scan?.decision || 'unknown'} / ${dryRunClear ? 'zero mutations' : 'check output'}`}
              tone={dryRunClear ? 'safe' : 'warning'}
            />
            <SummaryTile
              icon={<Database size={14} aria-hidden="true" />}
              label="DB health"
              value={`${dbHealth?.status || 'unknown'} / ${data?.liveDbPath || 'no path'}`}
              tone={dbHealth?.healthy ? 'safe' : 'warning'}
            />
            <SummaryTile
              icon={<GitBranch size={14} aria-hidden="true" />}
              label="Branch / head"
              value={`${data?.branch || 'unknown'} @ ${formatHead(data?.head || readiness?.reviewed_git_head || null)}`}
            />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="cockpit-kicker text-[0.6rem]">
                  <ListChecks size={12} className="text-primary" aria-hidden="true" />
                  Readiness gates
                </div>
                {readiness?.next_required_action && (
                  <div className="mt-1 text-sm text-muted-foreground">{readiness.next_required_action}</div>
                )}
              </div>
              <div className="font-mono text-[0.667rem] text-muted-foreground">{formatObservedAt(data?.observedAt)}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {gateChips.length === 0 ? (
                <div className="cockpit-note md:col-span-2 xl:col-span-5">No readiness gate data observed.</div>
              ) : (
                gateChips.map((gate) => (
                  <GateCard
                    key={gate.id}
                    id={gate.id}
                    state={gate.state}
                    evidence={gate.evidence}
                    whyBlocked={gate.why_blocked}
                  />
                ))
              )}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(360px,1fr)]">
            <section className="shell-panel overflow-hidden rounded-[24px]">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-secondary/24 px-3 py-2.5">
                <div className="cockpit-kicker text-[0.6rem]">
                  <ShieldCheck size={12} className="text-primary" aria-hidden="true" />
                  Safety posture
                </div>
                <StatusChip
                  icon={<Route size={12} aria-hidden="true" />}
                  label={data?.status?.route || 'unknown'}
                  tone={data?.status?.route === 'none' ? 'safe' : 'warning'}
                />
              </div>
              <SafetyRow label="Dashboard mutations" ok={(data?.safety.dashboardMutations ?? 0) === 0} />
              <SafetyRow label="Live dispatch from dashboard" ok={data?.safety.liveDispatchEnabled === false} />
              <SafetyRow label="Service install/start/restart from dashboard" ok={data?.safety.serviceMutationEnabled === false} />
              <SafetyRow label="Runner CLI mutations reported" ok={(data?.status?.mutations ?? 0) === 0 && (data?.doctor?.mutations ?? 0) === 0 && (data?.scan?.mutations ?? 0) === 0} />
              <SafetyRow label="Doctor findings" ok={findings.length === 0} />
            </section>

            <section className="shell-panel overflow-hidden rounded-[24px]">
              <div className="border-b border-border/60 bg-secondary/24 px-3 py-2.5">
                <div className="cockpit-kicker text-[0.6rem]">
                  <ShieldCheck size={12} className="text-primary" aria-hidden="true" />
                  Authority snapshot
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {authorityRows.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">No authority snapshot observed.</div>
                ) : (
                  authorityRows.map(([key, value]) => (
                    <AuthorityRow
                      key={key}
                      label={key}
                      status={value.status}
                      source={value.source}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="shell-panel overflow-hidden rounded-[24px]">
            <div className="border-b border-border/60 bg-secondary/24 px-3 py-2.5">
              <div className="cockpit-kicker text-[0.6rem]">
                <TerminalSquare size={12} className="text-primary" aria-hidden="true" />
                Probe commands
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {commands.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">No probe commands have run.</div>
              ) : (
                commands.map((command, index) => (
                  <div key={`${command?.command.join(' ')}-${index}`} className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex size-7 items-center justify-center rounded-xl border ${toneClass(command?.ok ? 'safe' : 'danger')}`}>
                        <TerminalSquare size={12} aria-hidden="true" />
                      </span>
                      <code className="min-w-0 flex-1 truncate text-[0.733rem] text-foreground/88">
                        {command?.command.join(' ')}
                      </code>
                    </div>
                    {!command?.ok && (
                      <div className="mt-1 text-xs text-destructive">{command?.error || command?.stderr || 'Command failed'}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="shell-panel overflow-hidden rounded-[24px]">
            <div className="border-b border-border/60 bg-secondary/24 px-3 py-2.5">
              <div className="cockpit-kicker text-[0.6rem]">
                <FileCheck2 size={12} className="text-primary" aria-hidden="true" />
                Runner report
              </div>
            </div>
            <div className="grid gap-0 divide-y divide-border/50 xl:grid-cols-5 xl:divide-x xl:divide-y-0">
              <pre className="max-h-80 overflow-auto p-3 text-[0.733rem] leading-5 text-foreground/82">
                {JSON.stringify(data?.status || {}, null, 2)}
              </pre>
              <pre className="max-h-80 overflow-auto p-3 text-[0.733rem] leading-5 text-foreground/82">
                {JSON.stringify(data?.scan || {}, null, 2)}
              </pre>
              <pre className="max-h-80 overflow-auto p-3 text-[0.733rem] leading-5 text-foreground/82">
                {JSON.stringify(data?.doctor || {}, null, 2)}
              </pre>
              <pre className="max-h-80 overflow-auto p-3 text-[0.733rem] leading-5 text-foreground/82">
                {JSON.stringify(readiness || {}, null, 2)}
              </pre>
              <pre className="max-h-80 overflow-auto p-3 text-[0.733rem] leading-5 text-foreground/82">
                {JSON.stringify(data?.authoritySnapshot?.authority_snapshot || {}, null, 2)}
              </pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
