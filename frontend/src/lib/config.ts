const PROD_API_URL = 'https://stream-jp3e.vercel.app/api';
const PROD_SOCKET_URL = 'https://stream-jp3e.vercel.app';

export function getApiUrl(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    if (typeof window !== 'undefined') {
        const { hostname } = window.location;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:5000/api';
        }
    }

    return PROD_API_URL;
}

export function getSocketUrl(): string {
    if (process.env.NEXT_PUBLIC_SOCKET_URL) {
        return process.env.NEXT_PUBLIC_SOCKET_URL;
    }

    if (typeof window !== 'undefined') {
        const { hostname } = window.location;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:5000';
        }
    }

    // Keep the socket URL in sync with the API URL by default
    const api = getApiUrl();
    return api.replace(/\/api$/, '');
}
