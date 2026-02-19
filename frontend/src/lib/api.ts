import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://stream-jp3e.vercel.app/api';

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
apiClient.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Auto-logout on 401/403
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// --- Auth API ---
export async function registerUser(data: { username: string; email: string; password: string }) {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
}

export async function loginUser(data: { email: string; password: string }) {
    const res = await apiClient.post('/auth/login', data);
    return res.data;
}

export async function getCurrentUser() {
    const res = await apiClient.get('/auth/me');
    return res.data;
}

// --- Meetings API ---
export async function createMeeting(title?: string) {
    const res = await apiClient.post('/meetings', { title });
    return res.data;
}

export async function getMeeting(code: string) {
    const res = await apiClient.get(`/meetings/${code}`);
    return res.data;
}

export async function listMeetings() {
    const res = await apiClient.get('/meetings');
    return res.data;
}

export async function joinMeetingAPI(code: string) {
    const res = await apiClient.post(`/meetings/${code}/join`);
    return res.data;
}

export async function leaveMeetingAPI(code: string) {
    try {
        const res = await apiClient.post(`/meetings/${code}/leave`);
        return res.data;
    } catch {
        return { success: false };
    }
}
