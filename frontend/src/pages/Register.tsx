import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, UserPlus, Eye, EyeOff, Check, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const ROLES = [
  { value: 'analyst', label: 'Security Analyst', description: 'Monitor and analyze OT/ICS security' },
  { value: 'engineer', label: 'OT Engineer', description: 'Manage industrial control systems' },
  { value: 'admin', label: 'Administrator', description: 'Full platform management access' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to dashboards' },
];

export default function Register() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState('analyst');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register: registerUser } = useAuthStore();
  const navigate = useNavigate();

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const isStep1Valid = fullName.trim().length > 0 && isEmailValid && organization.trim().length > 0;
  const isStep2Valid = passwordStrength === PASSWORD_RULES.length && passwordsMatch && agreedToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const rawUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
      const username = rawUsername.length >= 3 ? rawUsername : `user_${rawUsername}`;
      await registerUser({
        username,
        email,
        password,
        full_name: fullName,
      });
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const strengthColor =
    passwordStrength <= 2 ? 'bg-red-500' : passwordStrength <= 3 ? 'bg-amber-500' : passwordStrength <= 4 ? 'bg-blue-500' : 'bg-emerald-500';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-accent/15">
            <Shield className="h-8 w-8 text-accent" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-content-primary">Create Account</h1>
          <p className="mt-1 text-sm text-content-secondary">Passive ICS/SCADA Network Discovery</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-2">
          <div className="flex items-center gap-2 flex-1">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step >= 1 ? 'bg-accent text-white' : 'bg-surface-card text-content-tertiary border border-border-default'}`}>
              {step > 1 ? <Check size={14} /> : '1'}
            </div>
            <span className={`text-xs font-medium ${step >= 1 ? 'text-content-primary' : 'text-content-tertiary'}`}>Profile</span>
          </div>
          <div className={`h-px flex-1 ${step > 1 ? 'bg-accent' : 'bg-border-default'}`} />
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className={`text-xs font-medium ${step >= 2 ? 'text-content-primary' : 'text-content-tertiary'}`}>Security</span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step >= 2 ? 'bg-accent text-white' : 'bg-surface-card text-content-tertiary border border-border-default'}`}>
              2
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border-default bg-surface-card p-6">
          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Organization"
                type="text"
                placeholder="Acme Energy Corp"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                required
              />

              {/* Role selection */}
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-2">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`rounded-md border p-2.5 text-left transition-all ${
                        role === r.value
                          ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                          : 'border-border-default bg-bg-secondary hover:border-border-hover'
                      }`}
                    >
                      <span className={`block text-xs font-semibold ${role === r.value ? 'text-accent' : 'text-content-primary'}`}>
                        {r.label}
                      </span>
                      <span className="block text-[10px] text-content-tertiary mt-0.5">{r.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!isStep1Valid}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded border bg-bg-secondary text-content-primary placeholder:text-content-muted border-border-default hover:border-border-hover focus:outline-none focus:border-border-active focus:ring-1 focus:ring-accent/30 transition-colors duration-150 px-3 py-1.5 text-sm pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-primary"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= passwordStrength ? strengthColor : 'bg-border-default'}`} />
                      ))}
                    </div>
                    <div className="space-y-0.5">
                      {PASSWORD_RULES.map((rule) => {
                        const passed = rule.test(password);
                        return (
                          <div key={rule.label} className={`flex items-center gap-1.5 text-[10px] ${passed ? 'text-emerald-400' : 'text-content-tertiary'}`}>
                            {passed ? <Check size={10} /> : <X size={10} />}
                            {rule.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined}
                  required
                />
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border-default text-accent focus:ring-accent/30 bg-bg-secondary"
                />
                <span className="text-xs text-content-secondary group-hover:text-content-primary transition-colors">
                  I agree to the <span className="text-accent hover:underline cursor-pointer">Terms of Service</span> and{' '}
                  <span className="text-accent hover:underline cursor-pointer">Privacy Policy</span>, including ICS/OT data handling provisions.
                </span>
              </label>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isLoading}
                  icon={<UserPlus size={16} />}
                  className="flex-1"
                  disabled={!isStep2Valid}
                >
                  Create Account
                </Button>
              </div>
            </div>
          )}
        </form>

        {/* Login link */}
        <p className="text-center text-xs text-content-tertiary">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>

        <p className="text-center text-xs text-content-tertiary">Gridwolf v0.1.0</p>
      </div>
    </div>
  );
}
