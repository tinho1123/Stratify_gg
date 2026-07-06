-- Migration 034: Anúncio recompensado (Fase 3 do plano de monetização)
-- Run this AFTER migration 033
--
-- Verificação server-side completa de "o anúncio foi mesmo assistido" exigiria implementar a
-- checagem de assinatura SSV (Server-Side Verification) do AdMob — buscar/cachear a chave
-- pública do Google, reconstruir a query string exata e validar ECDSA. É desproporcional pro
-- valor em jogo aqui (poucos créditos premium cosméticos, sem afetar economia/ranking
-- competitivo — ver regra 4 do CLAUDE.md). Em vez disso, limitamos a exposição com um cooldown
-- aplicado dentro da própria função: no máximo 1 recompensa a cada 4 horas por time, então
-- mesmo alguém chamando essa função direto (sem passar pelo SDK de anúncio) fica limitado a um
-- ganho pequeno e previsível — não uma brecha de economia infinita.

alter table teams add column if not exists last_ad_reward_at timestamptz;

create or replace function grant_ad_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_last    timestamptz;
  v_amount  constant integer := 20;
begin
  select id, last_ad_reward_at into v_team_id, v_last from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  if v_last is not null and v_last > now() - interval '4 hours' then
    raise exception 'cooldown_active';
  end if;

  update teams
    set premium_credits = premium_credits + v_amount,
        last_ad_reward_at = now()
    where id = v_team_id;

  return jsonb_build_object('credits_granted', v_amount);
end;
$$;

grant execute on function grant_ad_reward() to authenticated;
