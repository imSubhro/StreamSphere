import io, { Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://stream-jp3e.vercel.app';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(WS_URL, {
            autoConnect: false,
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => console.log('Socket connected:', socket?.id));
        socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
        socket.on('connect_error', (err) => console.error('Socket error:', err.message));
    }
    return socket;
}

export function connectSocket(): void {
    const s = getSocket();
    if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
