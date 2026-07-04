# CLAUDE.md — Stratify_gg

## Visão Geral do Projeto

Aplicativo mobile de gestão esportiva/esports chamado **Stratify_gg**, construído com **Expo + React Native + TypeScript**.

## Stack Técnica

- **Framework**: Expo (v54) com Expo Router (file-based routing)
- **UI**: React Native 0.81.5 + NativeWind v5 (utilitários CSS-like)
- **Linguagem**: TypeScript (strict mode, alias `@/*`)
- **Backend**: Supabase (auth + banco de dados) — cliente em `database/supabase.ts`
- **Navegação**: Expo Router com tabs e stacks aninhados
- **Animações**: React Native Reanimated v4
- **Persistência local**: AsyncStorage

## Estrutura de Diretórios

```
app/                    # Rotas (file-based routing do Expo Router)
  _layout.tsx           # Root layout — Stack + DarkTheme, rota inicial: login
  login/                # Tela de login (autenticação via Supabase)
  dashboard/            # App principal com tabs
    index.tsx           # Home do dashboard
    manage_team/        # Gerenciamento de time
    training/           # Módulo de treino
    market/             # Módulo de mercado
components/
  ui/                   # Componentes reutilizáveis (cards, ícones, etc.)
constants/
  theme.ts              # Cores e tipografia
database/
  supabase.ts           # Inicialização do cliente Supabase
hooks/                  # Hooks customizados (tema, color scheme)
assets/images/          # Imagens e ícones
```

## Fluxo de Navegação

1. Root layout inicia na rota `login`
2. Login bem-sucedido → redireciona para `dashboard`
3. Dashboard usa tabs: `manage_team`, `training`, `market`

## Comandos de Desenvolvimento

```bash
npm install          # Instalar dependências
npx expo start       # Iniciar servidor de desenvolvimento
npx expo start --android
npx expo start --ios
npx expo start --web
```

## Convenções do Projeto

- **Tema**: Dark mode como padrão (`DarkTheme` do React Navigation)
- **Estilização**: NativeWind (classes utilitárias estilo Tailwind) — evite `StyleSheet.create` salvo onde necessário
- **Tipagem**: TypeScript strict — sempre tipar props e retornos
- **Alias de importação**: Usar `@/` para importações absolutas (ex: `@/components/ui/TeamCard`)
- **Plataforma**: Variantes platform-specific usam sufixo `.ios.tsx` ou `.web.ts`
- **Componentes**: Funcionais com hooks — sem class components

## Backend (Supabase)

- Cliente inicializado em `database/supabase.ts`
- Autenticação via `@supabase/supabase-js` + AsyncStorage para persistência de sessão
- Usar `supabase.auth` para operações de autenticação
- Usar `supabase.from(...)` para queries de banco de dados

## Notas Importantes

- `newArchEnabled: true` — Nova arquitetura do React Native ativada
- React Compiler ativado (`app.json`)
- Typed Routes ativados (experimental) — rotas são type-safe
- Não modificar `scripts/reset-project.js` — utilitário de reset do template Expo
