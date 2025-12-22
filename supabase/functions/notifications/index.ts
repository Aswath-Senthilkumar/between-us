// @ts-nocheck
import webpush from "npm:web-push@3.6.7";

// CONFIG: Set these in your Supabase Dashboard -> Edge Functions -> Secrets
// VAPID_PUBLIC_KEY
// VAPID_PRIVATE_KEY
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    let userId = payload.userId;
    let title = payload.title;
    let body = payload.body;

    // Handle Supabase Database Webhook (Auto-config)
    if (payload.type === "INSERT" && payload.record) {
      userId = payload.record.solver_id;
      title = "New Puzzle! 💌";
      body = "Your partner sent you a puzzle to solve!";
    }

    if (!userId) {
      console.error("Missing userId in payload", payload);
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 1. Setup Vapid
    const subject = "mailto:admin@example.com"; // Replace with your email
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!publicKey || !privateKey) {
      throw new Error("Missing VAPID keys in Edge Function Secrets");
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    // 2. Fetch User Subscriptions
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
       throw new Error("Missing Supabase URL/Key");
    }

    // Simple fetch using the REST API
    const response = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=*`,
      {
        headers: {
          ApiKey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const subscriptions = await response.json();

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No subscriptions found for user ${userId}`);
      return new Response(JSON.stringify({ message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Send Notifications
    const promises = subscriptions.map((sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: atob(sub.p256dh),
          auth: atob(sub.auth),
        },
      };

      return webpush
        .sendNotification(pushSubscription, JSON.stringify({ title, body }))
        .catch((err) => {
            // 410 Gone / 404 Not Found means subscription is invalid
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log("Deleting invalid subscription", sub.id);
            fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
              method: "DELETE",
              headers: {
                ApiKey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
            });
          } else {
             console.error("Error sending push:", err);
          }
        });
    });

    await Promise.all(promises);

    return new Response(
      JSON.stringify({ message: `Sent to ${promises.length} devices` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
