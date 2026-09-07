import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
} from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_WEB_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey,
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isIosStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

export type UnsupportedReason = 'ios-not-installed' | 'no-notification-api' | 'no-service-worker' | 'other';

export function getUnsupportedReason(): UnsupportedReason {
  if (typeof window === 'undefined') return 'other';
  if (isIos() && !isIosStandalone()) return 'ios-not-installed';
  if (!('Notification' in window)) return 'no-notification-api';
  if (!('serviceWorker' in navigator)) return 'no-service-worker';
  return 'other';
}

let app: FirebaseApp | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingPromise) return messagingPromise;

  messagingPromise = (async () => {
    try {
      const firebaseApp = getFirebaseApp();
      if (!firebaseApp) return null;
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

      const supported = await isSupported().catch(() => false);
      if (!supported) return null;

      return getMessaging(firebaseApp);
    } catch (err) {
      console.warn('[Firebase] Messaging unavailable in this environment:', err);
      return null;
    }
  })();

  return messagingPromise;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  const base = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? '',
    projectId: firebaseConfig.projectId ?? '',
    messagingSenderId: firebaseConfig.messagingSenderId ?? '',
    appId: firebaseConfig.appId ?? '',
  });

  return navigator.serviceWorker.register(
    `${base}/firebase-messaging-sw.js?${params.toString()}`,
    { scope: `${base}/` },
  );
}

export type PushPermissionResult =
  | { status: 'unsupported' }
  | { status: 'denied' }
  | { status: 'granted'; token: string }
  | { status: 'error'; message: string };

function isEmbeddedCrossOriginIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function requestPushToken(): Promise<PushPermissionResult> {
  if (!isFirebaseConfigured()) return { status: 'unsupported' };
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { status: 'unsupported' };
  }

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return { status: 'unsupported' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (isEmbeddedCrossOriginIframe()) {
        return {
          status: 'error',
          message:
            'Browser notification permission cannot be requested inside this embedded preview. Open the app in its own browser tab and try again.',
        };
      }
      return { status: 'denied' };
    }

    const registration = await registerServiceWorker();
    if (!registration) return { status: 'unsupported' };

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { status: 'error', message: 'No token returned' };
    return { status: 'granted', token };
  } catch (err) {
    if (isEmbeddedCrossOriginIframe()) {
      return {
        status: 'error',
        message:
          'Browser notification permission cannot be requested inside this embedded preview. Open the app in its own browser tab and try again.',
      };
    }
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function listenForForegroundMessages(
  callback: (payload: { title?: string; body?: string }) => void,
): Promise<() => void> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return () => {};

    const unsubscribe = onMessage(messaging, (payload) => {
      callback({
        title: payload.notification?.title,
        body: payload.notification?.body,
      });
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[Firebase] Could not listen for foreground messages:', err);
    return () => {};
  }
}
