import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { registerUser } from '@/lib/api';
import Link from 'next/link';

export default function RegisterPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const data = await registerUser({ username, email, password });
            login(data.token, data.user);
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-container">
            <div className="aurora-bg" />
            <div className="auth-wrapper">
                <div className="glass-card auth-card slide-up">
                    <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 5vw, 36px)' }}>
                        <div className="nav-logo-icon" style={{
                            width: 48, height: 48, margin: '0 auto 16px',
                            fontSize: '1.3rem',
                        }}>S</div>
                        <h1 style={{ fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 700 }}>
                            Create account
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 'clamp(0.8rem, 2vw, 0.9rem)' }}>
                            Join StreamSphere to start your meetings
                        </p>
                    </div>

                    {error && <div className="error-box">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="input-label">Username</label>
                            <input type="text" className="input-field" placeholder="johndoe"
                                value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Email</label>
                            <input type="email" className="input-field" placeholder="you@example.com"
                                value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Password</label>
                            <input type="password" className="input-field" placeholder="Min 6 characters"
                                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
                        </div>

                        <button type="submit" className="btn-primary" disabled={isLoading}
                            style={{ width: '100%' }}>
                            {isLoading ? <span className="spinner" /> : 'Create Account'}
                        </button>
                    </form>

                    <p className="auth-footer">
                        Already have an account?{' '}
                        <Link href="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
