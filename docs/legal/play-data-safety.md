# Play Console — Formulário de Segurança dos Dados (Data Safety)

> Este documento é um roteiro pra você preencher o formulário "Data safety" no Play
> Console (Play Console > seu app > Policy > App content > Data safety). Eu não tenho
> acesso ao Play Console pra preencher isso diretamente — mas os valores abaixo refletem
> exatamente o que o código do app coleta hoje. Revise antes de copiar: se você adicionar
> um SDK novo depois, este documento fica desatualizado.

## 1. O app coleta ou compartilha algum dos tipos de dados do usuário?

**Sim.**

## 2. Tipos de dados

### Informações pessoais
| Campo | Coletado? | Compartilhado? | Finalidade | Opcional? |
|---|---|---|---|---|
| E-mail | Sim | Não | Funcionalidade do app (conta), Comunicação com o usuário | Obrigatório (login) |
| Nome do usuário (nome do time) | Sim | Sim — visível a outros usuários no chat/ranking/perfil público | Funcionalidade do app | Obrigatório |

*Senha não entra como "informação pessoal" no formulário do Google — é tratada à parte
como credencial de autenticação, armazenada com hash bcrypt.*

### Mensagens
| Campo | Coletado? | Compartilhado? | Finalidade | Opcional? |
|---|---|---|---|---|
| Outras mensagens no app (chat global + mensagens diretas) | Sim | Sim — mensagens de chat global são visíveis a todos os usuários; mensagens diretas só ao destinatário | Funcionalidade do app | Obrigatório se usar o chat |

### Atividade no app
| Campo | Coletado? | Compartilhado? | Finalidade |
|---|---|---|---|
| Interações no app (ações de gestão do time: escalação, tática, mercado, partidas) | Sim | Não | Funcionalidade do app |
| Histórico de compras no app | Sim | Sim — com RevenueCat (processamento de assinatura/créditos) | Funcionalidade do app, Analytics |

### Informações financeiras
| Campo | Coletado? | Compartilhado? | Finalidade |
|---|---|---|---|
| Histórico de compras | Sim | Sim — RevenueCat, App Store/Google Play | Funcionalidade do app |

*O app nunca coleta dados de cartão de crédito diretamente — isso fica só com a loja de
aplicativos (Apple/Google) e o RevenueCat só recebe a confirmação da transação.*

### Identificadores do dispositivo ou outros
| Campo | Coletado? | Compartilhado? | Finalidade |
|---|---|---|---|
| ID de publicidade (GAID) | Sim | Sim — Google AdMob | Publicidade ou marketing |
| Token de push (Expo) | Sim | Não (fica só no seu backend Supabase, usado só pra enviar notificações) | Funcionalidade do app |

### Informações do app e desempenho
| Campo | Coletado? | Compartilhado? | Finalidade |
|---|---|---|---|
| Logs de falha (crash) | **Não coletado hoje** — não há SDK de crash reporting configurado (ver observação abaixo) | — | — |

## 3. Perguntas de contexto que o formulário vai pedir

- **Os dados são criptografados em trânsito?** Sim — toda comunicação com Supabase, RevenueCat e AdMob usa HTTPS/TLS.
- **O usuário pode solicitar a exclusão dos dados?** Sim — via e-mail de contato (ver Política de Privacidade, Seção 5); considere adicionar exclusão de conta self-service direto no app se ainda não existir, o Google recomenda fortemente pra apps com conta de usuário.
- **A coleta é obrigatória pra usar o app?** E-mail sim (login); anúncios/ID de publicidade não (usuário pode negar tracking no iOS via App Tracking Transparency e ainda usar o app).
- **Essa é uma "Kids app" (Programa Designed for Families)?** Não, a não ser que você decida direcionar o app pra menores de 13 anos — se não for o caso, responda "não" nessa seção.

## 4. Observação importante: sem crash reporting

O app não tem nenhuma ferramenta de monitoramento de erros em produção (Sentry, Bugsnag,
Crashlytics). Isso não bloqueia o formulário do Data Safety (você simplesmente não marca
essa categoria), mas significa que **você não vai saber se o app está travando pra
usuários reais** depois de publicado. Vale considerar adicionar antes do lançamento —
posso implementar se quiser.

## 5. Resumo rápido pra colar no formulário

| SDK | Categoria de dado | Compartilhado com |
|---|---|---|
| Supabase | E-mail, conteúdo gerado (chat, dados de jogo) | Ninguém fora do Supabase (seu backend) |
| Google AdMob | ID de publicidade, dados de dispositivo | Google |
| RevenueCat | Histórico de compras | RevenueCat → repassa confirmação pra App Store/Google Play |
| Expo (push) | Token de notificação | Ninguém — fica só no seu banco |
