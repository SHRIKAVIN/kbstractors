import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-push-secret",
};

type PushBody = {
  title?: string;
  body?: string;
  notification_id?: string;
};

async function sendPushToAllSubscriptions(input: {
  supabaseUrl: string;
  serviceRole: string;
  title: string;
  body: string;
  notificationId?: string;
}) {
  const admin = createClient(input.supabaseUrl, input.serviceRole);
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) throw error;
  if (!subs?.length) {
    return { sent: 0, total: 0, reason: "no subscriptions" as const };
  }

  const pushPayload = JSON.stringify({
    id: input.notificationId,
    title: input.title,
    body: input.body,
    url: "/",
  });

  let sent = 0;
  const stale: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
        { TTL: 60 * 60 * 24, urgency: "high" },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) stale.push(sub.endpoint);
    }
  }

  if (stale.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return { sent, total: subs.length, reason: sent ? undefined : ("delivery failed" as const) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@kbstractors.local";

    if (!vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured on server." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("APP_PUSH_WEBHOOK_SECRET") ?? Deno.env.get("CRON_SECRET");

    const pushSecret = req.headers.get("x-push-secret");
    const authHeader = req.headers.get("Authorization");

    const webhookOk = Boolean(webhookSecret && pushSecret && pushSecret === webhookSecret);
    let userOk = false;

    if (!webhookOk && authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: userErr,
      } = await userClient.auth.getUser();
      userOk = !userErr && Boolean(user);
    }

    if (!webhookOk && !userOk) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as PushBody;
    const title = payload.title?.trim();
    const body = payload.body?.trim();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendPushToAllSubscriptions({
      supabaseUrl,
      serviceRole,
      title,
      body,
      notificationId: payload.notification_id,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
