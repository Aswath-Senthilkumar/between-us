import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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

    // Get users to remind (logic in RPC)
    const { data: userIds, error } = await supabaseClient.rpc("get_users_to_remind");

    if (error) throw error;

    if (!userIds || userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No users to remind" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Invoke notifications function for each user
    const { data: functionData, error: functionError } = await supabaseClient.functions.invoke('notifications', {
      body: {
        userId: userIds[0].user_id, // TODO: Loop through all users
        title: "Daily Reminder ⏰",
        body: "Don't forget to send your daily puzzle!",
      }
    });

    // For better scalability, you'd batch this or queue it. 
    // For now, we just log how many we found.
    console.log(`Found ${userIds.length} users to remind.`);

    // Loop through and notify (simple iteration)
    const results = await Promise.all(
      userIds.map(async (u: { user_id: string }) => {
        return supabaseClient.functions.invoke('notifications', {
          body: {
            userId: u.user_id,
            title: "Daily Reminder ⏰",
            body: "Don't forget to send your daily puzzle!",
          }
        });
      })
    );

    return new Response(JSON.stringify({ message: `Reminders sent to ${results.length} users` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
