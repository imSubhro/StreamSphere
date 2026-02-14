const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export interface PeerCallbacks {
    onTrack: (stream: MediaStream, socketId: string) => void;
    onIceCandidate: (candidate: RTCIceCandidate, to: string) => void;
}

export function createPeerConnection(socketId: string, callbacks: PeerCallbacks): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        callbacks.onTrack(remoteStream, socketId);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) callbacks.onIceCandidate(event.candidate, socketId);
    };

    pc.onconnectionstatechange = () => {
        console.log(`Peer ${socketId}: ${pc.connectionState}`);
    };

    return pc;
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
}

export async function handleOffer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
}

export async function handleAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit): Promise<void> {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function handleIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

export function addStreamToPeer(pc: RTCPeerConnection, stream: MediaStream): void {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
}
