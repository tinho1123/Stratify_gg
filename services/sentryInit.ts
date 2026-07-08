import * as Sentry from "@sentry/react-native";

// Sem essa env configurada, o Sentry fica desativado — mesmo padrão já usado pro RevenueCat
// e pro AdMob (services/revenuecat.ts, services/ads.ts): o app nunca deve quebrar por falta
// de uma env pública, só perde o reporting.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(): void {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: 0.2,
  });
}

// HOC que envolve o componente raiz com um error boundary do Sentry, reportando erros de
// render não tratados (promise rejections não tratadas já são capturadas automaticamente
// pelas integrações padrão do SDK, sem precisar de configuração extra).
export const wrapRootComponent = Sentry.wrap;
