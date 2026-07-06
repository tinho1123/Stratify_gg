# Política de Privacidade — Stratify

**Última atualização:** 06/07/2026

Esta Política de Privacidade descreve como o **Stratify** ("nós", "aplicativo", "app")
coleta, usa, armazena e compartilha dados pessoais dos usuários ("você"), em conformidade
com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD) e, para usuários fora do
Brasil, com os princípios do GDPR quando aplicável.

## 1. Quem somos

O Stratify é desenvolvido e operado por Wellington Carvalho da Cunha Filho
(carvalho.cwell@gmail.com). Para qualquer dúvida sobre esta política ou sobre seus
dados pessoais, entre em contato pelo e-mail acima.

## 2. Quais dados coletamos

### 2.1 Dados de conta

- **E-mail e senha**, fornecidos no cadastro. A senha é armazenada com hash bcrypt — nem
  a própria equipe do Stratify tem acesso a ela em texto puro.
- **Identificador único de usuário** (gerado pelo Supabase Auth, nosso provedor de
  autenticação e banco de dados).
- **Idioma preferido** e outras preferências de conta.

### 2.2 Dados de jogo

- Nome do time, orçamento virtual, elenco de jogadores, táticas, estatísticas de partidas,
  posição na classificação (ranking/PDL), conquistas e itens cosméticos.
- Esses dados existem apenas para o funcionamento do jogo e não têm valor fora dele.

### 2.3 Conteúdo gerado por você

- Mensagens enviadas no **chat global**, no **chat por elo/tier** e em **mensagens
  diretas** entre times. Esse conteúdo pode ficar visível para outros usuários do
  Stratify, conforme a natureza do canal (chat global e por elo são públicos entre
  jogadores; mensagens diretas são privadas entre os times envolvidos).
- O nome do seu time e estatísticas públicas (posição na liga, vitórias/derrotas) podem
  ficar visíveis para outros jogadores nas telas de classificação/perfil público de time.

### 2.4 Identificadores de publicidade e anúncios

- Quando você assiste a um anúncio em vídeo recompensado, nosso parceiro de anúncios
  (Google AdMob) pode coletar o **identificador de publicidade do dispositivo** (GAID no
  Android, IDFA no iOS) e dados técnicos do dispositivo, para exibir e medir anúncios.
- No iOS, pedimos sua permissão explícita via App Tracking Transparency antes de
  qualquer rastreamento para fins publicitários — você pode negar essa permissão a
  qualquer momento nas configurações do seu iPhone, e ainda assim usar o app normalmente
  (anúncios não personalizados continuam disponíveis).

### 2.5 Dados de compra

- Se você compra créditos premium ou assina o Season Pass, o processamento é feito pela
  App Store/Google Play e pelo **RevenueCat**, nosso provedor de gestão de assinaturas.
  Recebemos do RevenueCat a confirmação da compra e o status da assinatura — nunca os
  dados do seu cartão de crédito, que ficam só com a loja de aplicativos.

### 2.6 Notificações push

- Se você permitir notificações, coletamos um **token de push** (gerado pela Expo) para
  enviar avisos sobre partidas, leilões e eventos do jogo. Você pode desativar isso a
  qualquer momento nas configurações do seu dispositivo.

### 2.7 Dados técnicos

- Tipo de dispositivo, sistema operacional e informações de diagnóstico básicas,
  coletadas automaticamente pelos SDKs listados acima para o funcionamento do app.

## 3. Para que usamos esses dados

| Finalidade                                                     | Base legal (LGPD)                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Criar e gerenciar sua conta e progresso no jogo                | Execução de contrato (art. 7º, V)                                     |
| Exibir chat, classificação e perfil de time a outros jogadores | Execução de contrato                                                  |
| Processar compras e assinaturas                                | Execução de contrato                                                  |
| Enviar notificações sobre o jogo                               | Consentimento (art. 7º, I)                                            |
| Exibir anúncios e medir seu desempenho                         | Consentimento (App Tracking Transparency no iOS) / Legítimo interesse |
| Prevenir fraude, abuso e moderar conteúdo do chat              | Legítimo interesse (art. 7º, IX)                                      |

## 4. Com quem compartilhamos seus dados

Não vendemos seus dados pessoais. Compartilhamos apenas com prestadores de serviço
necessários para o funcionamento do app, cada um sujeito à própria política de
privacidade:

- **Supabase** — hospedagem do banco de dados e autenticação.
- **Google AdMob** — exibição e medição de anúncios.
- **RevenueCat** — gestão de compras e assinaturas dentro do app.
- **Expo (push notifications)** — envio de notificações.
- **Apple App Store / Google Play** — processamento de pagamento das compras dentro do
  app (o Stratify nunca recebe seus dados de cartão).

Também podemos divulgar dados quando exigido por lei, ordem judicial ou para proteger
direitos, segurança ou propriedade do Stratify e de seus usuários.

## 5. Seus direitos (LGPD, art. 18)

Você pode, a qualquer momento, solicitar:

- confirmação da existência de tratamento dos seus dados;
- acesso, correção ou atualização dos seus dados;
- anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em
  desconformidade com a lei;
- portabilidade dos seus dados a outro fornecedor;
- eliminação dos dados tratados com base no seu consentimento;
- revogação do consentimento e informação sobre as consequências dessa revogação.

Para exercer qualquer um desses direitos, entre em contato pelo e-mail informado na
Seção 1. Você também pode excluir sua conta diretamente pelo app, quando disponível, ou
solicitando por e-mail — nesse caso apagamos seus dados de conta e jogo, exceto o que
formos obrigados a reter por lei (ex.: registros fiscais de compras).

## 6. Retenção de dados

Mantemos seus dados enquanto sua conta estiver ativa. Se você excluir sua conta,
removemos os dados pessoais em até 30 dias, salvo obrigação
legal de retenção por prazo maior (ex.: dados fiscais de compras).

## 7. Segurança

Usamos controles de acesso a nível de banco de dados (Row Level Security) para garantir
que cada usuário só acesse os próprios dados de jogo, e hashing bcrypt para senhas.
Nenhum sistema é 100% livre de risco, mas adotamos práticas de mercado para proteger
suas informações.

## 8. Menores de idade

O Stratify não é direcionado a menores de 16 anos. Se tomarmos conhecimento de que coletamos dados de uma criança abaixo
dessa idade sem consentimento verificável dos pais/responsáveis, apagaremos esses dados.

## 9. Alterações nesta política

Podemos atualizar esta política periodicamente. Mudanças relevantes serão comunicadas
dentro do app ou por e-mail antes de entrarem em vigor.

## 10. Contato

Dúvidas, solicitações ou reclamações sobre esta política: carvalho.cwell@gmail.com.

---

# Privacy Policy — Stratify (English)

**Last updated:** [FILL IN PUBLISH DATE]

This Privacy Policy explains how **Stratify** ("we", "the app") collects, uses, stores
and shares personal data, in line with Brazil's LGPD and, where applicable, GDPR
principles.

## 1. Who we are

Stratify is developed and operated by [FILL IN: owner/company name]
([FILL IN: contact email]). Contact us at the address above for any question about this
policy or your personal data.

## 2. What we collect

- **Account data**: email and password (stored as a bcrypt hash — never in plain text),
  a unique user ID (via Supabase Auth), and your language preference.
- **Game data**: team name, virtual budget, roster, tactics, match stats, league ranking,
  achievements and cosmetics — used only for gameplay, with no value outside the app.
- **User-generated content**: messages in global chat, tier chat and direct messages
  between teams. Global/tier chat is visible to other players; direct messages are
  private between the teams involved. Your team name and public stats (league rank,
  wins/losses) may be visible to other players.
- **Advertising identifiers**: when you watch a rewarded ad, Google AdMob may collect
  your device's advertising ID (GAID on Android, IDFA on iOS) and basic device info to
  serve and measure ads. On iOS we request App Tracking Transparency permission first —
  you can deny it and keep using the app with non-personalized ads.
- **Purchase data**: purchases and subscriptions are processed by the App Store/Google
  Play and by **RevenueCat**; we only receive purchase confirmation and subscription
  status, never your payment card details.
- **Push token**: if you allow notifications, we collect an Expo push token to send
  match/auction/event alerts. You can disable this in your device settings at any time.
- **Basic technical data**: device type and OS, collected automatically by the SDKs
  above.

## 3. Why we use it

Account/game data to run your account and gameplay; chat/ranking data to display it to
other players; purchase data to grant what you bought; push token to send opt-in
notifications; advertising ID (with consent on iOS) to serve and measure ads; and
aggregate technical data to prevent fraud/abuse and moderate chat content.

## 4. Who we share it with

We do not sell your personal data. We share only what's needed with: **Supabase**
(database/auth hosting), **Google AdMob** (ads), **RevenueCat** (subscription
management), **Expo** (push notifications), and the **Apple App Store / Google Play**
(payment processing — Stratify never receives your card details). We may also disclose
data when required by law or to protect the rights, safety or property of Stratify and
its users.

## 5. Your rights

You may request confirmation of processing, access, correction, anonymization, blocking
or deletion of unnecessary/non-compliant data, data portability, deletion of data based
on consent, and withdrawal of consent — contact us at the email in Section 1. You may
also delete your account in-app (where available) or by emailing us; we then delete your
account/game data except what we're legally required to retain (e.g. purchase tax
records).

## 6. Data retention

We keep your data while your account is active. If you delete your account, we remove
personal data within [FILL IN: e.g. 30 days], except where longer legal retention
applies.

## 7. Security

We use database-level Row Level Security so each user can only access their own game
data, plus bcrypt password hashing. No system is 100% risk-free, but we follow
market-standard practices to protect your information.

## 8. Children

Stratify is not directed at children under [FILL IN: 13 or 16, per your minimum age
policy]. If we learn we've collected data from a child under that age without verifiable
parental consent, we will delete it.

## 9. Changes to this policy

We may update this policy periodically. Material changes will be communicated in-app or
by email before taking effect.

## 10. Contact

Questions, requests or complaints about this policy: [FILL IN: contact email].
