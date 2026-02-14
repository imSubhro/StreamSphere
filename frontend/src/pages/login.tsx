import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { loginUser } from '@/lib/api';
import Link from 'next/link';

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const data = await loginUser({ email, password });
            login(data.token, data.user);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-container">
            <div className="aurora-bg" />
            <div className="auth-wrapper">
                <div className="glass-card auth-card slide-up">
                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 5vw, 36px)' }}>
                        <div className="nav-logo-icon" style={{
                            width: 48, height: 48, margin: '0 auto 16px',
                            fontSize: '1.3rem',
                        }}>S</div>
                        <h1 style={{ fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 700 }}>
                            Welcome back
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 'clamp(0.8rem, 2vw, 0.9rem)' }}>
                            Sign in to join your meetings
                        </p>
                    </div>

                    {error && <div className="error-box">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="input-label">Email</label>
                            <input type="email" className="input-field" placeholder="you@example.com"
                                value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Password</label>
                            <input type="password" className="input-field" placeholder="••••••••"
                                value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                        </div>

                        <button type="submit" className="btn-primary" disabled={isLoading}
                            style={{ width: '100%' }}>
                            {isLoading ? <span className="spinner" /> : 'Sign In'}
                        </button>
                    </form>

                    <p className="auth-footer">
                        Don&apos;t have an account?{' '}
                        <Link href="/register">Create one</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
