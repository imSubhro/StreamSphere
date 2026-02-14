export async function getLocalStream(audio = true, video = true): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
    });
    return stream;
}

export function stopMediaStream(stream: MediaStream): void {
    stream.getTracks().forEach((t) => t.stop());
}

export function toggleAudio(stream: MediaStream, enabled: boolean): void {
    const track = stream.getAudioTracks()[0];
    if (track) track.enabled = enabled;
}

export function toggleVideo(stream: MediaStream, enabled: boolean): void {
    const track = stream.getVideoTracks()[0];
    if (track) track.enabled = enabled;
}

export async function getScreenStream(): Promise<MediaStream> {
    return navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
    });
}
