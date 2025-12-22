import { supabase } from "../lib/supabase";

const VAPID_PUBLIC_KEY =
  "BDIaFCFNvUsMhgYRnIspHtq_OmgkGomow_iNTWQUHlXS5H4G6PQyBVJmZeL-8Q7Tm7ZKq28dkWGmIFKTpwvlfPk"; // User needs to replace this

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported on this device.");
  }

  // Check valid VAPID key
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.includes("YOUR_VAPID_PUBLIC_KEY")) {
    throw new Error("VAPID Public Key not configured.");
  }

  const registration = await navigator.serviceWorker.ready;

  // Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Save to Supabase
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: btoa(
      String.fromCharCode(
        ...new Uint8Array(subscription.getKey("p256dh") as ArrayBuffer)
      )
    ),
    auth: btoa(
      String.fromCharCode(
        ...new Uint8Array(subscription.getKey("auth") as ArrayBuffer)
      )
    ),
  });

  if (error) {
    // Check if duplicate (already subscribed) - generic error handling
    if (error.code === "23505") return true; // Unique constraint violation, already exists
    throw error;
  }

  // Update Timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await supabase
    .from("profiles")
    .update({ timezone: timezone })
    .eq("id", userId);

  return true;
}
