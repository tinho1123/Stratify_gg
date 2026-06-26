# Testes E2E — Maestro

## Setup (uma vez só)

```bash
# Instalar Maestro CLI (PowerShell como admin)
iex "$(iwr 'https://get.maestro.mobile.dev' -UseBasicParsing).Content"
```

Verifique:
```bash
maestro --version
```

## Rodar os flows

1. Abra o emulador Android via Android Studio (AVD Manager → Play)
2. Inicie o app com build de desenvolvimento:

```bash
npx expo run:android
```

3. Em outro terminal, rode os flows na ordem:

```bash
# Fluxo de login
maestro test e2e/01_login.yaml

# Dashboard
maestro test e2e/02_dashboard.yaml

# Matches
maestro test e2e/03_matches.yaml

# Market
maestro test e2e/04_market.yaml

# Training
maestro test e2e/05_training.yaml

# Suite completa
maestro test e2e/
```

## Notas

- Os flows usam `appId: com.stratify.app` — ajuste se seu `app.json` tiver outro bundleId
- Maestro detecta o emulador automaticamente
- Use `maestro studio` para gravar flows clicando na tela
