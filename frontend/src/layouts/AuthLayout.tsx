import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border-primary bg-bg-secondary p-8 shadow-2xl">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-blue/20">
            <Shield className="h-8 w-8 text-accent-blue" />
          </div>
          <h1 className="text-2xl font-bold tracking-wider text-text-primary">
            GRIDWOLF
          </h1>
        </div>

        {/* Page content (login form, etc.) */}
        <Outlet />

        {/* Footer */}
        <p className="text-center text-xs text-text-tertiary">
          Open-source security operations platform
        </p>
      </div>
    </div>
  );
}

export default AuthLayout;
