import { Outlet } from 'react-router-dom';
import GridwolfLogo from '@/components/shared/GridwolfLogo';
import ICSIllustration from '@/components/shared/ICSIllustration';

/**
 * Split-pane auth shell.
 *
 * Left pane (lg and up): decorative ICS illustration + tagline — sets the
 * tone of the product before the user has any credentials.
 * Right pane: the branded form card, fed by the matched child route.
 *
 * On screens narrower than `lg` the illustration collapses out of the flow
 * and the form takes the full width, so mobile logins stay clean.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* Ambient page glow (behind both panes) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-[#7c3aed] opacity-[0.06] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#22d3ee] opacity-[0.05] blur-[120px]" />
      </div>

      {/* ───────────── Left — Illustration pane ───────────── */}
      <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden border-r border-border-default bg-bg-secondary/40 px-10 py-12 lg:flex">
        {/* Faint grid backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            color: 'var(--content-secondary)',
          }}
        />

        <div className="relative flex w-full max-w-xl flex-col items-center">
          <ICSIllustration />

          <div className="mt-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-content-primary">
              Visibility into every ICS asset. Passively.
            </h2>
            <p className="mt-3 max-w-md text-sm text-content-secondary">
              Gridwolf discovers PLCs, drives, HMIs and sensors from the traffic
              they already emit — no active scans, no disruption, no agents.
            </p>

            {/* Animated status strip */}
            <div className="mt-6 flex items-center justify-center gap-6 text-[11px] uppercase tracking-widest text-content-tertiary">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
                Passive
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
                Real-time
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-glow" style={{ animationDelay: '0.8s' }} />
                Air-gap safe
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────── Right — Form pane ───────────── */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-10 lg:w-[520px] lg:flex-none lg:px-10">
        <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-border-default bg-bg-secondary p-8 shadow-2xl">
          {/* Branding */}
          <div className="flex flex-col items-center gap-3">
            <GridwolfLogo size={56} />
            <h1 className="text-2xl font-bold tracking-wider text-gradient">GRIDWOLF</h1>
          </div>

          {/* Page content (login form, etc.) */}
          <Outlet />

          {/* Footer */}
          <p className="text-center text-xs text-content-tertiary">
            Passive OT Network Discovery &amp; Vulnerability Intelligence
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
