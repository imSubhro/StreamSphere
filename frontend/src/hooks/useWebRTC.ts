import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useWebRTC = (roomId: string, isAuthorized: boolean, token: string | null, guestName: string | null = null) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Record<string, RTCPeerConnection>>({});
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [peerMediaStates, setPeerMediaStates] = useState<Record<string, { video: boolean, audio: boolean }>>({});
    const [iceServers, setIceServers] = useState<RTCIceServer[]>([
        { urls: "stun:stun.l.google.com:19302" }
    ]);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<Record<string, RTCPeerConnection>>({}); // Ref for mutable access

    // Fetch ICE Servers
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/config/ice`)
            .then(res => res.json())
            .then(data => {
                if (data.iceServers) setIceServers(data.iceServers);
            })
            .catch(err => console.error('Failed to fetch ICE servers', err));
    }, []);

    useEffect(() => {
        if (!isAuthorized) return;

        // Initialize Socket with Auth Token
        const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5002', {
            auth: { token, guestName }
        });
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthorized, token]);

    useEffect(() => {
        if (!socket || !roomId || !isAuthorized) return;

        // Get User Media
        navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        })
            .then((stream) => {
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.muted = true; // Mute local video to prevent feedback
                }

                // Join Room
                socket.emit('join-stream', roomId);

                // Handle New User Joined
                socket.on('user-joined', (userId) => {
                    console.log('User joined:', userId);
                    createPeerConnection(userId, stream, true);
                });

                // Handle Offer
                socket.on('offer', async (payload) => {
                    const pc = createPeerConnection(payload.caller, stream, false);
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('answer', { target: payload.caller, sdp: answer });
                });

                // Handle Answer
                socket.on('answer', async (payload) => {
                    const pc = peersRef.current[payload.caller];
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                    }
                });

                // Handle ICE Candidate
                socket.on('ice-candidate', async ({ candidate, sender }) => {
                    const pc = peersRef.current[sender];
                    if (pc) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                });

                // Handle User Left
                socket.on('user-left', (userId) => {
                    if (peersRef.current[userId]) {
                        peersRef.current[userId].close();
                        const newPeers = { ...peersRef.current };
                        delete newPeers[userId];
                        peersRef.current = newPeers;
                        setPeers(newPeers);

                        setRemoteStreams(prev => {
                            const newStreams = { ...prev };
                            delete newStreams[userId];
                            return newStreams;
                        });
                    }
                });

                // Handle Media Toggle
                socket.on('user-toggled-media', ({ userId, type, enabled }) => {
                    setPeerMediaStates(prev => ({
                        ...prev,
                        [userId]: {
                            ...prev[userId],
                            [type]: enabled
                        }
                    }));
                });
            })
            .catch(err => console.error('Error accessing media devices:', err));

        // Cleanup function
        return () => {
            // Stop all tracks
            localStream?.getTracks().forEach(track => track.stop());
            // Close all peer connections
            Object.values(peersRef.current).forEach(pc => pc.close());
            socket.off('user-toggled-media');
        }

    }, [socket, roomId]);

    const createPeerConnection = (targetId: string, stream: MediaStream, isInitiator: boolean) => {
        const pc = new RTCPeerConnection({ iceServers });

        // Add local tracks with Simulcast (ABR)
        stream.getTracks().forEach(track => {
            if (track.kind === 'video') {
                pc.addTransceiver(track, {
                    streams: [stream],
                    sendEncodings: [
                        { rid: 'q', maxBitrate: 100000, scaleResolutionDownBy: 4.0 }, // Low
                        { rid: 'h', maxBitrate: 300000, scaleResolutionDownBy: 2.0 }, // Mid
                        { rid: 'f', maxBitrate: 900000, scaleResolutionDownBy: 1.0 }  // High
                    ]
                });
            } else {
                pc.addTrack(track, stream);
            }
        });

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('ice-candidate', { target: targetId, candidate: event.candidate });
            }
        };

        // Handle Remote Stream
        pc.ontrack = (event) => {
            console.log("Received remote track from", targetId);
            setRemoteStreams(prev => ({
                ...prev,
                [targetId]: event.streams[0]
            }));
        };

        if (isInitiator) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                socket?.emit('offer', { target: targetId, sdp: offer });
            });
        }

        peersRef.current[targetId] = pc;
        setPeers(prev => ({ ...prev, [targetId]: pc }));
        return pc;
    };

    const toggleAudio = () => {
        if (localStream) {
            const newState = !isAudioEnabled;
            localStream.getAudioTracks().forEach(track => {
                track.enabled = newState;
            });
            setIsAudioEnabled(newState);
            socket?.emit('toggle-media', { streamId: roomId, type: 'audio', enabled: newState });
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const newState = !isVideoEnabled;
            localStream.getVideoTracks().forEach(track => {
                track.enabled = newState;
            });
            setIsVideoEnabled(newState);
            socket?.emit('toggle-media', { streamId: roomId, type: 'video', enabled: newState });
        }
    };

    const stopStream = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if (socket) {
            socket.disconnect();
        }
    };

    return {
        socket,
        localStream,
        remoteStreams,
        localVideoRef,
        stopStream,
        toggleAudio,
        toggleVideo,
        isAudioEnabled,
        isVideoEnabled,
        peerMediaStates
    };
};
