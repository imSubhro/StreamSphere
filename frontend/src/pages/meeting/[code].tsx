import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { joinMeetingAPI, leaveMeetingAPI, getMeeting, getMeetingMessages } from '@/lib/api';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket';
import { getLocalStream, stopMediaStream, toggleAudio, toggleVideo, getScreenStream } from '@/lib/webrtc/MediaDevices';
import {
    createPeerConnection, createOffer, handleOffer, handleAnswer,
    handleIceCandidate, addStreamToPeer, PeerCallbacks,
} from '@/lib/webrtc/PeerConnection';
import { ChatMessage, PersistedChatMessage } from '@/types/meeting';

interface RemotePeer {
    socketId: string;
    userName: string;
    stream: MediaStream | null;
    pc: RTCPeerConnection;
    audioEnabled: boolean;
    videoEnabled: boolean;
}

interface Reaction {
    id: number;
    emoji: string;
    userName: string;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👏'];

// Deterministic avatar colors
const AVATAR_COLORS = [
    'linear-gradient(135deg, #4285f4, #34a853)',
    'linear-gradient(135deg, #ea4335, #fbbc04)',
    'linear-gradient(135deg, #7c3aed, #ec4899)',
    'linear-gradient(135deg, #00d4aa, #3b82f6)',
    'linear-gradient(135deg, #f97316, #ef4444)',
    'linear-gradient(135deg, #06b6d4, #8b5cf6)',
];
function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function MeetingRoom() {
    const router = useRouter();
    const { code } = router.query;
    const { user, loading } = useAuth();

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [chatOpen, setChatOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [participantCount, setParticipantCount] = useState(1);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [screenSharing, setScreenSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [reactions, setReactions] = useState<Reaction[]>([]);
    // Pin state: 'self' for own video, socketId for remote, null for grid mode
    const [pinnedId, setPinnedId] = useState<string | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const pipVideoRef = useRef<HTMLVideoElement>(null);
    const spotlightVideoRef = useRef<HTMLVideoElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const peersRef = useRef<Map<string, RemotePeer>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const meetingCode = typeof code === 'string' ? code : '';

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Unread tracking
    useEffect(() => {
        if (chatOpen) setUnreadCount(0);
    }, [chatOpen]);

    // Sync PiP video
    useEffect(() => {
        if (pipVideoRef.current && localStream) pipVideoRef.current.srcObject = localStream;
    }, [localStream, remotePeers.size]);

    // Sync spotlight video when pinned changes
    useEffect(() => {
        if (!spotlightVideoRef.current) return;
        if (pinnedId === 'self' && localStream) {
            spotlightVideoRef.current.srcObject = localStream;
        } else if (pinnedId) {
            const peer = peersRef.current.get(pinnedId);
            if (peer?.stream) spotlightVideoRef.current.srcObject = peer.stream;
        }
    }, [pinnedId, localStream, remotePeers]);

    // If pinned peer leaves, unpin
    useEffect(() => {
        if (pinnedId && pinnedId !== 'self' && !remotePeers.has(pinnedId)) {
            setPinnedId(null);
        }
    }, [pinnedId, remotePeers]);

    const makePeerCallbacks = useCallback((): PeerCallbacks => ({
        onTrack: (stream, socketId) => {
            setRemotePeers(prev => {
                const next = new Map(prev);
                const peer = next.get(socketId);
                if (peer) next.set(socketId, { ...peer, stream });
                return next;
            });
            const peer = peersRef.current.get(socketId);
            if (peer) peer.stream = stream;
        },
        onIceCandidate: (candidate, to) => {
            getSocket().emit('ice-candidate', { candidate, to });
        },
    }), []);

    // Main connection logic
    useEffect(() => {
        if (!meetingCode || !user || loading) return;
        let isMounted = true;

        async function init() {
            try {
                const data = await getMeeting(meetingCode);
                if (data.meeting) setMeetingTitle(data.meeting.title || '');
            } catch { /* meeting might not exist yet */ }

            try { await joinMeetingAPI(meetingCode); } catch { /* DB might be down */ }

            // Load persisted chat history
            try {
                const msgData = await getMeetingMessages(meetingCode);
                const history: ChatMessage[] = (msgData.messages || []).map((m: PersistedChatMessage) => ({
                    id: m.id,
                    userId: m.user_id,
                    userName: m.user?.username || 'User',
                    message: m.message,
                    timestamp: m.created_at,
                }));
                if (isMounted) setMessages(history);
            } catch { /* history unavailable — start fresh */ }

            let stream: MediaStream;
            try {
                stream = await getLocalStream();
            } catch {
                try { stream = await getLocalStream(true, false); } catch {
                    alert('Could not access camera or microphone.');
                    return;
                }
            }

            if (!isMounted) { stopMediaStream(stream); return; }
            setLocalStream(stream);
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            connectSocket();
            const socket = getSocket();

            const emitJoin = () => {
                socket.emit('join-room', {
                    roomId: meetingCode, userId: user!.id, userName: user!.username,
                });
            };

            socket.on('connect', () => { if (!isMounted) return; setIsConnected(true); emitJoin(); });
            if (socket.connected) { setIsConnected(true); emitJoin(); }

            socket.on('existing-participants', ({ participants }) => {
                participants.forEach(async (socketId: string) => {
                    const callbacks = makePeerCallbacks();
                    const pc = createPeerConnection(socketId, callbacks);
                    addStreamToPeer(pc, localStreamRef.current!);
                    const peer: RemotePeer = { socketId, userName: '', stream: null, pc, audioEnabled: true, videoEnabled: true };
                    peersRef.current.set(socketId, peer);
                    setRemotePeers(new Map(peersRef.current));
                    const offer = await createOffer(pc);
                    socket.emit('offer', { offer, to: socketId, userName: user!.username });
                });
            });

            socket.on('user-joined', ({ socketId, userName }) => {
                const callbacks = makePeerCallbacks();
                const pc = createPeerConnection(socketId, callbacks);
                addStreamToPeer(pc, localStreamRef.current!);
                const peer: RemotePeer = { socketId, userName, stream: null, pc, audioEnabled: true, videoEnabled: true };
                peersRef.current.set(socketId, peer);
                setRemotePeers(new Map(peersRef.current));
            });

            socket.on('offer', async ({ offer, from, userName }) => {
                let peer = peersRef.current.get(from);
                if (!peer) {
                    const callbacks = makePeerCallbacks();
                    const pc = createPeerConnection(from, callbacks);
                    addStreamToPeer(pc, localStreamRef.current!);
                    peer = { socketId: from, userName, stream: null, pc, audioEnabled: true, videoEnabled: true };
                    peersRef.current.set(from, peer);
                }
                if (userName) peer.userName = userName;
                const answer = await handleOffer(peer.pc, offer);
                socket.emit('answer', { answer, to: from });
                setRemotePeers(new Map(peersRef.current));
            });

            socket.on('answer', async ({ answer, from }) => {
                const peer = peersRef.current.get(from);
                if (peer) await handleAnswer(peer.pc, answer);
            });

            socket.on('ice-candidate', async ({ candidate, from }) => {
                const peer = peersRef.current.get(from);
                if (peer) await handleIceCandidate(peer.pc, candidate);
            });

            socket.on('user-left', ({ socketId }) => {
                const peer = peersRef.current.get(socketId);
                if (peer) {
                    peer.pc.close();
                    peersRef.current.delete(socketId);
                    setRemotePeers(new Map(peersRef.current));
                }
            });

            socket.on('participant-count', (count: number) => setParticipantCount(count));

            // Remote user media toggle notifications
            socket.on('user-toggled-media', ({ socketId, type, enabled }) => {
                setRemotePeers(prev => {
                    const peer = prev.get(socketId);
                    if (!peer) return prev;
                    const next = new Map(prev);
                    next.set(socketId, {
                        ...peer,
                        audioEnabled: type === 'audio' ? enabled : peer.audioEnabled,
                        videoEnabled: type === 'video' ? enabled : peer.videoEnabled,
                    });
                    return next;
                });
            });

            // Emoji reactions
            socket.on('reaction', ({ emoji, userName }) => {
                const id = Date.now() + Math.random();
                setReactions(prev => [...prev.slice(-4), { id, emoji, userName }]);
                setTimeout(() => {
                    setReactions(prev => prev.filter(r => r.id !== id));
                }, 2500);
            });

            socket.on('new-message', (msg: ChatMessage) => {
                setMessages(prev => [...prev, msg]);
                setChatOpen(prev => { if (!prev) setUnreadCount(c => c + 1); return prev; });
            });
        }

        init();

        return () => {
            isMounted = false;
            const socket = getSocket();
            socket.emit('leave-room', { roomId: meetingCode });
            socket.off('existing-participants'); socket.off('user-joined');
            socket.off('offer'); socket.off('answer');
            socket.off('ice-candidate'); socket.off('user-left');
            socket.off('participant-count'); socket.off('new-message');
            socket.off('user-toggled-media'); socket.off('reaction');
            peersRef.current.forEach(p => p.pc.close());
            peersRef.current.clear();
            if (localStreamRef.current) stopMediaStream(localStreamRef.current);
            leaveMeetingAPI(meetingCode).catch(() => { });
            disconnectSocket();
        };
    }, [meetingCode, user, loading, makePeerCallbacks]);

    // Toggle audio/video
    const handleToggleAudio = () => {
        if (localStream) {
            const next = !audioEnabled;
            toggleAudio(localStream, next);
            setAudioEnabled(next);
            getSocket().emit('toggle-media', { roomId: meetingCode, type: 'audio', enabled: next });
        }
    };
    const handleToggleVideo = () => {
        if (localStream) {
            const next = !videoEnabled;
            toggleVideo(localStream, next);
            setVideoEnabled(next);
            getSocket().emit('toggle-media', { roomId: meetingCode, type: 'video', enabled: next });
        }
    };

    // Screen sharing
    const handleScreenShare = async () => {
        if (screenSharing) {
            if (localStream) stopMediaStream(localStream);
            const stream = await getLocalStream();
            setLocalStream(stream); localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            const videoTrack = stream.getVideoTracks()[0];
            peersRef.current.forEach(peer => {
                const sender = peer.pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender && videoTrack) sender.replaceTrack(videoTrack);
            });
            setScreenSharing(false);
        } else {
            try {
                const screen = await getScreenStream();
                const videoTrack = screen.getVideoTracks()[0];
                if (localVideoRef.current) localVideoRef.current.srcObject = screen;
                peersRef.current.forEach(peer => {
                    const sender = peer.pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                });
                videoTrack.onended = () => handleScreenShare();
                setLocalStream(screen); localStreamRef.current = screen;
                setScreenSharing(true);
            } catch { /* cancelled */ }
        }
    };

    // Chat
    const sendMessage = () => {
        const msg = chatInput.trim();
        if (!msg || !user) return;
        getSocket().emit('send-message', {
            roomId: meetingCode, userId: user.id, userName: user.username, message: msg,
        });
        setChatInput('');
    };

    // Emoji reactions
    const sendReaction = (emoji: string) => {
        if (!user) return;
        getSocket().emit('send-reaction', { roomId: meetingCode, emoji, userName: user.username });
    };

    // Copy code
    const copyCode = () => {
        navigator.clipboard.writeText(meetingCode);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    };

    // Pin/Unpin
    const togglePin = (id: string) => {
        setPinnedId(prev => prev === id ? null : id);
    };

    const handleLeave = () => router.push('/dashboard');

    if (loading || !user) return <div className="center-loader"><div className="spinner" /></div>;

    const remotePeerArray = Array.from(remotePeers.values());
    const hasRemotePeers = remotePeerArray.length > 0;
    const gridCount = hasRemotePeers ? remotePeerArray.length : 1;
    const gridDataCount = gridCount <= 9 ? String(gridCount) : 'many';

    // Helper: render a video tile
    const renderTile = (
        id: string, name: string, stream: MediaStream | null,
        isSelf: boolean, opts: { showPin?: boolean; inFilmstrip?: boolean } = {}
    ) => (
        <div
            key={id}
            className={`video-tile ${isSelf && opts.inFilmstrip ? 'is-self' : ''}`}
            onClick={opts.inFilmstrip ? () => togglePin(id) : undefined}
        >
            {stream ? (
                <video
                    autoPlay playsInline muted={isSelf}
                    style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        transform: isSelf ? 'scaleX(-1)' : undefined,
                        display: isSelf && !videoEnabled ? 'none' : 'block',
                    }}
                    ref={(el) => { if (el) el.srcObject = stream; }}
                />
            ) : null}
            {(isSelf && !videoEnabled) || !stream ? (
                <div className="avatar-placeholder">
                    <div className="avatar-circle" style={{ background: getAvatarColor(name) }}>
                        {name[0]?.toUpperCase() || '?'}
                    </div>
                </div>
            ) : null}
            <div className="name-tag">
                <span className="icon">person</span>
                {name}{isSelf ? ' (You)' : ''}
            </div>
            {isSelf && !audioEnabled && !opts.inFilmstrip && (
                <div className="muted-indicator">
                    <span className="icon">mic_off</span>
                </div>
            )}
            {/* Pin button — only in grid mode, not filmstrip */}
            {opts.showPin && !opts.inFilmstrip && (
                <button
                    className={`pin-btn ${pinnedId === id ? 'is-pinned' : ''}`}
                    onClick={(e) => { e.stopPropagation(); togglePin(id); }}
                    title={pinnedId === id ? 'Unpin' : 'Pin'}
                    aria-label={pinnedId === id ? 'Unpin this video' : 'Pin this video'}
                >
                    <span className="icon">{pinnedId === id ? 'push_pin' : 'push_pin'}</span>
                </button>
            )}
        </div>
    );

    // Determine pinned participant info
    const pinnedPeer = pinnedId === 'self' ? null : remotePeerArray.find(p => p.socketId === pinnedId);
    const isPinActive = pinnedId !== null && (pinnedId === 'self' || pinnedPeer);

    return (
        <div className="meeting-page">
            <div className="meeting-main">
                {/* Top bar */}
                <div className="meeting-topbar">
                    <div className="meeting-info">
                        <h2 className="meeting-title">{meetingTitle || 'Meeting'}</h2>
                        <div className="meeting-meta">
                            <button className="meeting-code-chip" onClick={copyCode} title="Click to copy">
                                <span className="icon icon-sm">{copied ? 'check' : 'content_copy'}</span>
                                {copied ? 'Copied!' : meetingCode}
                            </button>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span className="icon icon-sm">group</span>
                                {participantCount}
                            </span>
                            {!isConnected && (
                                <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span className="icon icon-sm">sync</span> Connecting...
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="topbar-actions">
                        <button className="btn-danger" onClick={handleLeave}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="icon icon-sm">call_end</span> Leave
                        </button>
                    </div>
                </div>

                {/* Video area */}
                <div className="video-area">
                    {isPinActive ? (
                        /* ===== SPOTLIGHT + FILMSTRIP MODE ===== */
                        <div className="spotlight-layout">
                            {/* Spotlight — the pinned video */}
                            <div className="spotlight-main">
                                {pinnedId === 'self' ? (
                                    <>
                                        {videoEnabled ? (
                                            <video
                                                ref={spotlightVideoRef}
                                                autoPlay muted playsInline
                                                style={{ transform: 'scaleX(-1)' }}
                                            />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                <div className="avatar-circle"
                                                    style={{ background: getAvatarColor(user.username) }}>
                                                    {user.username[0].toUpperCase()}
                                                </div>
                                            </div>
                                        )}
                                        <div className="name-tag">
                                            <span className="icon">person</span>
                                            {user.username} (You)
                                        </div>
                                    </>
                                ) : pinnedPeer ? (
                                    <>
                                        {pinnedPeer.stream ? (
                                            <video
                                                ref={spotlightVideoRef}
                                                autoPlay playsInline
                                            />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                <div className="avatar-circle"
                                                    style={{ background: getAvatarColor(pinnedPeer.userName || '?') }}>
                                                    {(pinnedPeer.userName || '?')[0].toUpperCase()}
                                                </div>
                                            </div>
                                        )}
                                        <div className="name-tag">
                                            <span className="icon">person</span>
                                            {pinnedPeer.userName || 'Connecting...'}
                                        </div>
                                    </>
                                ) : null}

                                {/* Pinned badge */}
                                <div className="pinned-badge">
                                    <span className="icon">push_pin</span> Pinned
                                </div>

                                {/* Unpin button */}
                                <button className="unpin-btn" onClick={() => setPinnedId(null)}>
                                    <span className="icon">close</span> Unpin
                                </button>
                            </div>

                            {/* Filmstrip — everyone else in a horizontal row */}
                            <div className="filmstrip">
                                {/* Self tile in filmstrip (if not pinned) */}
                                {pinnedId !== 'self' && (
                                    <div className="video-tile is-self" onClick={() => togglePin('self')}>
                                        {videoEnabled && localStream ? (
                                            <video
                                                autoPlay muted playsInline
                                                style={{ transform: 'scaleX(-1)' }}
                                                ref={(el) => { if (el && localStream) el.srcObject = localStream; }}
                                            />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                <div className="avatar-circle"
                                                    style={{ background: getAvatarColor(user.username) }}>
                                                    {user.username[0].toUpperCase()}
                                                </div>
                                            </div>
                                        )}
                                        <div className="name-tag">You</div>
                                    </div>
                                )}

                                {/* Remote peers in filmstrip (except the pinned one) */}
                                {remotePeerArray
                                    .filter(p => p.socketId !== pinnedId)
                                    .map(peer => (
                                        <div key={peer.socketId} className="video-tile"
                                            onClick={() => togglePin(peer.socketId)}>
                                            {peer.stream && peer.videoEnabled !== false ? (
                                                <video
                                                    autoPlay playsInline
                                                    ref={(el) => { if (el && peer.stream) el.srcObject = peer.stream; }}
                                                />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    <div className="avatar-circle"
                                                        style={{ background: getAvatarColor(peer.userName || '?') }}>
                                                        {(peer.userName || '?')[0].toUpperCase()}
                                                    </div>
                                                </div>
                                            )}
                                            {peer.audioEnabled === false && (
                                                <div className="muted-indicator">
                                                    <span className="icon">mic_off</span>
                                                </div>
                                            )}
                                            <div className="name-tag">{peer.userName || '...'}</div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : (
                        /* ===== GRID MODE (no pin) ===== */
                        <>
                            <div className="video-grid" data-count={gridDataCount}>
                                {/* When alone: self in grid */}
                                {!hasRemotePeers && (
                                    <div className="video-tile">
                                        <video
                                            ref={localVideoRef}
                                            autoPlay muted playsInline
                                            style={{
                                                width: '100%', height: '100%', objectFit: 'cover',
                                                transform: 'scaleX(-1)',
                                                display: videoEnabled ? 'block' : 'none',
                                            }}
                                        />
                                        {!videoEnabled && (
                                            <div className="avatar-placeholder">
                                                <div className="avatar-circle"
                                                    style={{ background: getAvatarColor(user.username) }}>
                                                    {user.username[0].toUpperCase()}
                                                </div>
                                            </div>
                                        )}
                                        <div className="name-tag">
                                            <span className="icon">person</span>
                                            {user.username} (You)
                                        </div>
                                        {!audioEnabled && (
                                            <div className="muted-indicator">
                                                <span className="icon">mic_off</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Remote peers in grid */}
                                {remotePeerArray.map((peer) => (
                                    <div key={peer.socketId} className="video-tile">
                                        {peer.stream && peer.videoEnabled !== false ? (
                                            <video
                                                autoPlay playsInline
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                ref={(el) => { if (el && peer.stream) el.srcObject = peer.stream; }}
                                            />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                <div className="avatar-circle"
                                                    style={{ background: getAvatarColor(peer.userName || '?') }}>
                                                    {(peer.userName || '?')[0].toUpperCase()}
                                                </div>
                                            </div>
                                        )}
                                        <div className="name-tag">
                                            <span className="icon">person</span>
                                            {peer.userName || 'Connecting...'}
                                        </div>
                                        {peer.audioEnabled === false && (
                                            <div className="muted-indicator">
                                                <span className="icon">mic_off</span>
                                            </div>
                                        )}
                                        {/* Pin button */}
                                        <button
                                            className="pin-btn"
                                            onClick={() => togglePin(peer.socketId)}
                                            title="Pin this video"
                                            aria-label="Pin this video"
                                        >
                                            <span className="icon">push_pin</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Self PiP — only when others are present */}
                            {hasRemotePeers && (
                                <div className="self-view-pip" onClick={() => togglePin('self')}>
                                    {videoEnabled ? (
                                        <video ref={pipVideoRef} autoPlay muted playsInline />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            <div className="avatar-circle"
                                                style={{ background: getAvatarColor(user.username) }}>
                                                {user.username[0].toUpperCase()}
                                            </div>
                                        </div>
                                    )}
                                    <div className="name-tag">You</div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Controls bar */}
                <div className="controls-bar">
                    <button className={`ctrl-btn ${!audioEnabled ? 'off' : ''}`}
                        onClick={handleToggleAudio} aria-label={audioEnabled ? 'Mute' : 'Unmute'}>
                        <span className="icon">{audioEnabled ? 'mic' : 'mic_off'}</span>
                        <span className="label">{audioEnabled ? 'Mic' : 'Muted'}</span>
                    </button>
                    <button className={`ctrl-btn ${!videoEnabled ? 'off' : ''}`}
                        onClick={handleToggleVideo} aria-label={videoEnabled ? 'Camera off' : 'Camera on'}>
                        <span className="icon">{videoEnabled ? 'videocam' : 'videocam_off'}</span>
                        <span className="label">{videoEnabled ? 'Video' : 'Off'}</span>
                    </button>
                    <button className={`ctrl-btn ${screenSharing ? 'active-feature' : ''}`}
                        onClick={handleScreenShare} aria-label="Screen share">
                        <span className="icon">{screenSharing ? 'stop_screen_share' : 'present_to_all'}</span>
                        <span className="label">Present</span>
                    </button>
                    <button className={`ctrl-btn ${chatOpen ? 'active-feature' : ''}`}
                        onClick={() => setChatOpen(!chatOpen)} aria-label="Chat">
                        <span className="icon">chat</span>
                        <span className="label">Chat</span>
                        {unreadCount > 0 && !chatOpen && (
                            <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>
                    <div className="reaction-picker">
                        {QUICK_REACTIONS.map(emoji => (
                            <button key={emoji} className="ctrl-btn reaction-btn"
                                onClick={() => sendReaction(emoji)}
                                aria-label={`Send reaction ${emoji}`} title={`React ${emoji}`}>
                                <span className="label">{emoji}</span>
                            </button>
                        ))}
                    </div>
                    <button className="ctrl-btn" onClick={copyCode} aria-label="Copy code">
                        <span className="icon">{copied ? 'check' : 'content_copy'}</span>
                        <span className="label">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button className="ctrl-btn end-call" onClick={handleLeave} aria-label="Leave">
                        <span className="icon">call_end</span>
                        <span className="label">Leave</span>
                    </button>
                </div>
            </div>

            {/* Chat panel */}
            {chatOpen && (
                <div className="chat-panel fade-in">
                    <div className="chat-header">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="icon">chat</span> In-call messages
                        </span>
                        <button className="chat-close-btn" onClick={() => setChatOpen(false)} aria-label="Close chat">
                            <span className="icon">close</span>
                        </button>
                    </div>
                    <div className="chat-messages">
                        {messages.length === 0 && (
                            <div style={{
                                textAlign: 'center', padding: 'clamp(24px, 5vw, 40px)',
                                color: 'var(--text-muted)', fontSize: '0.85rem',
                            }}>
                                <span className="icon" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.3 }}>forum</span>
                                Messages can only be seen by people in the call.
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={msg.id || i} className="chat-bubble">
                                <div className="sender">{msg.userId === user.id ? 'You' : msg.userName}</div>
                                <div className="text">{msg.message}</div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="chat-input-area">
                        <input className="input-field" placeholder="Send a message..."
                            value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            style={{ flex: 1, padding: '10px 14px' }}
                        />
                        <button className="ctrl-btn active-feature" onClick={sendMessage}
                            disabled={!chatInput.trim()} aria-label="Send"
                            style={{ width: 44, height: 44, borderRadius: 12, opacity: chatInput.trim() ? 1 : 0.4 }}>
                            <span className="icon">send</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Reaction overlay */}
            {reactions.length > 0 && (
                <div className="reaction-overlay" aria-live="polite">
                    {reactions.map(r => (
                        <span key={r.id} className="reaction-float">
                            {r.emoji}
                            <span className="reaction-name">{r.userName}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
