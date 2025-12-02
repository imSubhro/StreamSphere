import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'

export default function Home() {
    const router = useRouter()
    const [roomId, setRoomId] = useState('')
    const [showNameModal, setShowNameModal] = useState(false)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null)

    const handleStartClick = () => {
        setPendingAction('create')
        setShowNameModal(true)
    }

    const handleJoinClick = (e: React.FormEvent) => {
        e.preventDefault()
        if (!roomId.trim()) return
        setPendingAction('join')
        setShowNameModal(true)
    }

    const handleConfirmName = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!username.trim()) return

        localStorage.setItem('username', username)
        setShowNameModal(false)

        if (pendingAction === 'create') {
            await createStream()
        } else {
            router.push(`/stream/${roomId}`)
        }
    }

    const createStream = async () => {
        try {
            const res = await fetch('http://localhost:5002/api/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            })
            const data = await res.json()
            if (data.streamKey) {
                router.push(`/stream/${data.streamKey}`)
            }
        } catch (err) {
            alert('Failed to start stream')
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30">
            <Head>
                <title>StreamSphere | Real-time Streaming</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>

            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-1000" />
            </div>

            {/* Navbar */}
            <nav className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                    </div>
                    <span className="text-xl font-bold tracking-tight">StreamSphere</span>
                </div>
                <div className="flex gap-4">
                    <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">About</button>
                    <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
                            Share your world, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-gradient-x">
                                in real-time.
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                            Experience low-latency streaming with crystal clear video and immersive chat.
                            No sign-ups required to start watching.
                        </p>
                    </div>

                    {/* Action Cards */}
                    <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl mx-auto mt-12">
                        {/* Create Room Card */}
                        <div className="group relative p-1 rounded-2xl bg-gradient-to-b from-purple-500/20 to-transparent hover:from-purple-500/40 transition-all duration-300">
                            <div className="absolute inset-0 bg-purple-500/10 blur-xl group-hover:bg-purple-500/20 transition-all" />
                            <div className="relative h-full bg-gray-900/90 backdrop-blur-xl border border-white/10 p-8 rounded-xl flex flex-col items-center gap-4 hover:border-purple-500/50 transition-all">
                                <div className="p-4 bg-purple-500/10 rounded-full text-purple-400 mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                                </div>
                                <h3 className="text-2xl font-bold">Start Streaming</h3>
                                <p className="text-gray-400 text-sm">Create a new room and invite your friends to watch.</p>
                                <button
                                    onClick={handleStartClick}
                                    className="w-full mt-4 py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40 transform hover:-translate-y-0.5"
                                >
                                    Create Room
                                </button>
                            </div>
                        </div>

                        {/* Join Room Card */}
                        <div className="group relative p-1 rounded-2xl bg-gradient-to-b from-blue-500/20 to-transparent hover:from-blue-500/40 transition-all duration-300">
                            <div className="absolute inset-0 bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-all" />
                            <div className="relative h-full bg-gray-900/90 backdrop-blur-xl border border-white/10 p-8 rounded-xl flex flex-col items-center gap-4 hover:border-blue-500/50 transition-all">
                                <div className="p-4 bg-blue-500/10 rounded-full text-blue-400 mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1" /></svg>
                                </div>
                                <h3 className="text-2xl font-bold">Join Room</h3>
                                <p className="text-gray-400 text-sm">Enter a room code to join an existing stream.</p>
                                <form onSubmit={handleJoinClick} className="w-full mt-4 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Room ID"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value)}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        className="p-3 bg-gray-800 hover:bg-blue-600 hover:text-white border border-gray-700 hover:border-blue-600 rounded-lg transition-all"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal */}
            {showNameModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowNameModal(false)} />
                    <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 transform transition-all animate-in fade-in zoom-in duration-200">
                        <div className="text-center mb-8">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-500">
                                {pendingAction === 'create' ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                                {pendingAction === 'create' ? 'Create Your Stream' : 'Join the Stream'}
                            </h2>
                            <p className="text-gray-400 text-sm mt-2">
                                {pendingAction === 'create' ? 'Set up your profile and room security.' : 'Enter your name to join the conversation.'}
                            </p>
                        </div>

                        <form onSubmit={handleConfirmName} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Display Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Streamer123"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {pendingAction === 'create' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Room Password <span className="text-gray-600 normal-case">(Optional)</span></label>
                                    <input
                                        type="password"
                                        placeholder="Secret Password"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-purple-600/25 mt-6"
                            >
                                {pendingAction === 'create' ? 'Start Streaming' : 'Join Room'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
