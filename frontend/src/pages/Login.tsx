import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Zap } from 'lucide-react';
import GridwolfLogo from '@/components/shared/GridwolfLogo';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, demoLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // In demo mode (GitHub Pages), always use demo login — no backend available
    if (isDemoMode) {
      demoLogin();
      navigate('/');
      return;
    }
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Invalid username or password.');
    }
  };

  const handleDemoLogin = () => {
    demoLogin();
    navigate('/');
  };

  return (
    <div className="w-full max-w-sm space-y-6 mx-auto">
        {/* Demo mode banner */}
        {isDemoMode && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
            <p className="text-xs font-semibold text-amber-400">Live Demo Mode</p>
            <p className="text-[11px] text-amber-400/80 mt-0.5">
              No backend required — click Demo Login or enter any credentials to explore.
            </p>
          </div>
        )}

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-border-default bg-surface-card p-6"
        >
          <div className="space-y-4">
            <Input
              label="Username"
              type="text"
              placeholder={isDemoMode ? 'Any username works in demo mode' : 'Enter username'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder={isDemoMode ? 'Any password works in demo mode' : 'Enter password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            icon={<LogIn size={16} />}
            className="w-full"
          >
            Sign In
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-default" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface-card px-2 text-content-tertiary">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            icon={<Zap size={16} />}
            className="w-full"
            onClick={handleDemoLogin}
          >
            Demo Login
          </Button>
        </form>

        <p className="text-center text-xs text-content-tertiary">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent hover:underline font-medium">
            Create one
          </Link>
        </p>

        <p className="text-center text-xs text-content-tertiary">
          Gridwolf v0.1.0
        </p>
    </div>
  );
}
