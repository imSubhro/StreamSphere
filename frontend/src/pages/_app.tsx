import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../context/AuthContext';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <title>StreamSphere</title>
                <meta name="description" content="Real-time video meetings, powered by WebRTC" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <AuthProvider>
                <Component {...pageProps} />
            </AuthProvider>
        </>
    );
}
