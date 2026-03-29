import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Zap } from 'lucide-react';
import GridwolfLogo from '@/components/shared/GridwolfLogo';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, demoLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid credentials. Try the demo login instead.');
    }
  };

  const handleDemoLogin = () => {
    demoLogin();
    navigate('/');
  };

  return (
    <div className="w-full max-w-sm space-y-6 mx-auto">
        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-border-default bg-surface-card p-6"
        >
          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="operator@gridwolf.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
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
