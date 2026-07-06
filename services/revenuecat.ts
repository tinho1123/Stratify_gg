import { CREDIT_PRODUCT_IDS, SEASON_PASS_PRODUCT_ID } from "@/constants/monetization";
import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

// Chaves públicas do SDK do RevenueCat (uma por plataforma) — vêm do painel do RevenueCat
// (Project Settings > API Keys) depois de criar o app lá e conectar com App Store Connect /
// Google Play Console. Enquanto essas envs não existirem, a loja funciona em modo "sem
// configuração": o catálogo de cosméticos (pago com créditos já existentes) continua ok, só a
// compra de créditos novos fica indisponível.
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

let configured = false;

export function isRevenueCatConfigured(): boolean {
  return !!(Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY);
}

// Chamado uma vez, quando existe uma sessão autenticada (ver app/_layout.tsx). `appUserId` é o
// auth.uid() do Supabase — usar o mesmo id dos dois lados é o que permite o webhook do
// RevenueCat (supabase/functions/revenuecat-webhook) resolver de volta pra qual time creditar,
// sem o client precisar informar isso em nenhuma chamada.
export function configureRevenueCat(appUserId: string): void {
  const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;
  if (!apiKey) return;
  if (configured) return;
  Purchases.configure({ apiKey, appUserID: appUserId });
  configured = true;
}

// Pacotes de créditos disponíveis pra compra, com preço já localizado (string formatada pela
// própria loja pro país do usuário — nunca calculamos conversão de moeda no app).
export async function getCreditPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return packages.filter((p) => (CREDIT_PRODUCT_IDS as readonly string[]).includes(p.product.identifier));
}

// Pacote de assinatura do Season Pass — mesma Offering do RevenueCat, produto diferente.
export async function getSeasonPassPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return packages.find((p) => p.product.identifier === SEASON_PASS_PRODUCT_ID) ?? null;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<void> {
  await Purchases.purchasePackage(pkg);
  // A concessão em si (créditos ou ativação do Season Pass) acontece no servidor (webhook do
  // RevenueCat -> Edge Function -> RPC), de forma assíncrona — o chamador deve reconsultar o
  // time depois de um curto intervalo em vez de assumir que já foi aplicado nesse ponto.
}

// Exigido pela App Store Review Guideline 3.1.1 pra qualquer app com IAP/assinatura: precisa
// existir uma forma de restaurar compras sem recomprar. O RevenueCat reprocessa o histórico de
// compras da App Store/Play Store e reenvia os webhooks que ainda não foram creditados — a
// concessão em si segue acontecendo do lado do servidor, igual toda outra compra.
export async function restorePurchases(): Promise<void> {
  if (!configured) return;
  await Purchases.restorePurchases();
}
