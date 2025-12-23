import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useAuth } from '@/context/AuthContext'

export default function StreamRoom() {
    const router = useRouter()
    const { id: roomId } = router.query
    const { user, token } = useAuth()

    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [passwordInput, setPasswordInput] = useState('')
    const [authError, setAuthError] = useState('')
    const [hasPassword, setHasPassword] = useState(false)

    const [guestName, setGuestName] = useState<string | null>(null);
    useEffect(() => {
        setGuestName(localStorage.getItem('username'));
    }, []);

    // Pass token to hook for socket auth
    const {
        socket,
        localStream,
        remoteStreams,
        localVideoRef,
        stopStream,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        peerMediaStates
    } = useWebRTC(roomId as string, isAuthorized, token, guestName)

    const [message, setMessage] = useState('')
    const [messages, setMessages] = useState<{ user: string, message: string, id?: string }[]>([])
    const [pinnedUser, setPinnedUser] = useState<string | null>(null)
    const [pinnedChatMessage, setPinnedChatMessage] = useState<{ user: string, message: string } | null>(null)
    const [showChat, setShowChat] = useState(false) // Default hidden on mobile, will adjust in useEffect
    const chatEndRef = useRef<HTMLDivElement>(null)

    // New features state
    const [viewerCount, setViewerCount] = useState(0)
    const [reactions, setReactions] = useState<{ id: string, emoji: string, x: number }[]>([])

    // Set initial chat state based on screen size
    useEffect(() => {
        if (window.innerWidth >= 768) {
            setShowChat(true)
        }
    }, [])

    // Check room status on mount
    useEffect(() => {
        if (!roomId) return;

        const checkRoom = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/check-room/${roomId}`);
                if (res.status === 404) {
                    // Stream not found in DB, but allow joining as ad-hoc P2P room
                    console.warn('Stream not active, joining as ad-hoc room');
                    setIsAuthorized(true);
                    setIsLoading(false);
                    return;
                }
                const data = await res.json();
                if (data.hasPassword) {
                    setHasPassword(true);
                    setIsLoading(false);
                } else {
                    setIsAuthorized(true);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Error checking room:", err);
                // On error, allow join (fail open) or handle gracefully
                setIsAuthorized(true);
                setIsLoading(false);
            }
        };

        checkRoom();
    }, [roomId, router]);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/validate-room`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ streamId: roomId, password: passwordInput })
            });

            if (res.ok) {
                setIsAuthorized(true);
                setAuthError('');
            } else {
                setAuthError('Incorrect password');
            }
        } catch (err) {
            setAuthError('Validation failed');
        }
    };

    const leaveRoom = () => {
        stopStream()
        router.push('/')
    }



    useEffect(() => {
        if (!socket) return

        socket.on('chat-message', (data) => {
            setMessages(prev => [...prev, data])
        })

        socket.on('message-pinned', (msg) => {
            setPinnedChatMessage(msg)
        })

        socket.on('message-unpinned', () => {
            setPinnedChatMessage(null)
        })

        socket.on('error', (data: any) => {
            alert(data.message);
        });

        // Viewer count updates
        socket.on('viewer-count-update', (count: number) => {
            setViewerCount(count);
        });

        // Emoji reactions
        socket.on('reaction', (data: { emoji: string, userId: string }) => {
            const reactionId = `${data.userId}-${Date.now()}`;
            const randomX = Math.random() * 80 + 10; // Random position between 10% and 90%

            setReactions(prev => [...prev, { id: reactionId, emoji: data.emoji, x: randomX }]);

            // Remove reaction after animation (3 seconds)
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== reactionId));
            }, 3000);
        });

        return () => {
            socket.off('chat-message')
            socket.off('message-pinned')
            socket.off('message-unpinned')
            socket.off('error')
            socket.off('viewer-count-update')
            socket.off('reaction')
        }
    }, [socket])

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault()
        if (message.trim() && socket) {
            // Username is now handled by backend via token, but we send it for optimistic UI if needed
            // Actually backend overrides 'user' with token data, so we just send message
            socket.emit('chat-message', { message, streamId: roomId })
            setMessage('')
        }
    }

    const pinMessage = (msg: { user: string, message: string }) => {
        if (socket) {
            socket.emit('pin-message', { streamId: roomId, message: msg })
        }
    }

    const unpinMessage = () => {
        if (socket) {
            socket.emit('unpin-message', { streamId: roomId })
        }
    }

    const sendReaction = (emoji: string) => {
        if (socket) {
            socket.emit('send-reaction', { streamId: roomId, emoji })
        }
    }

    // Helper to render a video tile
    const renderVideoTile = (stream: MediaStream | null, isLocal: boolean, peerId: string, isPinned: boolean = false) => {
        const isVideoOn = isLocal ? isVideoEnabled : (peerMediaStates[peerId]?.video !== false);
        const label = isLocal ? 'You' : `User ${peerId.substr(0, 5)}`;

        return (
            <div className={`relative bg-black rounded-xl overflow-hidden border-2 ${isPinned ? 'border-yellow-500' : 'border-purple-500'} group ${isPinned ? 'w-full h-full' : 'aspect-video'}`}>
                {isLocal ? (
                    <>
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            onLoadedMetadata={(e) => {
                                // Ensure video plays when metadata is loaded
                                const video = e.currentTarget;
                                video.play().catch(err => console.error('Local video play failed:', err));
                            }}
                            className={`w-full h-full object-cover ${!isVideoOn ? 'hidden' : ''}`}
                        />
                        {!isVideoOn && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-gray-400">{label.charAt(0)}</span>
                                </div>
                            </div>
                        )}
                        {/* Quality Indicator (Local) */}
                        <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] text-green-400 font-mono z-10 flex gap-2">
                            <span>720p</span>
                            <span>30fps</span>
                            <span>2.5 Mbps</span>
                        </div>
                    </>
                ) : (
                    isVideoOn && stream ? (
                        <VideoPlayer stream={stream as MediaStream} />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                                <span className="text-2xl font-bold text-gray-400">{label.charAt(0)}</span>
                            </div>
                        </div>
                    )
                )}

                {/* Label */}
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-sm z-10">
                    {label} {isLocal && '(Me)'}
                </div>

                {/* Controls Overlay */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {!isLocal && (
                        <button
                            onClick={() => setPinnedUser(pinnedUser === peerId ? null : peerId)}
                            className="p-2 bg-black/60 rounded-full hover:bg-black/80 text-white"
                            title={pinnedUser === peerId ? "Unpin" : "Pin"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="17" x2="12" y2="22"></line>
                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                            </svg>
                        </button>
                    )}
                </div>

                {/* Local Controls (Only for local user) */}
                {isLocal && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 bg-black/60 px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                            onClick={toggleAudio}
                            className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
                            title={isAudioEnabled ? "Mute Mic" : "Unmute Mic"}
                        >
                            {isAudioEnabled ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                            )}
                        </button>
                        <button
                            onClick={toggleVideo}
                            className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
                            title={isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
                        >
                            {isVideoEnabled ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                            )}
                        </button>
                        <button
                            onClick={toggleScreenShare}
                            className={`p-3 rounded-full transition-colors ${isScreenSharing ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                            title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                        >
                            {isScreenSharing ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /><line x1="7" y1="8" x2="17" y2="16" /><line x1="17" y1="8" x2="7" y2="16" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                            )}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
                <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
                    <h2 className="text-2xl font-bold mb-6 text-center text-purple-400">Locked Room</h2>
                    <p className="text-gray-400 text-center mb-6">This stream is protected. Please enter the password to join.</p>
                    <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                        <input
                            type="password"
                            placeholder="Enter Password"
                            className="bg-gray-700 p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none text-white"
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value)}
                            autoFocus
                        />
                        {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
                        <button type="submit" className="bg-purple-600 p-3 rounded-lg font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-500/20">
                            Unlock & Join
                        </button>
                    </form>
                    <button onClick={() => router.push('/')} className="mt-4 text-gray-500 hover:text-gray-300 w-full text-center text-sm">
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row h-screen bg-gray-950 text-white overflow-hidden font-sans">
            {/* Main Video Area */}
            <div className="flex-1 flex flex-col p-2 md:p-4 gap-2 md:gap-4 bg-gradient-to-br from-gray-900 to-black min-h-0">
                <header className="flex justify-between items-center p-3 md:p-4 bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700/50 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                        <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 flex items-center gap-2">
                            <span className="hidden md:inline">Stream Room:</span>
                            <span className="md:hidden">Room:</span>
                            <span className="text-white font-medium max-w-[100px] md:max-w-none truncate">{roomId}</span>
                        </h1>
                        {/* Viewer Count */}
                        <div className="flex items-center gap-1.5 bg-gray-900/50 px-3 py-1.5 rounded-full border border-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <span className="text-sm font-semibold text-gray-300">{viewerCount}</span>
                        </div>
                    </div>
                    <button
                        onClick={leaveRoom}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 hover:border-red-500 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        Leave
                    </button>
                </header>

                <div className="flex-1 overflow-hidden relative rounded-2xl bg-gray-900/30 border border-gray-800">
                    {pinnedUser ? (
                        // Pinned View
                        <div className="flex flex-col md:flex-row h-full gap-2 md:gap-4 p-2 md:p-4">
                            {/* Main Stage */}
                            <div className="flex-1 h-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                                {pinnedUser === 'local' ?
                                    renderVideoTile(localStream, true, 'local', true) :
                                    renderVideoTile(remoteStreams[pinnedUser], false, pinnedUser, true)
                                }
                            </div>
                            {/* Sidebar List */}
                            <div className="w-full md:w-64 h-32 md:h-auto flex flex-row md:flex-col gap-2 md:gap-4 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden pr-2 custom-scrollbar shrink-0">
                                {pinnedUser !== 'local' && (
                                    <div className="w-40 md:w-full h-full md:h-40 shrink-0">
                                        {renderVideoTile(localStream, true, 'local')}
                                    </div>
                                )}
                                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                                    peerId !== pinnedUser && (
                                        <div key={peerId} className="w-40 md:w-full h-full md:h-40 shrink-0">
                                            {renderVideoTile(stream as MediaStream, false, peerId)}
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    ) : (
                        // Grid View
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 h-full overflow-y-auto content-start p-2 md:p-4">
                            <div className="aspect-video">
                                {renderVideoTile(localStream, true, 'local')}
                            </div>
                            {Object.entries(remoteStreams).map(([peerId, stream]) => (
                                <div key={peerId} className="aspect-video">
                                    {renderVideoTile(stream as MediaStream, false, peerId)}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Floating Emoji Reactions */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {reactions.map((reaction) => (
                            <div
                                key={reaction.id}
                                className="absolute bottom-0 animate-float-up"
                                style={{
                                    left: `${reaction.x}%`,
                                    animationDuration: '3s'
                                }}
                            >
                                <span className="text-4xl">{reaction.emoji}</span>
                            </div>
                        ))}
                    </div>

                    {/* Reaction Buttons - Mobile Responsive */}
                    <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 flex gap-1.5 md:gap-2 z-20">
                        {['❤️', '👍', '😂', '😮', '🔥'].map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => sendReaction(emoji)}
                                className="w-10 h-10 md:w-12 md:h-12 bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-sm rounded-full flex items-center justify-center text-xl md:text-2xl transition-all hover:scale-110 active:scale-95 border border-gray-700 shadow-lg"
                                title={`Send ${emoji}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chat Sidebar / Floating Overlay */}
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setShowChat(!showChat)}
                className="md:hidden fixed bottom-4 right-4 z-50 p-4 bg-purple-600 rounded-full shadow-2xl text-white hover:bg-purple-500 transition-all active:scale-95"
            >
                {showChat ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                )}
            </button>

            {/* Chat Container */}
            <div className={`
                fixed inset-0 md:static md:inset-auto
                w-full md:w-80 
                bg-gray-900/95 md:bg-gray-900 
                backdrop-blur-sm md:backdrop-blur-none
                border-t md:border-t-0 md:border-l border-gray-800 
                flex flex-col shadow-2xl z-40 shrink-0
                transition-transform duration-300 ease-in-out
                ${showChat ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
            `}>
                {/* Mobile Header to Close */}
                <div className="md:hidden p-4 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="font-bold text-gray-100">Live Chat</h2>
                    <button onClick={() => setShowChat(false)} className="text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                {/* Chat Header */}
                <div className="p-5 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-100">Live Chat</h2>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            Online
                        </p>
                    </div>
                </div>

                {/* Pinned Message Banner */}
                {pinnedChatMessage && (
                    <div className="bg-purple-900/50 border-b border-purple-500/30 p-3 flex justify-between items-start gap-2 backdrop-blur-sm">
                        <div className="flex flex-col gap-1 text-sm">
                            <span className="font-bold text-purple-300 text-xs uppercase tracking-wider">Pinned Message</span>
                            <div className="flex gap-2 items-baseline">
                                <span className="font-semibold text-white">{pinnedChatMessage.user}:</span>
                                <span className="text-gray-200">{pinnedChatMessage.message}</span>
                            </div>
                        </div>
                        <button
                            onClick={unpinMessage}
                            className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded"
                            title="Unpin message"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.map((msg, idx) => {
                        const isMe = msg.user === (user?.username || localStorage.getItem('username'));
                        return (
                            <div key={idx} className={`group flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-lg ${isMe ? 'bg-gradient-to-br from-purple-500 to-indigo-600 border border-purple-400/30' : 'bg-gradient-to-br from-gray-700 to-gray-600 border border-gray-600'}`}>
                                    {msg.user.charAt(0).toUpperCase()}
                                </div>

                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                                    <span className="text-[10px] text-gray-400 mb-1 px-1 opacity-70 flex items-center gap-2">
                                        {msg.user}
                                        <button
                                            onClick={() => pinMessage(msg)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-purple-400"
                                            title="Pin this message"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                                        </button>
                                    </span>
                                    <div className={`px-4 py-2.5 text-sm shadow-md ${isMe
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm'
                                        : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-2xl rounded-tl-sm'
                                        }`}>
                                        {msg.message}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                    <form onSubmit={sendMessage} className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-gray-500 shadow-inner"
                        />
                        <button
                            type="submit"
                            disabled={!message.trim()}
                            className="absolute right-2 p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 rounded-full text-white transition-all shadow-lg hover:shadow-purple-500/25 active:scale-95"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

const VideoPlayer = ({ stream }: { stream: MediaStream }) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (!videoRef.current || !stream) return;

        const videoElement = videoRef.current;

        // Check if stream has active video tracks
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
            console.warn('No video tracks in stream');
            return;
        }

        // Set srcObject
        videoElement.srcObject = stream;

        // Explicitly attempt to play to avoid black screen on some devices
        const playVideo = async () => {
            try {
                await videoElement.play();
                console.log('Video playing successfully');
            } catch (e) {
                console.error("Auto-play failed:", e);
                // Retry after a short delay
                setTimeout(async () => {
                    try {
                        await videoElement.play();
                    } catch (retryError) {
                        console.error("Retry play failed:", retryError);
                    }
                }, 500);
            }
        };

        videoElement.onloadedmetadata = playVideo;

        // If metadata is already loaded, play immediately
        if (videoElement.readyState >= 2) {
            playVideo();
        }

        // Monitor track state
        const handleTrackEnded = () => {
            console.warn('Video track ended');
        };

        videoTracks.forEach(track => {
            track.addEventListener('ended', handleTrackEnded);
        });

        // Cleanup
        return () => {
            videoTracks.forEach(track => {
                track.removeEventListener('ended', handleTrackEnded);
            });
            if (videoElement.srcObject) {
                videoElement.srcObject = null;
            }
        };
    }, [stream])

    return (
        <div className="relative w-full h-full">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={false}
                className="w-full h-full object-cover"
            />
            {/* Quality Indicator (Remote) */}
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] text-blue-400 font-mono z-10 flex gap-2">
                <span>Auto</span>
                <span>-- Mbps</span>
            </div>
        </div>
    )
}
