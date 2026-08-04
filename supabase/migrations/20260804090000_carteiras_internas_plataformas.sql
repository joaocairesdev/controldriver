alter table public.plataformas
  add column if not exists carteira_ativa_desde timestamp with time zone,
  add column if not exists dia_recebimento_automatico smallint,
  add column if not exists permite_saque_antecipado boolean not null default true,
  add column if not exists taxa_saque_instantaneo numeric(12, 2) not null default 0,
  add column if not exists taxa_saque_agendado numeric(12, 2) not null default 0;

update public.plataformas
set carteira_ativa_desde = now()
where carteira_ativa_desde is null;

alter table public.plataformas
  alter column carteira_ativa_desde set default now(),
  alter column carteira_ativa_desde set not null;

alter table public.plataformas
  drop constraint if exists plataformas_dia_recebimento_automatico_check,
  add constraint plataformas_dia_recebimento_automatico_check
    check (dia_recebimento_automatico between 1 and 31),
  drop constraint if exists plataformas_taxa_saque_instantaneo_check,
  add constraint plataformas_taxa_saque_instantaneo_check
    check (taxa_saque_instantaneo >= 0),
  drop constraint if exists plataformas_taxa_saque_agendado_check,
  add constraint plataformas_taxa_saque_agendado_check
    check (taxa_saque_agendado >= 0);

alter table public.transferencias
  add column if not exists plataforma_id bigint,
  add column if not exists valor_bruto numeric(12, 2),
  add column if not exists tipo_saque text;

alter table public.transferencias
  drop constraint if exists transferencias_plataforma_id_fkey,
  add constraint transferencias_plataforma_id_fkey
    foreign key (plataforma_id) references public.plataformas(id),
  drop constraint if exists transferencias_valor_bruto_check,
  add constraint transferencias_valor_bruto_check
    check (valor_bruto is null or valor_bruto > 0),
  drop constraint if exists transferencias_tipo_saque_check,
  add constraint transferencias_tipo_saque_check
    check (tipo_saque is null or tipo_saque in ('instantaneo', 'agendado', 'outro')),
  drop constraint if exists transferencias_saque_plataforma_check,
  add constraint transferencias_saque_plataforma_check
    check (
      tipo <> 'saque_plataforma'
      or (
        plataforma_id is not null
        and conta_origem_id is null
        and conta_destino_id is not null
        and valor_bruto is not null
        and tipo_saque is not null
      )
    );

alter table public.saidas
  add column if not exists saque_transferencia_id bigint;

alter table public.saidas
  drop constraint if exists saidas_saque_transferencia_id_fkey,
  add constraint saidas_saque_transferencia_id_fkey
    foreign key (saque_transferencia_id)
    references public.transferencias(id)
    on delete cascade;

create unique index if not exists saidas_saque_transferencia_id_unique
  on public.saidas (saque_transferencia_id)
  where saque_transferencia_id is not null;

insert into public.categorias (
  nome,
  tipo,
  grupo,
  operacional,
  uso,
  ativo,
  ordem,
  tipo_uso
)
select
  'Taxa de Saque da Plataforma',
  'saida',
  'Financeiro',
  false,
  'trabalho',
  true,
  0,
  'trabalho'
where not exists (
  select 1
  from public.categorias
  where lower(nome) = lower('Taxa de Saque da Plataforma')
    and tipo = 'saida'
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
  v_valor_liquido numeric(12, 2);
  v_rotulo_tipo text;
begin
  if coalesce(p_valor_bruto, 0) <= 0 then
    raise exception 'O valor bruto do saque deve ser maior que zero.';
  end if;

  if coalesce(p_taxa, 0) < 0 then
    raise exception 'A taxa do saque não pode ser negativa.';
  end if;

  if coalesce(p_taxa, 0) > p_valor_bruto then
    raise exception 'A taxa não pode ser maior que o valor do saque.';
  end if;

  if p_tipo_saque not in ('instantaneo', 'agendado', 'outro') then
    raise exception 'Tipo de saque inválido.';
  end if;

  select nome
  into v_nome_plataforma
  from public.plataformas
  where id = p_plataforma_id;

  if v_nome_plataforma is null then
    raise exception 'Plataforma não encontrada.';
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

grant execute on function public.registrar_saque_plataforma(bigint, bigint, numeric, text, numeric, date)
  to anon, authenticated, service_role;
