# Stratify

Aplicativo mobile de gestão esportiva/esports, construído com **Expo + React Native +
TypeScript**, backend em **Supabase**. Você administra um time virtual de esports:
monta o elenco, define tática, disputa partidas simuladas, sobe de elo em temporadas,
negocia jogadores no mercado e interage com outros jogadores via chat.

## Stack técnica

- **Framework**: Expo (v54) com Expo Router (file-based routing)
- **UI**: React Native 0.81 + NativeWind v5
- **Linguagem**: TypeScript (strict mode, alias `@/*`)
- **Backend**: Supabase (Postgres + Auth + Row Level Security + Edge Functions)
- **Monetização**: RevenueCat (assinatura Season Pass + créditos premium) e Google AdMob (anúncios recompensados)
- **Notificações**: Expo Notifications + Supabase Edge Function
- **i18n**: pt-BR / en, com detecção automática por região
- **Testes**: Jest (unitário) + Maestro (E2E)

## Funcionalidades

- **Gestão de time**: elenco, orçamento, tática, treino
- **Partidas**: partidas normais, ao vivo, desafios entre times
- **Temporadas/liga**: elo (Bronze → Grão-Mestre), classificação, Season Pass com trilha gratuita e premium
- **Torneios**: chaveamento eliminatório
- **Mercado**: compra direta e leilão de jogadores, agentes livres
- **Loja**: cosméticos e créditos premium (RevenueCat)
- **Chat**: chat global e mensagens diretas entre times, com denúncia e bloqueio de usuário
- **Ranking, conquistas e perfil público de time**
- **Feature flags** remotas (liga/torneio/chat podem ser habilitados por etapa)

## Estrutura do projeto

```
app/                    # Rotas (Expo Router)
  login/                # Autenticação (Supabase)
  setup/                # Onboarding (criação do time)
  dashboard/             # App principal
    manage_team/         training/         market/
    matches/              tactics/          store/
    messages/             team/             chat.tsx
    achievements.tsx      ranking.tsx       profile.tsx
components/ui/          # Componentes reutilizáveis do design system
constants/               # Tema, tiers de elo, produtos de monetização
database/
  supabase.ts            # Cliente Supabase
  migrations/             # Migrations SQL (ordem sequencial, ver convenção abaixo)
  seed.ts                 # Popula times/jogadores fake pra desenvolvimento
i18n/                    # Traduções pt/en
services/                # RevenueCat, push notifications
supabase/functions/      # Edge Functions (webhook RevenueCat, push)
e2e/                     # Flows Maestro
__tests__/               # Testes unitários (Jest)
docs/legal/              # Política de Privacidade, Termos de Uso, Data Safety
```

## Como rodar

```bash
npm install
cp .env.example .env      # preencha as chaves (ver abaixo)
npx expo start
```

No terminal do Metro: `a` abre no emulador/dispositivo Android, `i` no simulador iOS.
Este projeto usa **dev client** (não Expo Go) por causa dos módulos nativos
(`react-native-google-mobile-ads`, `expo-tracking-transparency`, `react-native-purchases`).
Pra rodar num emulador/dispositivo pela primeira vez:

```bash
npx expo prebuild
npx expo run:android   # ou run:ios
```

Sempre que adicionar/atualizar um pacote com código nativo, repita esses dois comandos —
recarregar o Metro sozinho não injeta código nativo novo no app já instalado.

### Variáveis de ambiente (`.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# RevenueCat — sem isso, loja de créditos e Season Pass ficam em modo "em breve"
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=

# AdMob — sem isso, usa os IDs de teste do Google (ok pra dev, trocar antes de publicar)
EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID=
EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID=
```

### Banco de dados

As migrations em `database/migrations/` são numeradas e devem rodar em ordem, direto no
SQL Editor do Supabase (ou via CLI). Pra popular o banco com times/jogadores fake:

```bash
npm run seed
```

## Testes

```bash
npm test              # Jest (unitário)
npm run test:coverage

npm run e2e           # todos os flows Maestro (precisa de emulador/dispositivo conectado)
npm run e2e:login     # um flow específico
```

## Segurança

O client nunca é confiável: qualquer valor que afete economia, ranking ou outro usuário
(orçamento, PDL, resultado de partida, lance de leilão etc.) só pode ser escrito por
funções `SECURITY DEFINER` no Postgres, nunca por `UPDATE` direto vindo do app. Ver
[CLAUDE.md](CLAUDE.md) pra detalhes do modelo de RLS adotado neste projeto.

## Documentos legais

Política de Privacidade, Termos de Uso e o levantamento de dados pro formulário de Data
Safety da Play Store estão em [`docs/legal/`](docs/legal/) — preencha os campos
`[PREENCHER]` antes de publicar.
