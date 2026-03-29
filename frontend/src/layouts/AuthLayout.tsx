import { Outlet } from 'react-router-dom';
import GridwolfLogo from '@/components/shared/GridwolfLogo';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#7c3aed] opacity-[0.04] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#22d3ee] opacity-[0.03] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-border-default bg-bg-secondary p-8 shadow-2xl">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <GridwolfLogo size={56} />
          <h1 className="text-2xl font-bold tracking-wider text-gradient">
            GRIDWOLF
          </h1>
        </div>

        {/* Page content (login form, etc.) */}
        <Outlet />

        {/* Footer */}
        <p className="text-center text-xs text-content-tertiary">
          Passive OT Network Discovery & Vulnerability Intelligence
        </p>
      </div>
    </div>
  );
}

export default AuthLayout;
