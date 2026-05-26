import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  GitBranch,
  RefreshCw,
  Route,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import { useRunnerStatus, type RunnerStatusReport } from './useRunnerStatus';

function formatHead(head: string | null): string {
  return head ? head.slice(0, 12) : 'unknown';
}

function formatObservedAt(value?: string): string {
  if (!value) return 'not observed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function getPosture(report: RunnerStatusReport | null) {
  if (!report) return { label: 'Unknown', tone: 'muted' };
  if (!report.ok) return { label: 'Probe blocked', tone: 'warning' };
  if (report.status?.mode === 'disabled') return { label: 'Disabled / fail-closed', tone: 'safe' };
  if (report.status?.mode === 'report_only') return { label: 'Report-only', tone: 'safe' };
  return { label: report.status?.mode || 'Unknown mode', tone: 'warning' };
}

function toneClass(tone: string): string {
  if (tone === 'safe') return 'border-green/25 bg-green/10 text-green';
  if (tone === 'warning') return 'border-orange/25 bg-orange/10 text-orange';
  if (tone === 'danger') return 'border-destructive/25 bg-destructive/10 text-destructive';
  return 'border-border/70 bg-background/70 text-muted-foreground';
}

function StatTile({
  icon,
  label,
  value,
  tone = 'muted',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: 'safe' | 'warning' | 'danger' | 'muted';
}) {
  return (
    <div className="min-h-[92px] rounded-lg border border-border/70 bg-background/54 p-3">
      <div className="flex items-center gap-2 text-[0.667rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className={`inline-flex size-7 items-center justify-center rounded-md border ${toneClass(tone)}`}>
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
    <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2 last:border-b-0">
      <span className="min-w-0 text-sm text-foreground/86">{label}</span>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${ok ? toneClass('safe') : toneClass('danger')}`}>
        {ok ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
        {ok ? 'Clear' : 'Blocked'}
      </span>
    </div>
  );
}

export function RunnerPanel() {
  const { data, loading, error, refresh } = useRunnerStatus();
  const posture = getPosture(data);
  const dbHealth = data?.status?.db_health || data?.doctor?.db_health;
  const findings = data?.doctor?.findings || [];
  const commands = useMemo(() => Object.values(data?.commands || {}).filter(Boolean), [data?.commands]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold uppercase tracking-[0.18em] text-foreground">Runner</h1>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${toneClass(posture.tone)}`}>
                <ShieldCheck size={12} aria-hidden="true" />
                {posture.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Local runner status, doctor output, and safety posture from report-only probes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="shell-icon-button h-10 min-w-10 px-3"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span className="text-xs">{loading ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-orange/25 bg-orange/10 px-3 py-2 text-sm text-orange">
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Activity size={14} aria-hidden="true" />}
            label="Mode"
            value={data?.status?.mode || 'unknown'}
            tone={posture.tone === 'safe' ? 'safe' : 'warning'}
          />
          <StatTile
            icon={<Route size={14} aria-hidden="true" />}
            label="Route"
            value={data?.status?.route || 'unknown'}
            tone={data?.status?.route === 'none' ? 'safe' : 'warning'}
          />
          <StatTile
            icon={<Database size={14} aria-hidden="true" />}
            label="DB health"
            value={dbHealth?.status || 'unknown'}
            tone={dbHealth?.healthy ? 'safe' : 'warning'}
          />
          <StatTile
            icon={<GitBranch size={14} aria-hidden="true" />}
            label="Branch / head"
            value={`${data?.branch || 'unknown'} @ ${formatHead(data?.head || null)}`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
          <section className="rounded-lg border border-border/70 bg-card/45">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Safety gates</div>
              <div className="font-mono text-[0.667rem] text-muted-foreground">{formatObservedAt(data?.observedAt)}</div>
            </div>
            <SafetyRow label="Dashboard mutations" ok={(data?.safety.dashboardMutations ?? 0) === 0} />
            <SafetyRow label="Live dispatch from dashboard" ok={data?.safety.liveDispatchEnabled === false} />
            <SafetyRow label="Service install/start/restart from dashboard" ok={data?.safety.serviceMutationEnabled === false} />
            <SafetyRow label="Runner CLI mutations reported" ok={(data?.status?.mutations ?? 0) === 0 && (data?.doctor?.mutations ?? 0) === 0} />
            <SafetyRow label="Doctor findings" ok={findings.length === 0} />
          </section>

          <section className="rounded-lg border border-border/70 bg-card/45">
            <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Probe commands
            </div>
            <div className="divide-y divide-border/50">
              {commands.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">No probe commands have run.</div>
              ) : (
                commands.map((command, index) => (
                  <div key={`${command?.command.join(' ')}-${index}`} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex size-6 items-center justify-center rounded-md border ${toneClass(command?.ok ? 'safe' : 'danger')}`}>
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
        </div>

        <section className="rounded-lg border border-border/70 bg-card/45">
          <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Runner report
          </div>
          <div className="grid gap-0 divide-y divide-border/50 md:grid-cols-2 md:divide-x md:divide-y-0">
            <pre className="max-h-80 overflow-auto p-3 text-[0.733rem] leading-5 text-foreground/82">
              {JSON.stringify(data?.status || {}, null, 2)}
            </pre>
            <pre className="max-h-80 overflow-auto p-3 text-[0.733rem] leading-5 text-foreground/82">
              {JSON.stringify(data?.doctor || {}, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
