alter table public.plataformas
  add column if not exists modo_recebimento text not null default 'instantaneo',
  add column if not exists conta_destino_id bigint,
  add column if not exists tipos_saque_disponiveis text[] not null
    default array['instantaneo', 'agendado', 'outro']::text[],
  add column if not exists tipo_saque_padrao text not null default 'instantaneo',
  add column if not exists ultimo_ciclo_liquidado_inicio date,
  add column if not exists ultimo_ciclo_liquidado_fim date;

alter table public.plataformas
  drop constraint if exists plataformas_dia_recebimento_automatico_check,
  drop constraint if exists plataformas_modo_recebimento_check,
  add constraint plataformas_modo_recebimento_check
    check (modo_recebimento in ('instantaneo', 'retido')),
  drop constraint if exists plataformas_conta_destino_id_fkey,
  add constraint plataformas_conta_destino_id_fkey
    foreign key (conta_destino_id) references public.contas(id),
  drop constraint if exists plataformas_tipo_saque_padrao_check,
  add constraint plataformas_tipo_saque_padrao_check
    check (tipo_saque_padrao in ('instantaneo', 'agendado', 'outro')),
  drop constraint if exists plataformas_tipos_saque_disponiveis_check,
  add constraint plataformas_tipos_saque_disponiveis_check
    check (
      tipos_saque_disponiveis <@ array['instantaneo', 'agendado', 'outro']::text[]
    ),
  drop constraint if exists plataformas_tipo_saque_padrao_disponivel_check,
  add constraint plataformas_tipo_saque_padrao_disponivel_check
    check (
      cardinality(tipos_saque_disponiveis) = 0
      or tipo_saque_padrao = any(tipos_saque_disponiveis)
    );

update public.plataformas
set dia_recebimento_automatico = 1
where dia_recebimento_automatico is null
   or dia_recebimento_automatico not between 1 and 7;

alter table public.plataformas
  add constraint plataformas_dia_recebimento_automatico_check
    check (dia_recebimento_automatico between 1 and 7);

update public.plataformas
set
  modo_recebimento = coalesce(modo_recebimento, 'instantaneo'),
  conta_destino_id = coalesce(
    conta_destino_id,
    (
      select id
      from public.contas
      where ativo = true
        and principal = true
        and coalesce(tipo_conta, 'banco') = 'banco'
      order by id
      limit 1
    )
  ),
  dia_recebimento_automatico = coalesce(dia_recebimento_automatico, 1);

alter table public.entrada_plataformas
  add column if not exists destino_financeiro text,
  add column if not exists conta_destino_id bigint,
  add column if not exists ciclo_operacional_inicio date,
  add column if not exists ciclo_operacional_fim date;

alter table public.entrada_plataformas
  drop constraint if exists entrada_plataformas_destino_financeiro_check,
  add constraint entrada_plataformas_destino_financeiro_check
    check (destino_financeiro in ('conta', 'plataforma')),
  drop constraint if exists entrada_plataformas_conta_destino_id_fkey,
  add constraint entrada_plataformas_conta_destino_id_fkey
    foreign key (conta_destino_id) references public.contas(id);

update public.entrada_plataformas ep
set
  destino_financeiro = 'conta',
  conta_destino_id = e.conta_id,
  ciclo_operacional_inicio = e.data - ((extract(isodow from e.data)::integer) - 1),
  ciclo_operacional_fim = e.data + (7 - extract(isodow from e.data)::integer)
from public.entradas e
where e.id = ep.entrada_id
  and ep.destino_financeiro is null;

alter table public.entrada_plataformas
  alter column destino_financeiro set not null;

alter table public.transferencias
  add column if not exists entrada_plataforma_id bigint,
  add column if not exists ciclo_operacional_inicio date,
  add column if not exists ciclo_operacional_fim date;

alter table public.transferencias
  drop constraint if exists transferencias_entrada_plataforma_id_fkey,
  add constraint transferencias_entrada_plataforma_id_fkey
    foreign key (entrada_plataforma_id)
    references public.entrada_plataformas(id)
    on delete cascade;

create unique index if not exists transferencias_entrada_plataforma_id_unique
  on public.transferencias (entrada_plataforma_id)
  where entrada_plataforma_id is not null;

create unique index if not exists transferencias_ciclo_plataforma_unique
  on public.transferencias (plataforma_id, ciclo_operacional_fim)
  where tipo = 'recebimento_automatico_plataforma';

create or replace function public.ciclo_operacional_da_data(p_data date)
returns table (inicio date, fim date)
language sql
immutable
set search_path = public
as $$
  select
    p_data - (extract(isodow from p_data)::integer - 1),
    p_data + (7 - extract(isodow from p_data)::integer);
$$;

create or replace function public.ultimo_ciclo_devido(
  p_data_referencia date,
  p_dia_pagamento smallint
)
returns table (inicio date, fim date, data_pagamento date)
language sql
immutable
set search_path = public
as $$
  with pagamento as (
    select p_data_referencia - (
      (extract(isodow from p_data_referencia)::integer - p_dia_pagamento + 7) % 7
    ) as data_pagamento
  )
  select
    pagamento.data_pagamento - p_dia_pagamento - 6,
    pagamento.data_pagamento - p_dia_pagamento,
    pagamento.data_pagamento
  from pagamento;
$$;

create or replace function public.saldo_retido_plataforma(
  p_plataforma_id bigint,
  p_limite_ganhos date default null,
  p_limite_transferencias date default null
)
returns numeric
language sql
stable
set search_path = public
as $$
  select round(
    coalesce((
      select sum(coalesce(ep.faturamento, 0) + coalesce(ep.valor_reembolso, 0))
      from public.entrada_plataformas ep
      join public.entradas e on e.id = ep.entrada_id
      where ep.plataforma_id = p_plataforma_id
        and ep.destino_financeiro = 'plataforma'
        and (p_limite_ganhos is null or e.data <= p_limite_ganhos)
    ), 0)
    - coalesce((
      select sum(coalesce(t.valor_bruto, t.valor, 0))
      from public.transferencias t
      where t.plataforma_id = p_plataforma_id
        and t.tipo in ('saque_plataforma', 'recebimento_automatico_plataforma')
        and (p_limite_transferencias is null or t.data <= p_limite_transferencias)
    ), 0),
    2
  );
$$;

create or replace function public.processar_recebimento_automatico_plataforma(
  p_plataforma_id bigint,
  p_data_referencia date default current_date
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_plataforma public.plataformas%rowtype;
  v_ciclo_inicio date;
  v_ciclo_fim date;
  v_data_pagamento date;
  v_proximo_fim date;
  v_valor numeric(12, 2);
  v_processados integer := 0;
begin
  select *
  into v_plataforma
  from public.plataformas
  where id = p_plataforma_id
  for update;

  if not found
    or v_plataforma.modo_recebimento <> 'retido'
    or v_plataforma.conta_destino_id is null
    or v_plataforma.dia_recebimento_automatico is null then
    return 0;
  end if;

  select inicio, fim, data_pagamento
  into v_ciclo_inicio, v_ciclo_fim, v_data_pagamento
  from public.ultimo_ciclo_devido(
    coalesce(p_data_referencia, current_date),
    v_plataforma.dia_recebimento_automatico
  );

  v_proximo_fim := coalesce(
    v_plataforma.ultimo_ciclo_liquidado_fim + 7,
    v_ciclo_fim
  );

  while v_proximo_fim <= v_ciclo_fim loop
    v_ciclo_inicio := v_proximo_fim - 6;
    v_data_pagamento := v_proximo_fim + v_plataforma.dia_recebimento_automatico;

    select greatest(
      public.saldo_retido_plataforma(
        p_plataforma_id,
        v_proximo_fim,
        v_data_pagamento
      ),
      0
    )
    into v_valor;

    if v_valor > 0 then
      insert into public.transferencias (
        data,
        conta_origem_id,
        conta_destino_id,
        valor,
        valor_bruto,
        descricao,
        tipo,
        plataforma_id,
        ciclo_operacional_inicio,
        ciclo_operacional_fim
      ) values (
        v_data_pagamento,
        null,
        v_plataforma.conta_destino_id,
        v_valor,
        v_valor,
        'Recebimento automático da plataforma ' || v_plataforma.nome,
        'recebimento_automatico_plataforma',
        p_plataforma_id,
        v_ciclo_inicio,
        v_proximo_fim
      )
      on conflict (plataforma_id, ciclo_operacional_fim)
        where tipo = 'recebimento_automatico_plataforma'
      do nothing;
    end if;

    update public.plataformas
    set
      ultimo_ciclo_liquidado_inicio = v_ciclo_inicio,
      ultimo_ciclo_liquidado_fim = v_proximo_fim
    where id = p_plataforma_id;

    v_processados := v_processados + 1;
    v_proximo_fim := v_proximo_fim + 7;
  end loop;

  return v_processados;
end;
$$;

create or replace function public.processar_recebimentos_automaticos(
  p_data_referencia date default current_date
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_plataforma_id bigint;
  v_total integer := 0;
begin
  for v_plataforma_id in
    select id
    from public.plataformas
    where modo_recebimento = 'retido'
      and conta_destino_id is not null
      and dia_recebimento_automatico is not null
  loop
    v_total := v_total + public.processar_recebimento_automatico_plataforma(
      v_plataforma_id,
      coalesce(p_data_referencia, current_date)
    );
  end loop;

  return v_total;
end;
$$;

create or replace function public.configurar_financeiro_plataforma(
  p_plataforma_id bigint,
  p_modo_recebimento text,
  p_conta_destino_id bigint,
  p_dia_recebimento_automatico smallint,
  p_taxa_saque_instantaneo numeric,
  p_taxa_saque_agendado numeric,
  p_tipos_saque_disponiveis text[],
  p_tipo_saque_padrao text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_modo_anterior text;
  v_ciclo_inicio date;
  v_ciclo_fim date;
  v_data_pagamento date;
begin
  if p_modo_recebimento not in ('instantaneo', 'retido') then
    raise exception 'Modo de recebimento inválido.';
  end if;

  if p_conta_destino_id is null or not exists (
    select 1
    from public.contas
    where id = p_conta_destino_id
      and ativo = true
      and coalesce(tipo_conta, 'banco') = 'banco'
  ) then
    raise exception 'Selecione uma conta bancária de destino válida.';
  end if;

  if p_modo_recebimento = 'retido'
    and (p_dia_recebimento_automatico is null or p_dia_recebimento_automatico not between 1 and 7) then
    raise exception 'Selecione o dia do recebimento automático.';
  end if;

  if coalesce(p_taxa_saque_instantaneo, 0) < 0
    or coalesce(p_taxa_saque_agendado, 0) < 0 then
    raise exception 'As taxas de saque não podem ser negativas.';
  end if;

  if not coalesce(p_tipos_saque_disponiveis, array[]::text[])
    <@ array['instantaneo', 'agendado', 'outro']::text[] then
    raise exception 'Existe um tipo de saque inválido.';
  end if;

  if cardinality(p_tipos_saque_disponiveis) > 0
    and (
      p_tipo_saque_padrao is null
      or not p_tipo_saque_padrao = any(p_tipos_saque_disponiveis)
    ) then
    raise exception 'O tipo padrão deve estar entre os tipos de saque disponíveis.';
  end if;

  select modo_recebimento
  into v_modo_anterior
  from public.plataformas
  where id = p_plataforma_id
  for update;

  if not found then
    raise exception 'Plataforma não encontrada.';
  end if;

  if p_modo_recebimento = 'retido' and v_modo_anterior <> 'retido' then
    select inicio, fim, data_pagamento
    into v_ciclo_inicio, v_ciclo_fim, v_data_pagamento
    from public.ultimo_ciclo_devido(current_date, p_dia_recebimento_automatico);
  end if;

  update public.plataformas
  set
    modo_recebimento = p_modo_recebimento,
    conta_destino_id = p_conta_destino_id,
    dia_recebimento_automatico = case
      when p_modo_recebimento = 'retido' then p_dia_recebimento_automatico
      else dia_recebimento_automatico
    end,
    taxa_saque_instantaneo = greatest(coalesce(p_taxa_saque_instantaneo, 0), 0),
    taxa_saque_agendado = greatest(coalesce(p_taxa_saque_agendado, 0), 0),
    tipos_saque_disponiveis = coalesce(p_tipos_saque_disponiveis, array[]::text[]),
    tipo_saque_padrao = coalesce(p_tipo_saque_padrao, 'instantaneo'),
    ultimo_ciclo_liquidado_inicio = case
      when p_modo_recebimento = 'retido' and v_modo_anterior <> 'retido'
        then v_ciclo_inicio
      else ultimo_ciclo_liquidado_inicio
    end,
    ultimo_ciclo_liquidado_fim = case
      when p_modo_recebimento = 'retido' and v_modo_anterior <> 'retido'
        then v_ciclo_fim
      else ultimo_ciclo_liquidado_fim
    end
  where id = p_plataforma_id;
end;
$$;

create or replace function public.preparar_destino_ganho_plataforma()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_modo text;
  v_conta_destino_id bigint;
  v_ultimo_ciclo_fim date;
  v_data_ganho date;
  v_ciclo_inicio date;
  v_ciclo_fim date;
begin
  perform public.processar_recebimento_automatico_plataforma(
    new.plataforma_id,
    current_date
  );

  select
    modo_recebimento,
    conta_destino_id,
    ultimo_ciclo_liquidado_fim
  into
    v_modo,
    v_conta_destino_id,
    v_ultimo_ciclo_fim
  from public.plataformas
  where id = new.plataforma_id;

  select data
  into v_data_ganho
  from public.entradas
  where id = new.entrada_id;

  if v_data_ganho is null then
    raise exception 'Entrada financeira não encontrada.';
  end if;

  select inicio, fim
  into v_ciclo_inicio, v_ciclo_fim
  from public.ciclo_operacional_da_data(v_data_ganho);

  new.ciclo_operacional_inicio := v_ciclo_inicio;
  new.ciclo_operacional_fim := v_ciclo_fim;

  if v_modo = 'instantaneo'
    or (v_ultimo_ciclo_fim is not null and v_data_ganho <= v_ultimo_ciclo_fim) then
    if v_conta_destino_id is null then
      raise exception 'Configure a conta de destino da plataforma antes de lançar ganhos.';
    end if;

    new.destino_financeiro := 'conta';
    new.conta_destino_id := v_conta_destino_id;
  else
    new.destino_financeiro := 'plataforma';
    new.conta_destino_id := null;
  end if;

  return new;
end;
$$;

create or replace function public.sincronizar_credito_direto_plataforma()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_data date;
  v_nome_plataforma text;
  v_valor numeric(12, 2);
begin
  delete from public.transferencias
  where entrada_plataforma_id = new.id;

  if new.destino_financeiro <> 'conta' or new.conta_destino_id is null then
    return new;
  end if;

  v_valor := round(
    coalesce(new.faturamento, 0) + coalesce(new.valor_reembolso, 0),
    2
  );

  if v_valor <= 0 then
    return new;
  end if;

  select e.data, p.nome
  into v_data, v_nome_plataforma
  from public.entradas e
  join public.plataformas p on p.id = new.plataforma_id
  where e.id = new.entrada_id;

  insert into public.transferencias (
    data,
    conta_origem_id,
    conta_destino_id,
    valor,
    valor_bruto,
    descricao,
    tipo,
    plataforma_id,
    entrada_plataforma_id,
    ciclo_operacional_inicio,
    ciclo_operacional_fim
  ) values (
    v_data,
    null,
    new.conta_destino_id,
    v_valor,
    v_valor,
    'Recebimento direto da plataforma ' || v_nome_plataforma,
    'recebimento_direto_plataforma',
    new.plataforma_id,
    new.id,
    new.ciclo_operacional_inicio,
    new.ciclo_operacional_fim
  );

  return new;
end;
$$;

drop trigger if exists trg_preparar_destino_ganho_plataforma
  on public.entrada_plataformas;
create trigger trg_preparar_destino_ganho_plataforma
before insert or update on public.entrada_plataformas
for each row execute function public.preparar_destino_ganho_plataforma();

drop trigger if exists trg_sincronizar_credito_direto_plataforma
  on public.entrada_plataformas;
create trigger trg_sincronizar_credito_direto_plataforma
after insert or update on public.entrada_plataformas
for each row execute function public.sincronizar_credito_direto_plataforma();

insert into public.transferencias (
  data,
  conta_origem_id,
  conta_destino_id,
  valor,
  valor_bruto,
  descricao,
  tipo,
  plataforma_id,
  entrada_plataforma_id,
  ciclo_operacional_inicio,
  ciclo_operacional_fim
)
select
  e.data,
  null,
  ep.conta_destino_id,
  round(coalesce(ep.faturamento, 0) + coalesce(ep.valor_reembolso, 0), 2),
  round(coalesce(ep.faturamento, 0) + coalesce(ep.valor_reembolso, 0), 2),
  'Recebimento direto da plataforma ' || p.nome,
  'recebimento_direto_plataforma',
  ep.plataforma_id,
  ep.id,
  ep.ciclo_operacional_inicio,
  ep.ciclo_operacional_fim
from public.entrada_plataformas ep
join public.entradas e on e.id = ep.entrada_id
join public.plataformas p on p.id = ep.plataforma_id
where ep.destino_financeiro = 'conta'
  and ep.conta_destino_id is not null
  and round(coalesce(ep.faturamento, 0) + coalesce(ep.valor_reembolso, 0), 2) > 0
on conflict (entrada_plataforma_id)
  where entrada_plataforma_id is not null
do nothing;

update public.entradas e
set conta_id = null
where exists (
  select 1
  from public.entrada_plataformas ep
  where ep.entrada_id = e.id
);

create or replace function public.registrar_saque_plataforma(
  p_plataforma_id bigint,
  p_conta_destino_id bigint,
  p_valor_bruto numeric,
  p_tipo_saque text,
  p_taxa numeric default 0,
  p_data date default current_date
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_transferencia_id bigint;
  v_nome_plataforma text;
  v_tipos_disponiveis text[];
  v_valor_liquido numeric(12, 2);
  v_rotulo_tipo text;
begin
  if coalesce(p_valor_bruto, 0) <= 0 then
    raise exception 'O valor bruto do saque deve ser maior que zero.';
  end if;

  if coalesce(p_taxa, 0) < 0 or coalesce(p_taxa, 0) > p_valor_bruto then
    raise exception 'A taxa deve estar entre zero e o valor do saque.';
  end if;

  select nome, tipos_saque_disponiveis
  into v_nome_plataforma, v_tipos_disponiveis
  from public.plataformas
  where id = p_plataforma_id
    and modo_recebimento = 'retido';

  if v_nome_plataforma is null then
    raise exception 'Plataforma retida não encontrada.';
  end if;

  if not p_tipo_saque = any(v_tipos_disponiveis) then
    raise exception 'Este tipo de saque não está disponível para a plataforma.';
  end if;

  if not exists (
    select 1
    from public.contas
    where id = p_conta_destino_id
      and ativo = true
      and coalesce(tipo_conta, 'banco') = 'banco'
  ) then
    raise exception 'Conta bancária de destino inválida.';
  end if;

  v_valor_liquido := round(p_valor_bruto - coalesce(p_taxa, 0), 2);
  v_rotulo_tipo := case p_tipo_saque
    when 'instantaneo' then 'instantâneo'
    when 'agendado' then 'agendado'
    else 'outro'
  end;

  insert into public.transferencias (
    data,
    conta_origem_id,
    conta_destino_id,
    valor,
    descricao,
    tipo,
    plataforma_id,
    valor_bruto,
    tipo_saque
  ) values (
    coalesce(p_data, current_date),
    null,
    p_conta_destino_id,
    v_valor_liquido,
    'Saque ' || v_rotulo_tipo || ' da plataforma ' || v_nome_plataforma,
    'saque_plataforma',
    p_plataforma_id,
    round(p_valor_bruto, 2),
    p_tipo_saque
  )
  returning id into v_transferencia_id;

  if coalesce(p_taxa, 0) > 0 then
    insert into public.saidas (
      data_compra,
      forma_pagamento,
      conta_id,
      valor_total,
      valor_parcela,
      data_efetivacao,
      categoria,
      descricao,
      status,
      tipo_movimentacao,
      finalidade,
      saque_transferencia_id
    ) values (
      coalesce(p_data, current_date),
      'desconto_transferencia',
      null,
      round(p_taxa, 2),
      round(p_taxa, 2),
      coalesce(p_data, current_date),
      'Taxa de Saque da Plataforma',
      'Taxa do saque ' || v_rotulo_tipo || ' da plataforma ' || v_nome_plataforma,
      'pago',
      'saida',
      'trabalho',
      v_transferencia_id
    );
  end if;

  return v_transferencia_id;
end;
$$;

grant execute on function public.processar_recebimentos_automaticos(date)
  to anon, authenticated, service_role;
grant execute on function public.configurar_financeiro_plataforma(bigint, text, bigint, smallint, numeric, numeric, text[], text)
  to anon, authenticated, service_role;
grant execute on function public.registrar_saque_plataforma(bigint, bigint, numeric, text, numeric, date)
  to anon, authenticated, service_role;
