import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6 mx-auto">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-border-default bg-surface-card p-6"
      >
        <div className="space-y-4">
          <Input
            label="Username"
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

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
      </form>

      <p className="text-center text-xs text-content-tertiary">
        Don't have an account?{' '}
        <Link to="/register" className="text-accent hover:underline font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}
