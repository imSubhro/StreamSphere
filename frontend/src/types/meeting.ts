import { User } from './user';

export enum MeetingStatus {
    SCHEDULED = 'SCHEDULED',
    ACTIVE = 'ACTIVE',
    ENDED = 'ENDED',
}

export interface Meeting {
    id: string;
    meeting_code: string;
    title?: string;
    host_id: string;
    status: MeetingStatus;
    started_at?: string;
    ended_at?: string;
    created_at: string;
    updated_at: string;
    host?: User;
    participants?: Participant[];
}

export interface Participant {
    id: string;
    meeting_id: string;
    user_id: string;
    role: 'HOST' | 'PARTICIPANT';
    joined_at: string;
    left_at?: string;
    user?: User;
}

export interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: string;
}
