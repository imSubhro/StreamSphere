import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function LandingPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) router.replace('/dashboard');
    }, [user, loading, router]);

    if (loading) return <div className="center-loader"><div className="spinner" /></div>;

    return (
        <div className="page-container">
            <div className="aurora-bg" />

            {/* Navigation */}
            <nav className="nav-bar">
                <div className="nav-logo">
                    <div className="nav-logo-icon">S</div>
                    <span className="nav-logo-text">StreamSphere</span>
                </div>
                <div className="nav-actions">
                    <Link href="/login" className="btn-secondary" style={{ padding: '10px 20px', textDecoration: 'none' }}>
                        Log In
                    </Link>
                    <Link href="/register" className="btn-primary" style={{ padding: '10px 20px', textDecoration: 'none' }}>
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <main className="hero-section">
                <div className="slide-up" style={{ maxWidth: 720, width: '100%' }}>
                    <div className="hero-badge">✨ Video meetings, reimagined</div>

                    <h1 className="hero-title">
                        Connect with your team in{' '}
                        <span className="gradient-text">real time</span>
                    </h1>

                    <p className="hero-desc">
                        Crystal-clear video calls with instant meeting codes.
                        No downloads, no friction — just click and connect.
                    </p>

                    <div className="hero-actions">
                        <Link href="/register" className="btn-primary" style={{ textDecoration: 'none', padding: '14px 32px' }}>
                            🚀 Start Free
                        </Link>
                        <Link href="/login" className="btn-secondary" style={{ textDecoration: 'none', padding: '14px 32px' }}>
                            Sign In →
                        </Link>
                    </div>
                </div>

                {/* Feature cards */}
                <div className="features-grid slide-up">
                    {[
                        { icon: '📹', title: 'HD Video Calls', desc: 'Peer-to-peer WebRTC for crystal-clear quality with no server middleman.' },
                        { icon: '🔗', title: 'Instant Codes', desc: 'Generate meeting codes like abc-defg-hij and share them in a click.' },
                        { icon: '💬', title: 'Live Chat', desc: 'Send messages and reactions during your call — all saved to history.' },
                    ].map((f, i) => (
                        <div key={i} className="glass-card feature-card">
                            <div className="feature-icon">{f.icon}</div>
                            <h3 className="feature-title">{f.title}</h3>
                            <p className="feature-desc">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="site-footer">
                Built with WebRTC + Socket.IO • StreamSphere © {new Date().getFullYear()}
            </footer>
        </div>
    );
}
