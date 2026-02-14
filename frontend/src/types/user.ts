export interface User {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
    createdAt?: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    username: string;
    email: string;
    password: string;
}
