-- Migration 004: Trigger para criar 5 jogadores iniciais ao cadastrar novo usuário
-- Run this AFTER migration 003

-- Função que gera um inteiro aleatório dentro de um range
create or replace function random_int(low int, high int)
returns int language sql as $$
  select floor(random() * (high - low + 1) + low)::int;
$$;

-- Função principal chamada pelo trigger
create or replace function create_starter_players()
returns trigger language plpgsql security definer as $$
declare
  -- Pool de nomes genéricos de esports
  names text[] := array[
    'Shadow', 'Viper', 'Ghost', 'Reaper', 'Phantom',
    'Storm', 'Blade', 'Nova', 'Raven', 'Cipher',
    'Frost', 'Blaze', 'Echo', 'Jinx', 'Specter'
  ];
  roles text[] := array['IGL', 'AWPer', 'Support', 'Entry', 'Flex'];
  statuses text[] := array['online', 'offline', 'injured'];
  status_weights int[] := array[40, 35, 25]; -- peso: 40% online, 35% offline, 25% injured

  i int;
  chosen_name text;
  chosen_role text;
  chosen_status text;
  rand int;
  new_player_id uuid;

  -- Stats iniciais muito baixos (faixa 20-55)
  v_rating int;
  v_salary int;
  v_age int;
  v_energy int;
  v_morale int;
  v_form int;
  v_kills int;
  v_deaths int;
  v_assists int;
  v_adr numeric(5,2);
begin
  -- Embaralha nomes para não repetir os 5 primeiros sempre
  names := array(select unnest(names) order by random());

  for i in 1..5 loop
    chosen_name   := names[i];
    chosen_role   := roles[i]; -- cada role uma vez

    -- Status ponderado
    rand := random_int(1, 100);
    if rand <= 40 then
      chosen_status := 'online';
    elsif rand <= 75 then
      chosen_status := 'offline';
    else
      chosen_status := 'injured';
    end if;

    -- Stats baixos
    v_rating  := random_int(20, 52);
    v_salary  := random_int(1500, 5000);
    v_age     := random_int(17, 22);
    v_energy  := random_int(15, 50);
    v_morale  := random_int(20, 50);
    v_form    := random_int(18, 48);
    v_kills   := random_int(120, 450);
    v_deaths  := random_int(300, 700);  -- mais deaths do que kills — são ruins
    v_assists := random_int(60, 220);
    v_adr     := (random_int(280, 560) / 10.0)::numeric(5,2); -- 28.0–56.0

    insert into players (
      user_id, name, role, status, rating, salary,
      contract, age, energy, morale, form,
      kills, deaths, assists, adr
    )
    values (
      new.id,
      chosen_name,
      chosen_role,
      chosen_status,
      v_rating,
      v_salary,
      random_int(1, 12) || ' meses',
      v_age,
      v_energy,
      v_morale,
      v_form,
      v_kills,
      v_deaths,
      v_assists,
      v_adr
    )
    returning id into new_player_id;

    -- Skills igualmente baixas (faixa 15-50)
    insert into player_skills (player_id, skill_name, value)
    values
      (new_player_id, 'Mira',              random_int(15, 50)),
      (new_player_id, 'Leitura de Jogo',   random_int(15, 50)),
      (new_player_id, 'Comunicação',       random_int(15, 50)),
      (new_player_id, 'Clutch',            random_int(15, 50)),
      (new_player_id, 'Uso de Utilitários',random_int(15, 50)),
      (new_player_id, 'Posicionamento',    random_int(15, 50));

  end loop;

  return new;
end;
$$;

-- Trigger dispara após inserção em auth.users (novo cadastro)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function create_starter_players();
