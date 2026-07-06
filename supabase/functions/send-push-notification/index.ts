// Recebe o Database Webhook do Supabase disparado a cada INSERT em `notifications`, e repassa
// como push notification via Expo Push API pro token salvo desse usuário (push_tokens).
//
// Deploy: `supabase functions deploy send-push-notification`
// Secret:  `supabase secrets set PUSH_WEBHOOK_SECRET=<string aleatória sua>`
//
// Depois, configure no painel do Supabase (Database > Webhooks > Create a new webhook):
//   Table:  notifications | Events: Insert | Type: HTTP Request
//   URL:    https://<seu-projeto>.supabase.co/functions/v1/send-push-notification
//   Header: Authorization: Bearer <mesmo valor de PUSH_WEBHOOK_SECRET>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const record = payload?.record;
  if (!record?.user_id || !record?.message) {
    return new Response("ignored", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: tokenRow } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", record.user_id)
    .single();

  if (!tokenRow?.token) {
    // Usuário nunca concedeu permissão de notificação (ou app ainda não registrou o token) —
    // a notificação já existe dentro do app normalmente, só não vira push.
    return new Response("no_token", { status: 200 });
  }

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      to: tokenRow.token,
      title: record.tag ? String(record.tag) : "Stratify_gg",
      body: record.message,
      sound: "default",
      priority: "high",
    }),
  });

  return new Response("ok", { status: 200 });
});
