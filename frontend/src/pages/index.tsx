import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const features = [
    { icon: 'videocam', title: 'HD Video Calls', desc: 'Peer-to-peer WebRTC for crystal-clear quality with no server middleman.', wide: true },
    { icon: 'link', title: 'Instant Codes', desc: 'Generate meeting codes like abc-defg-hij and share them in a click.', wide: true },
    { icon: 'chat', title: 'Live Chat', desc: 'Send messages and reactions during your call — all saved to history.' },
    { icon: 'present_to_all', title: 'Screen Sharing', desc: 'Present your screen with one click so everyone stays in sync.' },
    { icon: 'groups', title: 'Team Rooms', desc: 'Spin up a room and jump in whenever you and your team are ready.' },
    { icon: 'devices', title: 'Works Everywhere', desc: 'Runs right in the browser on desktop and mobile — no installs.' },
];

const steps = [
    { icon: 'add_circle', title: 'Create a meeting', desc: 'Generate an instant meeting code in a single click — no scheduling needed.' },
    { icon: 'share', title: 'Share the link', desc: 'Send the code to anyone. They join right from their browser, no downloads.' },
    { icon: 'forum', title: 'Talk, chat & share', desc: 'Turn on your camera, send reactions, or present your screen. It just works.' },
];

export default function LandingPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) router.replace('/dashboard');
    }, [user, loading, router]);

    if (loading) return <div className="center-loader"><div className="spinner" /></div>;

    return (
        <div className="page-container landing">
            <div className="aurora-bg" />
            <div className="landing-grid-bg" />

            {/* Navigation */}
            <header className="nav-bar landing-nav">
                <Link href="/" className="nav-logo">
                    <div className="nav-logo-icon">S</div>
                    <span className="nav-logo-text">StreamSphere</span>
                </Link>
                <div className="nav-actions">
                    <Link href="/login" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                        Log In
                    </Link>
                    <Link href="/register" className="btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                        Get Started
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <main>
                <section className="hero-section landing-hero">
                    <div className="slide-up landing-hero-inner">
                        <div className="hero-badge">
                            <span className="hero-badge-dot" />
                            Video meetings, reimagined
                        </div>

                        <h1 className="hero-title">
                            Meet in <span className="gradient-text">real time</span>
                            , from anywhere
                        </h1>

                        <p className="hero-desc">
                            Crystal-clear video calls with instant meeting codes.
                            No downloads, no friction — just click and connect.
                        </p>

                        <div className="hero-actions">
                            <Link href="/register" className="btn-primary btn-lg" style={{ textDecoration: 'none' }}>
                                Start Free
                            </Link>
                            <Link href="/login" className="btn-secondary btn-lg" style={{ textDecoration: 'none' }}>
                                Sign In
                            </Link>
                        </div>

                        <div className="hero-stats">
                            <div className="stat">
                                <span className="stat-value">4K</span>
                                <span className="stat-label">Video quality</span>
                            </div>
                            <span className="stat-divider" />
                            <div className="stat">
                                <span className="stat-value">1-click</span>
                                <span className="stat-label">Meeting join</span>
                            </div>
                            <span className="stat-divider" />
                            <div className="stat">
                                <span className="stat-value">0</span>
                                <span className="stat-label">Downloads needed</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="landing-features">
                    <div className="section-heading">
                        <span className="section-eyebrow">Features</span>
                        <h2 className="section-title">Everything you need to connect</h2>
                        <p className="section-sub">A premium meeting experience built for modern teams.</p>
                    </div>

                    <div className="bento-grid">
                        {features.map((f, i) => (
                            <div key={i} className={`glass-card bento-card${f.wide ? ' wide' : ''}`}>
                                <div className="feature-icon-box">
                                    <span className="icon">{f.icon}</span>
                                </div>
                                <h3 className="feature-title">{f.title}</h3>
                                <p className="feature-desc">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How it works */}
                <section className="landing-steps">
                    <div className="section-heading">
                        <span className="section-eyebrow">How it works</span>
                        <h2 className="section-title">Three steps to your next meeting</h2>
                        <p className="section-sub">Get everyone together in seconds, not minutes.</p>
                    </div>

                    <div className="steps-grid">
                        {steps.map((s, i) => (
                            <div key={i} className="glass-card step-card">
                                <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                                <div className="feature-icon-box step-icon">
                                    <span className="icon">{s.icon}</span>
                                </div>
                                <h3 className="step-title">{s.title}</h3>
                                <p className="step-desc">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="cta-band">
                    <h2 className="cta-title">Ready to start your next meeting?</h2>
                    <p className="cta-desc">Join thousands of teams already meeting in StreamSphere.</p>
                    <Link href="/register" className="btn-primary btn-lg" style={{ textDecoration: 'none' }}>
                        Start Free Now
                    </Link>
                </section>
            </main>

            <footer className="site-footer">
                Built with WebRTC + Socket.IO • StreamSphere © {new Date().getFullYear()}
            </footer>
        </div>
    );
}
