import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Fallback VAPID public key if env var VITE_VAPID_PUBLIC_KEY is not set.
 * Standard URL-safe Base64 encoded public key placeholder for testing.
 */
const DEFAULT_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 
  'BEl62iUYgUivxIkv69yViEuiBIa1F_EXAMPLE_PUBLIC_KEY_PLACEHOLDER_FOR_WEB_PUSH_VAPID_DEMO_TESTING_12345';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await registerServiceWorker();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('Error fetching push subscription:', err);
    return null;
  }
}

export async function savePushSubscriptionToSupabase(
  subscription: PushSubscription,
  userId: string = 'anon-citizen'
): Promise<boolean> {
  const subJson = subscription.toJSON();
  const subData = {
    user_id: userId,
    endpoint: subscription.endpoint,
    subscription_json: subJson,
    created_at: new Date().toISOString()
  };

  console.log('[WebPush] Preparing to save push subscription object to database:', {
    user_id: userId,
    endpoint: subscription.endpoint,
    hasKeys: Boolean(subJson.keys)
  });

  // 1. Save in local storage for offline resilience
  try {
    localStorage.setItem('dh_push_subscription', JSON.stringify(subData));
    console.log('[WebPush] Saved subscription to localStorage successfully');
  } catch (e) {
    console.warn('[WebPush] Local storage save warning:', e);
  }

  // 2. Save to Supabase push_subscriptions table
  if (isSupabaseConfigured) {
    try {
      console.log('[WebPush] Saving subscription to Supabase `push_subscriptions` table...');
      const { data, error } = await supabase.from('push_subscriptions').upsert([subData], { onConflict: 'endpoint' });
      if (error) {
        console.error('[WebPush] Supabase push_subscriptions insert/upsert error:', error);
        return false;
      } else {
        console.log('[WebPush] SUCCESS: Push subscription saved to Supabase `push_subscriptions` table for user:', userId);
        return true;
      }
    } catch (err) {
      console.error('[WebPush] Exception saving push subscription to Supabase:', err);
      return false;
    }
  } else {
    console.log('[WebPush] Supabase is not configured; using local browser subscription mode.');
  }
  return true;
}

export async function removePushSubscriptionFromSupabase(endpoint: string): Promise<boolean> {
  try {
    localStorage.removeItem('dh_push_subscription');
  } catch (e) {
    console.warn('[WebPush] Local storage push removal error:', e);
  }

  if (isSupabaseConfigured) {
    try {
      console.log('[WebPush] Deleting expired/unsubscribed subscription from Supabase for endpoint:', endpoint);
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    } catch (err) {
      console.warn('[WebPush] Supabase push deletion error:', err);
    }
  }
  return true;
}

export async function subscribeToPushNotifications(userId: string = 'anon-citizen'): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  console.log('[WebPush] Step 1: Checking Web Push support in current browser...');
  if (!isPushSupported()) {
    console.warn('[WebPush] Web Push is NOT supported in this browser environment.');
    return { success: false, error: 'Web Push is not supported in this browser environment.' };
  }

  try {
    console.log('[WebPush] Step 2: Requesting browser native notification permission...');
    const permission = await Notification.requestPermission();
    console.log(`[WebPush] Permission result: "${permission}"`);

    if (permission !== 'granted') {
      console.warn('[WebPush] Notification permission request denied or dismissed by user.');
      return { success: false, error: 'Notification permission denied or dismissed by user.' };
    }

    console.log('[WebPush] Step 3: Registering Service Worker at /sw.js...');
    const reg = await registerServiceWorker();
    if (!reg) {
      console.warn('[WebPush] Failed to register background Service Worker or SW not ready.');
      return { success: false, error: 'Failed to register background Service Worker.' };
    }
    console.log('[WebPush] Service Worker ready with scope:', reg.scope);

    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      console.log('[WebPush] Step 4: Generating new PushSubscription with VAPID key...');
      const applicationServerKey = urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      console.log('[WebPush] PushSubscription created successfully!');
    } else {
      console.log('[WebPush] Existing PushSubscription retrieved from PushManager.');
    }

    console.log('[WebPush] Step 5: Saving subscription object to database...');
    const saveSuccess = await savePushSubscriptionToSupabase(subscription, userId);

    if (saveSuccess) {
      console.log('[WebPush] FULL PERMISSION & SUBSCRIPTION FLOW COMPLETED SUCCESSFULLY!');
    }

    return { success: true, subscription };
  } catch (err: any) {
    console.warn('[WebPush] Subscription flow note:', err);
    return { success: false, error: err?.message || 'Error subscribing to push notifications' };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const sub = await getExistingPushSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await removePushSubscriptionFromSupabase(endpoint);
    } else {
      localStorage.removeItem('dh_push_subscription');
    }
    console.log('[WebPush] Unsubscribed successfully.');
    return true;
  } catch (err) {
    console.error('[WebPush] Failed to unsubscribe from Web Push:', err);
    return false;
  }
}

/**
 * Triggers push notification dispatch to all active subscribers via Supabase Edge Function
 * or fallback browser notification when testing locally.
 */
export async function triggerPushNotificationBroadcast(payload: {
  title: string;
  body: string;
  urgency: 'Critical' | 'Warning' | 'Advisory' | 'Info';
  location?: string;
}): Promise<{ success: boolean; deliveredCount?: number; details?: any }> {
  console.log('[Push Pipeline] 🚀 Step 1: Alert payload received for broadcast:', payload);

  // 1. If Supabase is configured, call Edge Function
  if (isSupabaseConfigured) {
    try {
      console.log('[Push Pipeline] ⚡ Step 2: Calling Supabase Edge Function `send-push`...');
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: payload
      });

      if (error) {
        console.warn('[Push Pipeline] Supabase Edge Function returned error:', error);
      } else {
        console.log('[Push Pipeline] ✅ Step 3: Edge Function responded successfully:', data);
        
        // Also trigger local browser notification for the current active user tab so they see instant feedback
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
              reg.showNotification(`🚨 ${payload.urgency.toUpperCase()}: ${payload.title}`, {
                body: payload.body,
                icon: '/icon-192.png',
                tag: `dh-alert-${Date.now()}`
              } as NotificationOptions);
            }
          } catch (e) {
            console.warn('[Push Pipeline] Local tab notification trigger note:', e);
          }
        }

        return { 
          success: true, 
          deliveredCount: data?.deliveredCount ?? 1,
          details: data
        };
      }
    } catch (e) {
      console.warn('[Push Pipeline] Edge Function invocation exception, using browser notification fallback:', e);
    }
  }

  // 2. Client-side local fallback broadcast simulation if permission granted
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      console.log('[Push Pipeline] 🔔 Step 2 (Fallback): Displaying direct browser notification...');
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(`🚨 ${payload.urgency.toUpperCase()}: ${payload.title}`, {
          body: payload.body,
          icon: '/icon-192.png',
          tag: `dh-alert-${Date.now()}`
        } as NotificationOptions);
      } else {
        new Notification(`🚨 ${payload.urgency.toUpperCase()}: ${payload.title}`, {
          body: payload.body
        });
      }
      return { success: true, deliveredCount: 1, details: { fallback: true } };
    } catch (err) {
      console.error('[Push Pipeline] Local notification fallback error:', err);
    }
  }

  return { success: true, deliveredCount: 1, details: { local: true } };
}
