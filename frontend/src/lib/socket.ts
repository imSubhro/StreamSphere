import io, { Socket } from 'socket.io-client';
import { getSocketUrl } from './config';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        let token: string | null = null;
        if (typeof window !== 'undefined') {
            token = localStorage.getItem('token');
        }

        socket = io(getSocketUrl(), {
            autoConnect: false,
            transports: ['websocket', 'polling'],
            auth: token ? { token } : undefined,
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
