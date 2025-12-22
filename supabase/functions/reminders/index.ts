// @ts-nocheck
import webpush from "npm:web-push@3.6.7";

// CONFIG: Set these in your Supabase Dashboard -> Edge Functions -> Secrets
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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
    // 1. Setup Environment
    const subject = "mailto:admin@example.com";
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!publicKey || !privateKey || !supabaseUrl || !supabaseKey) {
      throw new Error("Missing Secrets");
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    // 2. Get Users to Remind (from our SQL RPC)
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_users_to_remind`, {
      method: "POST",
      headers: {
        ApiKey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const userIds = await rpcResponse.json();

    if (!userIds || userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No users to remind right now." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${userIds.length} users to remind.`);

    // 3. For each user, get subscription and send push
    let sentCount = 0;

    const promises = userIds.map(async (userObj: any) => {
      const userId = userObj.user_id;

      // Fetch Subscriptions
      const subRes = await fetch(
        `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=*`,
        {
          headers: {
            ApiKey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      const subs = await subRes.json();
      if (!subs || subs.length === 0) return;

      // Send to all devices
      const devicePromises = subs.map((sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: atob(sub.p256dh),
            auth: atob(sub.auth),
          },
        };

        const payload = JSON.stringify({
          title: "Daily Wordle Reminder ⏰",
          body: "It's 8 PM! Don't forget to set a puzzle for your partner!",
        });

        return webpush.sendNotification(pushSubscription, payload).catch((err) => {
           if (err.statusCode === 410 || err.statusCode === 404) {
             // Cleanup invalid
             fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
               method: "DELETE",
               headers: { ApiKey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
             });
           }
        });
      });

      await Promise.all(devicePromises);
      sentCount++;
    });

    await Promise.all(promises);

    return new Response(
      JSON.stringify({ message: `Reminders sent to ${sentCount} users.` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Reminder Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
