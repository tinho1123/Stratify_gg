// Recebe o webhook do RevenueCat depois que uma compra é validada pela Apple/Google. É a única
// via que credita `premium_credits` de verdade — o client nunca chama isso, só o RevenueCat (via
// esse endpoint) com a service role key, que ignora RLS. Ver `redeem_iap_purchase` na migration
// 032_premium_currency.sql: essa função tem EXECUTE revogado de authenticated/anon de propósito.
//
// Deploy: `supabase functions deploy revenuecat-webhook`
// Depois, configure no painel do RevenueCat (Project Settings > Integrations > Webhooks):
//   URL:                https://<seu-projeto>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header: Bearer <mesmo valor de REVENUECAT_WEBHOOK_SECRET>
// E defina os secrets da function (`supabase secrets set ...`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REVENUECAT_WEBHOOK_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;

// Créditos são compra consumível (não-assinatura); Season Pass é assinatura recorrente — os
// dois passam pelo mesmo endpoint, distinguidos pelo `product_id` do evento.
const CREDIT_EVENT_TYPES = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"]);
const SEASON_PASS_PRODUCT_ID = "stratify_season_pass";
// CANCELLATION não desativa na hora — o usuário mantém acesso até o fim do período já pago,
// que é quando o RevenueCat manda EXPIRATION de verdade.
const SEASON_PASS_ACTIVATE_EVENTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"]);
const SEASON_PASS_DEACTIVATE_EVENTS = new Set(["EXPIRATION"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const event = body?.event;
  const appUserId: string | undefined = event?.app_user_id;
  const productId: string | undefined = event?.product_id;

  if (!event || !appUserId || !productId) {
    return new Response("ignored", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // `app_user_id` é configurado no client como o auth.uid() do Supabase (ver services/revenuecat.ts),
  // então dá pra resolver o time direto por user_id.
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("user_id", appUserId)
    .single();

  if (teamError || !team) {
    console.error("revenuecat-webhook: team not found for app_user_id", appUserId, teamError);
    return new Response("team_not_found", { status: 200 });
  }

  // ── Season Pass (assinatura) ────────────────────────────────────────────────────────────
  if (productId === SEASON_PASS_PRODUCT_ID) {
    if (SEASON_PASS_ACTIVATE_EVENTS.has(event.type)) {
      const expiresAtMs: number | undefined = event.expiration_at_ms;
      const { error } = await supabase.rpc("set_season_pass_active", {
        p_team_id: team.id,
        p_active: true,
        p_renews_at: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
      });
      if (error) {
        console.error("revenuecat-webhook: set_season_pass_active(true) failed", error);
        return new Response("update_failed", { status: 500 });
      }
    } else if (SEASON_PASS_DEACTIVATE_EVENTS.has(event.type)) {
      const { error } = await supabase.rpc("set_season_pass_active", {
        p_team_id: team.id,
        p_active: false,
        p_renews_at: null,
      });
      if (error) {
        console.error("revenuecat-webhook: set_season_pass_active(false) failed", error);
        return new Response("update_failed", { status: 500 });
      }
    }
    return new Response("ok", { status: 200 });
  }

  // ── Créditos (compra consumível) ────────────────────────────────────────────────────────
  if (!CREDIT_EVENT_TYPES.has(event.type)) {
    // Evento que não representa uma compra concluída de créditos (ex. reembolso) — responde
    // 200 pra não gerar retries do RevenueCat, só não credita nada.
    return new Response("ignored", { status: 200 });
  }

  const transactionId: string | undefined = event.transaction_id ?? event.id;
  if (!transactionId) {
    return new Response("missing_fields", { status: 400 });
  }

  const { error: rpcError } = await supabase.rpc("redeem_iap_purchase", {
    p_team_id: team.id,
    p_product_id: productId,
    p_transaction_id: transactionId,
  });

  if (rpcError) {
    console.error("revenuecat-webhook: redeem_iap_purchase failed", rpcError);
    return new Response("redeem_failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
