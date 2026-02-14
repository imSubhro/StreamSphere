import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { createMeeting, listMeetings } from '@/lib/api';
import { Meeting } from '@/types/meeting';

export default function DashboardPage() {
    const { user, logout, loading } = useAuth();
    const router = useRouter();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [joinCode, setJoinCode] = useState('');
    const [creating, setCreating] = useState(false);
    const [loadingMeetings, setLoadingMeetings] = useState(true);
    const [fetchError, setFetchError] = useState('');

    useEffect(() => {
        if (!loading && !user) router.replace('/login');
    }, [user, loading, router]);

    const fetchMeetings = () => {
        if (!user) return;
        setLoadingMeetings(true);
        setFetchError('');
        listMeetings()
            .then((data) => {
                console.log('[Dashboard] Meetings response:', data);
                setMeetings(data.meetings || []);
            })
            .catch((err) => {
                console.error('[Dashboard] Failed to fetch meetings:', err);
                setFetchError('Could not load meetings. Check your connection.');
                setMeetings([]);
            })
            .finally(() => setLoadingMeetings(false));
    };

    useEffect(() => {
        fetchMeetings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const handleCreate = async () => {
        setCreating(true);
        try {
            const data = await createMeeting();
            router.push(`/meeting/${data.meeting.meeting_code}`);
        } catch {
            alert('Failed to create meeting. Is the database connected?');
        } finally {
            setCreating(false);
        }
    };

    const handleJoin = () => {
        const code = joinCode.trim().toLowerCase();
        if (code) router.push(`/meeting/${code}`);
    };

    if (loading || !user) return <div className="center-loader"><div className="spinner" /></div>;

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'active';
            case 'SCHEDULED': return 'scheduled';
            default: return 'ended';
        }
    };

    return (
        <div className="page-container">
            <div className="aurora-bg" />

            {/* Top bar */}
            <nav className="nav-bar" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="nav-logo">
                    <div className="nav-logo-icon" style={{ width: 32, height: 32, fontSize: '0.85rem' }}>S</div>
                    <span className="nav-logo-text">StreamSphere</span>
                </div>
                <div className="nav-actions">
                    <span style={{
                        color: 'var(--text-secondary)',
                        fontSize: 'clamp(0.75rem, 2vw, 0.9rem)',
                        display: 'none',
                    }} className="username-desktop">
                        👋 {user.username}
                    </span>
                    <button onClick={logout} className="btn-secondary" style={{ padding: '8px 16px', minHeight: 40, fontSize: '0.85rem' }}>
                        Sign Out
                    </button>
                </div>
            </nav>

            {/* Main content */}
            <main className="dashboard-content">
                <div className="slide-up">
                    <h1 className="dashboard-heading">
                        Hey, {user.username}! 👋
                    </h1>
                    <p className="dashboard-subtext">
                        Create a new meeting or join an existing one
                    </p>
                </div>

                {/* Action cards */}
                <div className="action-cards">
                    <div className="glass-card action-card">
                        <div className="action-card-icon">🎥</div>
                        <h3 className="action-card-title">New Meeting</h3>
                        <p className="action-card-desc">
                            Start an instant video meeting and share the code
                        </p>
                        <button onClick={handleCreate} className="btn-primary" disabled={creating}
                            style={{ width: '100%' }}>
                            {creating ? <span className="spinner" /> : '+ Create Meeting'}
                        </button>
                    </div>

                    <div className="glass-card action-card">
                        <div className="action-card-icon">🔗</div>
                        <h3 className="action-card-title">Join Meeting</h3>
                        <p className="action-card-desc">
                            Enter a meeting code to join an existing call
                        </p>
                        <div className="join-row">
                            <input
                                className="input-field"
                                placeholder="abc-defg-hij"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                            />
                            <button onClick={handleJoin} className="btn-primary" disabled={!joinCode.trim()}
                                style={{ flexShrink: 0 }}>
                                Join
                            </button>
                        </div>
                    </div>
                </div>

                {/* Meeting history */}
                <div className="fade-in">
                    <h2 style={{
                        fontSize: 'clamp(1.1rem, 3vw, 1.3rem)',
                        fontWeight: 600,
                        marginBottom: 'clamp(14px, 3vw, 20px)',
                    }}>
                        📋 Recent Meetings
                    </h2>

                    {loadingMeetings ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                            <div className="spinner" />
                        </div>
                    ) : fetchError ? (
                        <div className="glass-card empty-state">
                            <div className="empty-state-icon">⚠️</div>
                            <p style={{ marginBottom: 16 }}>{fetchError}</p>
                            <button className="btn-secondary" onClick={fetchMeetings} style={{ margin: '0 auto' }}>
                                Retry
                            </button>
                        </div>
                    ) : meetings.length === 0 ? (
                        <div className="glass-card empty-state">
                            <div className="empty-state-icon">📭</div>
                            <p>No meetings yet. Create your first one!</p>
                        </div>
                    ) : (
                        <div className="meeting-list">
                            {meetings.map((m) => {
                                const isEnded = m.status === 'ENDED';
                                return (
                                    <div key={m.id}
                                        className="glass-card meeting-list-item"
                                        onClick={isEnded ? undefined : () => router.push(`/meeting/${m.meeting_code}`)}
                                        style={{
                                            cursor: isEnded ? 'default' : 'pointer',
                                            opacity: isEnded ? 0.5 : 1,
                                        }}
                                        title={isEnded ? 'This meeting has ended' : 'Click to join'}
                                    >
                                        <div className="meeting-list-info">
                                            <div className="meeting-list-title">
                                                {m.title || 'Untitled Meeting'}
                                            </div>
                                            <div className="meeting-list-meta">
                                                <span className="meeting-code">{m.meeting_code}</span>
                                                <span>{new Date(m.created_at).toLocaleDateString()}</span>
                                                {isEnded && (
                                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                        • Meeting ended
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`status-badge ${getStatusClass(m.status)}`}>
                                            {m.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
