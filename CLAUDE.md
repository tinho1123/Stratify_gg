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

## Segurança — Regra de Ouro do Modelo Supabase/RLS

**O client (app) nunca é confiável.** Qualquer pessoa autenticada pode chamar a API REST do
Supabase diretamente (com a `anon key` pública + o próprio JWT), ignorando completamente o
código do app. Isso já causou uma vulnerabilidade real neste projeto (ver
`database/migrations/017_fix_economy_access_control.sql`): o client calculava `budget`,
`pdl`, `wins`, `losses`, `fans` e resultado de partida localmente e gravava direto via
`supabase.from(...).update(...)`, e a policy de RLS só verificava o dono da linha — não
quais colunas nem quais valores. Isso permitia economia infinita e leilões grátis.

**Regras a seguir a partir de agora:**

1. **Nunca escrever campos de economia/ranking direto do client.** Colunas como `budget`,
   `pdl`, `fans`, `wins`, `losses`, `current_bid`, ou qualquer resultado de partida/leilão
   devem ser alteradas **apenas** por funções `SECURITY DEFINER` (RPC via `supabase.rpc(...)`)
   que validam e recalculam o valor no servidor — nunca por
   `supabase.from("tabela").update({...})` vindo de um valor calculado no app.
   Ver `resolve_match` e `place_bid` em `017_fix_economy_access_control.sql`,
   e os padrões já existentes `buy_player_direct` (016) e `generate_next_match` (015).

2. **Toda policy de RLS de `UPDATE`/`INSERT` precisa de `with check`, não só `using`.**
   `using` controla quais linhas são visíveis/afetadas; sem `with check`, nada impede o
   client de sobrescrever qualquer coluna daquela linha com qualquer valor. Ver
   `database/migrations/013_create_tactics.sql` como referência do padrão correto
   (`using` + `with check` idênticos, escopados por `team_id`).

3. **Preferir `GRANT UPDATE (coluna1, coluna2) ON tabela TO authenticated`** (grant
   column-level) em vez de liberar `UPDATE` na tabela inteira, quando só alguns campos
   devem ser editáveis pelo client (ex.: `teams`: cliente só deve poder alterar `name` e
   `onboarded`, nunca `budget`/`pdl`/`wins`/`losses`/`fans`).

4. **Dados puramente cosméticos/de exibição** (ex.: estatísticas de K/D/A por jogador numa
   partida, que só o próprio dono vê) podem continuar sendo calculados no client — não é
   necessário mover tudo para o servidor, só o que afeta saldo, ranking ou outros usuários.

5. **Antes de adicionar uma nova tabela ou coluna que o client escreve diretamente**,
   perguntar: "o que impede um usuário malicioso de chamar a REST API do Supabase direto e
   gravar qualquer valor nessa coluna, ignorando o app?". Se a resposta for "nada", a escrita
   precisa passar por uma função `SECURITY DEFINER`.

## Notas Importantes

- `newArchEnabled: true` — Nova arquitetura do React Native ativada
- React Compiler ativado (`app.json`)
- Typed Routes ativados (experimental) — rotas são type-safe
- Não modificar `scripts/reset-project.js` — utilitário de reset do template Expo
