import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useWebRTC = (roomId: string, isAuthorized: boolean, token: string | null, guestName: string | null = null) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Record<string, RTCPeerConnection>>({});
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [peerMediaStates, setPeerMediaStates] = useState<Record<string, { video: boolean, audio: boolean }>>({});
    const [iceServers, setIceServers] = useState<RTCIceServer[]>([
        { urls: "stun:stun.l.google.com:19302" }
    ]);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<Record<string, RTCPeerConnection>>({}); // Ref for mutable access
    const originalStreamRef = useRef<MediaStream | null>(null); // Store original camera stream

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

        // Get User Media with higher quality
        navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 30, max: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
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
                    try {
                        let pc = peersRef.current[payload.caller];

                        // Create peer connection if it doesn't exist
                        if (!pc) {
                            pc = createPeerConnection(payload.caller, stream, false);
                        }

                        // Check signaling state before setting remote description
                        if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
                            console.warn(`Unexpected signaling state for offer: ${pc.signalingState}`);
                        }

                        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        socket.emit('answer', { target: payload.caller, sdp: answer });
                    } catch (err) {
                        console.error('Error handling offer:', err);
                    }
                });

                // Handle Answer
                socket.on('answer', async (payload) => {
                    try {
                        const pc = peersRef.current[payload.caller];
                        if (pc) {
                            // Only set remote description if we're in the right state
                            if (pc.signalingState === 'have-local-offer') {
                                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                            } else {
                                console.warn(`Cannot set answer in signaling state: ${pc.signalingState}`);
                            }
                        }
                    } catch (err) {
                        console.error('Error handling answer:', err);
                    }
                });

                // Handle ICE Candidate
                socket.on('ice-candidate', async ({ candidate, sender }) => {
                    try {
                        const pc = peersRef.current[sender];
                        if (pc && pc.remoteDescription) {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } else {
                            console.warn('Received ICE candidate before remote description');
                        }
                    } catch (err) {
                        console.error('Error adding ICE candidate:', err);
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
        let isNegotiating = false;
        let makingOffer = false;

        // Add local tracks with Simulcast (ABR) - Higher bitrates for better quality
        stream.getTracks().forEach(track => {
            if (track.kind === 'video') {
                pc.addTransceiver(track, {
                    streams: [stream],
                    sendEncodings: [
                        { rid: 'q', maxBitrate: 500000, scaleResolutionDownBy: 4.0 },  // Low: 500kbps
                        { rid: 'h', maxBitrate: 1500000, scaleResolutionDownBy: 2.0 }, // Mid: 1.5Mbps
                        { rid: 'f', maxBitrate: 3000000, scaleResolutionDownBy: 1.0 }  // High: 3Mbps
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

        // Monitor connection state
        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${targetId}:`, pc.connectionState);
            if (pc.connectionState === 'failed') {
                console.warn(`Connection failed with ${targetId}, attempting ICE restart...`);
                // Only restart ICE if we're the initiator and not already negotiating
                if (isInitiator && !isNegotiating) {
                    pc.restartIce();
                }
            }
        };

        // Monitor ICE connection state
        pc.oniceconnectionstatechange = () => {
            console.log(`ICE connection state with ${targetId}:`, pc.iceConnectionState);
        };

        // Handle Remote Stream
        pc.ontrack = (event) => {
            console.log("Received remote track from", targetId, "kind:", event.track.kind);

            // Ensure the stream has active tracks
            const stream = event.streams[0];
            if (stream) {
                console.log(`Stream from ${targetId} has ${stream.getVideoTracks().length} video tracks`);
                setRemoteStreams(prev => ({
                    ...prev,
                    [targetId]: stream
                }));

                // Monitor track state
                event.track.onended = () => {
                    console.warn(`Track ${event.track.kind} from ${targetId} ended`);
                };

                event.track.onmute = () => {
                    console.warn(`Track ${event.track.kind} from ${targetId} muted`);
                };

                event.track.onunmute = () => {
                    console.log(`Track ${event.track.kind} from ${targetId} unmuted`);
                };
            }
        };

        // Handle negotiation needed - with proper state management to prevent conflicts
        pc.onnegotiationneeded = async () => {
            // Prevent renegotiation during initial setup or if already negotiating
            if (makingOffer || isNegotiating) {
                console.log(`Skipping negotiation with ${targetId} - already in progress`);
                return;
            }

            try {
                isNegotiating = true;
                makingOffer = true;
                console.log(`Negotiation needed with ${targetId}`);

                const offer = await pc.createOffer();

                // Check if connection state is still valid
                if (pc.signalingState !== "stable") {
                    console.log(`Signaling state not stable, skipping offer for ${targetId}`);
                    return;
                }

                await pc.setLocalDescription(offer);
                socket?.emit('offer', { target: targetId, sdp: offer });
            } catch (err) {
                console.error('Negotiation failed:', err);
            } finally {
                makingOffer = false;
            }
        };

        // Handle signaling state changes
        pc.onsignalingstatechange = () => {
            console.log(`Signaling state with ${targetId}:`, pc.signalingState);
            if (pc.signalingState === "stable") {
                isNegotiating = false;
            }
        };

        // Create initial offer if initiator
        if (isInitiator) {
            makingOffer = true;
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    socket?.emit('offer', { target: targetId, sdp: pc.localDescription });
                })
                .catch(err => console.error('Failed to create initial offer:', err))
                .finally(() => {
                    makingOffer = false;
                });
        }

        peersRef.current[targetId] = pc;
        setPeers(prev => ({ ...prev, [targetId]: pc }));
        return pc;
    };

    const toggleAudio = () => {
        if (localStream) {
            const newState = !isAudioEnabled;
            const audioTracks = localStream.getAudioTracks();
            console.log(`Toggling audio: ${newState}, tracks:`, audioTracks.length);
            audioTracks.forEach(track => {
                track.enabled = newState;
            });
            setIsAudioEnabled(newState);
            socket?.emit('toggle-media', { streamId: roomId, type: 'audio', enabled: newState });
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const newState = !isVideoEnabled;
            const videoTracks = localStream.getVideoTracks();
            console.log(`Toggling video: ${newState}, tracks:`, videoTracks.length);
            videoTracks.forEach(track => {
                track.enabled = newState;
                console.log(`Video track enabled state:`, track.enabled, `readyState:`, track.readyState);
            });
            setIsVideoEnabled(newState);
            socket?.emit('toggle-media', { streamId: roomId, type: 'video', enabled: newState });
        }
    };

    const toggleScreenShare = async () => {
        if (!localStream) return;

        try {
            if (isScreenSharing) {
                // Switch back to camera
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: true
                });

                // Replace video track in local stream
                const oldVideoTrack = localStream.getVideoTracks()[0];
                const newVideoTrack = cameraStream.getVideoTracks()[0];

                if (oldVideoTrack) {
                    localStream.removeTrack(oldVideoTrack);
                    oldVideoTrack.stop();
                }
                localStream.addTrack(newVideoTrack);

                // Replace video track in all peer connections
                Object.values(peersRef.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(newVideoTrack);
                    }
                });

                // Update local video element
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                }

                setIsScreenSharing(false);
                console.log('Switched back to camera');
            } else {
                // Switch to screen sharing with high quality
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 },
                        frameRate: { ideal: 30, max: 30 }
                    },
                    audio: false
                });

                const screenTrack = screenStream.getVideoTracks()[0];

                // Handle screen share stop (user clicks browser's stop button)
                screenTrack.onended = () => {
                    toggleScreenShare(); // Switch back to camera
                };

                // Replace video track in local stream
                const oldVideoTrack = localStream.getVideoTracks()[0];
                if (oldVideoTrack) {
                    localStream.removeTrack(oldVideoTrack);
                    oldVideoTrack.stop();
                }
                localStream.addTrack(screenTrack);

                // Replace video track in all peer connections
                Object.values(peersRef.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(screenTrack);
                    }
                });

                // Update local video element
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                }

                setIsScreenSharing(true);
                console.log('Started screen sharing');
            }
        } catch (err) {
            console.error('Error toggling screen share:', err);
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
        toggleScreenShare,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        peerMediaStates
    };
};
