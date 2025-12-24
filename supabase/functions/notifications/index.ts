// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const inputs = await req.json();
    const { userId, record } = inputs;
    const title = inputs.title || "New Puzzle! 🧩";
    const body = inputs.body || "Your partner locked in a new word.";

    // Support both direct calls (userId) and Webhook calls (record)
    const targetUserId = userId || record?.solver_id;

    if (!targetUserId) {
      throw new Error("Missing user_id or record.solver_id");
    }

    console.log(`Sending notification to user: ${targetUserId}`);

    // Get push subscriptions for the user
    const { data: subscriptions, error } = await supabaseClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", targetUserId);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No subscriptions found for user.");
      return new Response(JSON.stringify({ message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Send notifications in parallel
    const notifications = subscriptions.map((sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh,
        },
      };

      // VAPID keys should be set in Edge Function Secrets
      // If not set, this might throw. For now, we assume implicit auth or headers if handled by web-push,
      // but typically we need VAPID details.
      // However, for a simple implementation, let's try sending without VAPID if the browser accepts it (uncommon)
      // OR assuming the user will set valid VAPID keys in `webPush.setVapidDetails`.
      // Since I don't have the keys, I will add a placeholder note.
      
      const vapidEmail = Deno.env.get("VAPID_EMAIL") || "mailto:example@example.com";
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
      }

      return webpush
        .sendNotification(pushConfig, JSON.stringify({ title, body }))
        .catch(async (err: any) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription is gone, delete it
            console.log(`Deleting invalid subscription: ${sub.id}`);
            await supabaseClient.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("Push Error:", err);
          }
        });
    });

    await Promise.all(notifications);

    return new Response(JSON.stringify({ message: "Notifications sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
