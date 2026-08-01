// Supabase Edge Function: send-push
// Triggers Web Push notifications to registered browser endpoints when a new alert is generated.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  urgency: "Critical" | "Warning" | "Advisory" | "Info";
  location?: string;
  url?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "PLACEHOLDER_VAPID_PRIVATE_KEY";
    const vapidPublicKey = Deno.env.get("VITE_VAPID_PUBLIC_KEY") || Deno.env.get("VAPID_PUBLIC_KEY") || "PLACEHOLDER_VAPID_PUBLIC_KEY";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushPayload = await req.json();
    console.log("[send-push] Received push broadcast request payload:", JSON.stringify(payload));

    // 1. Fetch all registered active push subscriptions
    console.log("[send-push] Step 1: Fetching active push subscriptions from `push_subscriptions` table...");
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (error) {
      console.error("[send-push] Error fetching push subscriptions:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`[send-push] Found ${subscriptions?.length || 0} active push subscriptions in database.`);

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[send-push] No active push subscriptions found in database.");
      return new Response(
        JSON.stringify({ success: true, deliveredCount: 0, message: "No active push subscriptions found." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationData = JSON.stringify({
      title: payload.title || "🚨 Emergency Alert",
      body: payload.body || "New disaster response alert issued for your region.",
      urgency: payload.urgency || "Critical",
      location: payload.location || "Regional Area",
      url: payload.url || "/",
      timestamp: new Date().toISOString(),
    });

    let deliveredCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];

    // 2. Dispatch push message to each subscriber endpoint
    console.log("[send-push] Step 2: Dispatching push notification to subscribers...");
    for (const sub of subscriptions) {
      try {
        const subJson = typeof sub.subscription_json === "string" 
          ? JSON.parse(sub.subscription_json) 
          : sub.subscription_json;

        if (!subJson || !subJson.endpoint) {
          console.warn("[send-push] Invalid subscription object missing endpoint:", sub.id || sub.user_id);
          continue;
        }

        console.log(`[send-push] Dispatching push to user: "${sub.user_id || 'anon'}" | Endpoint: ${subJson.endpoint.slice(0, 45)}...`);

        const pushResponse = await fetch(subJson.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400", // 24 hours TTL for emergency alerts
            "Urgency": payload.urgency === "Critical" ? "high" : "normal",
          },
          body: notificationData,
        });

        if (pushResponse.ok || pushResponse.status === 201 || pushResponse.status === 202) {
          deliveredCount++;
          console.log(`[send-push] ✅ Push delivered successfully to endpoint (Status: ${pushResponse.status})`);
        } else if (pushResponse.status === 410 || pushResponse.status === 404) {
          console.warn(`[send-push] ⚠️ Subscription EXPIRED or UNREGISTERED (Status ${pushResponse.status}) for endpoint: ${sub.endpoint}`);
          expiredEndpoints.push(sub.endpoint);
          failedCount++;
        } else {
          console.warn(`[send-push] ⚠️ Push delivery returned non-OK status ${pushResponse.status}`);
          failedCount++;
        }
      } catch (err: any) {
        console.error(`[send-push] ❌ Exception sending push to endpoint ${sub.endpoint}:`, err?.message || err);
        failedCount++;
      }
    }

    // 3. Clean up expired subscriptions from Supabase
    if (expiredEndpoints.length > 0) {
      console.log(`[send-push] Step 3: Automatically cleaning up ${expiredEndpoints.length} expired subscriptions...`);
      const { error: delError } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);

      if (delError) {
        console.error("[send-push] Error removing expired subscriptions:", delError);
      } else {
        console.log(`[send-push] Successfully removed ${expiredEndpoints.length} expired subscription records.`);
      }
    }

    console.log(`[send-push] Broadcast complete summary: Delivered=${deliveredCount}, Failed=${failedCount}, CleanedExpired=${expiredEndpoints.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        deliveredCount,
        failedCount,
        totalSubscribers: subscriptions.length,
        cleanedExpiredCount: expiredEndpoints.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Fatal error in send-push function:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
