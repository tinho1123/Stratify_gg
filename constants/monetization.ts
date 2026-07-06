// Product IDs precisam bater exatamente com o que é cadastrado na App Store Connect / Google
// Play Console e importado no RevenueCat. Os 4 de crédito também precisam bater com
// `credit_products.product_id` (database/migrations/032_premium_currency.sql) — é essa tabela
// que decide quantos créditos cada um concede, nunca o client.
export const CREDIT_PRODUCT_IDS = [
  "stratify_credits_small",
  "stratify_credits_medium",
  "stratify_credits_large",
  "stratify_credits_mega",
] as const;

export const SEASON_PASS_PRODUCT_ID = "stratify_season_pass";
