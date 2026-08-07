alter table public.transferencias
  drop constraint if exists transferencias_tipo_saque_check,
  add constraint transferencias_tipo_saque_check
    check (
      tipo_saque is null
      or tipo_saque in ('semanal', 'instantaneo', 'agendado', 'outro')
    );

update public.plataformas
set modo_recebimento = 'retido'
where modo_recebimento <> 'retido';

create or replace function public.preparar_destino_ganho_plataforma()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.destino_financeiro := 'plataforma';
    new.conta_destino_id := null;
    new.ciclo_operacional_inicio := null;
    new.ciclo_operacional_fim := null;
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
  if tg_op <> 'UPDATE'
    or old.destino_financeiro <> 'conta'
    or new.destino_financeiro <> 'conta'
    or new.conta_destino_id is null then
    return new;
  end if;

  v_valor := round(
    coalesce(new.faturamento, 0) + coalesce(new.valor_reembolso, 0),
    2
  );

  select e.data, p.nome
  into v_data, v_nome_plataforma
  from public.entradas e
  join public.plataformas p on p.id = new.plataforma_id
  where e.id = new.entrada_id;

  update public.transferencias
  set
    data = v_data,
    conta_destino_id = new.conta_destino_id,
    valor = v_valor,
    valor_bruto = v_valor,
    descricao = 'Recebimento direto da plataforma ' || v_nome_plataforma
  where entrada_plataforma_id = new.id
    and tipo = 'recebimento_direto_plataforma';

  return new;
end;
$$;

drop function if exists public.configurar_financeiro_plataforma(
  bigint,
  text,
  bigint,
  smallint,
  numeric,
  numeric,
  text[],
  text
);

create or replace function public.configurar_financeiro_plataforma(
  p_plataforma_id bigint,
  p_conta_destino_id bigint,
  p_dia_recebimento_automatico smallint,
  p_taxa_saque_instantaneo numeric,
  p_taxa_saque_agendado numeric
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_conta_destino_id is null or not exists (
    select 1
    from public.contas
    where id = p_conta_destino_id
      and ativo = true
      and coalesce(tipo_conta, 'banco') = 'banco'
  ) then
    raise exception 'Selecione uma conta bancária de destino válida.';
  end if;

  if p_dia_recebimento_automatico is null
    or p_dia_recebimento_automatico not between 1 and 7 then
    raise exception 'Selecione o dia do recebimento semanal.';
  end if;

  if coalesce(p_taxa_saque_instantaneo, 0) < 0
    or coalesce(p_taxa_saque_agendado, 0) < 0 then
    raise exception 'As taxas de saque não podem ser negativas.';
  end if;

  update public.plataformas
  set
    modo_recebimento = 'retido',
    conta_destino_id = p_conta_destino_id,
    dia_recebimento_automatico = p_dia_recebimento_automatico,
    taxa_saque_instantaneo = greatest(
      coalesce(p_taxa_saque_instantaneo, 0),
      0
    ),
    taxa_saque_agendado = greatest(
      coalesce(p_taxa_saque_agendado, 0),
      0
    )
  where id = p_plataforma_id;

  if not found then
    raise exception 'Plataforma não encontrada.';
  end if;
end;
$$;

grant execute on function public.configurar_financeiro_plataforma(
  bigint,
  bigint,
  smallint,
  numeric,
  numeric
) to anon, authenticated, service_role;

drop function if exists public.processar_recebimentos_automaticos(date);
drop function if exists public.processar_recebimento_automatico_plataforma(
  bigint,
  date
);
drop function if exists public.ultimo_ciclo_devido(date, smallint);
drop function if exists public.saldo_retido_plataforma(bigint, date, date);
drop function if exists public.ciclo_operacional_da_data(date);

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
  v_taxa numeric(12, 2);
  v_rotulo_tipo text;
  v_descricao text;
  v_data date := coalesce(p_data, current_date);
begin
  if v_data > current_date then
    raise exception 'A data do saque não pode ser futura.';
  end if;

  if coalesce(p_valor_bruto, 0) <= 0 then
    raise exception 'O valor bruto do saque deve ser maior que zero.';
  end if;

  if p_tipo_saque is null
    or p_tipo_saque not in ('semanal', 'instantaneo', 'agendado') then
    raise exception 'Tipo de saque inválido.';
  end if;

  v_taxa := case
    when p_tipo_saque = 'semanal' then 0
    else round(coalesce(p_taxa, 0), 2)
  end;

  if v_taxa < 0 or v_taxa > p_valor_bruto then
    raise exception 'A taxa deve estar entre zero e o valor do saque.';
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

  v_valor_liquido := round(p_valor_bruto - v_taxa, 2);
  v_rotulo_tipo := case p_tipo_saque
    when 'instantaneo' then 'instantâneo'
    when 'agendado' then 'agendado'
    when 'semanal' then 'semanal'
    else 'outro'
  end;
  v_descricao := case p_tipo_saque
    when 'semanal' then
      'Recebimento semanal da plataforma ' || v_nome_plataforma
    else
      'Saque ' || v_rotulo_tipo || ' da plataforma ' || v_nome_plataforma
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
    v_data,
    null,
    p_conta_destino_id,
    v_valor_liquido,
    v_descricao,
    'saque_plataforma',
    p_plataforma_id,
    round(p_valor_bruto, 2),
    p_tipo_saque
  )
  returning id into v_transferencia_id;

  if v_taxa > 0 then
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
      v_data,
      'desconto_transferencia',
      null,
      v_taxa,
      v_taxa,
      v_data,
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

grant execute on function public.registrar_saque_plataforma(
  bigint,
  bigint,
  numeric,
  text,
  numeric,
  date
) to anon, authenticated, service_role;

create or replace function public.editar_saque_plataforma(
  p_transferencia_id bigint,
  p_conta_destino_id bigint,
  p_valor_bruto numeric,
  p_tipo_saque text,
  p_taxa numeric default 0,
  p_data date default current_date
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_transferencia public.transferencias%rowtype;
  v_nome_plataforma text;
  v_valor_liquido numeric(12, 2);
  v_taxa numeric(12, 2);
  v_rotulo_tipo text;
  v_descricao text;
  v_taxa_id bigint;
begin
  if coalesce(p_data, current_date) > current_date then
    raise exception 'A data do saque não pode ser futura.';
  end if;

  if coalesce(p_valor_bruto, 0) <= 0 then
    raise exception 'O valor bruto do saque deve ser maior que zero.';
  end if;

  if p_tipo_saque is null
    or p_tipo_saque not in ('semanal', 'instantaneo', 'agendado', 'outro') then
    raise exception 'Tipo de saque inválido.';
  end if;

  v_taxa := case
    when p_tipo_saque = 'semanal' then 0
    else round(coalesce(p_taxa, 0), 2)
  end;

  if v_taxa < 0 or v_taxa > p_valor_bruto then
    raise exception 'A taxa deve estar entre zero e o valor do saque.';
  end if;

  select *
  into v_transferencia
  from public.transferencias
  where id = p_transferencia_id
    and tipo = 'saque_plataforma'
  for update;

  if not found then
    raise exception 'Saque da plataforma não encontrado.';
  end if;

  select nome
  into v_nome_plataforma
  from public.plataformas
  where id = v_transferencia.plataforma_id;

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

  v_valor_liquido := round(p_valor_bruto - v_taxa, 2);
  v_rotulo_tipo := case p_tipo_saque
    when 'instantaneo' then 'instantâneo'
    when 'agendado' then 'agendado'
    when 'semanal' then 'semanal'
    else 'outro'
  end;
  v_descricao := case p_tipo_saque
    when 'semanal' then
      'Recebimento semanal da plataforma ' || v_nome_plataforma
    else
      'Saque ' || v_rotulo_tipo || ' da plataforma ' || v_nome_plataforma
  end;

  update public.transferencias
  set
    data = coalesce(p_data, current_date),
    conta_destino_id = p_conta_destino_id,
    valor = v_valor_liquido,
    valor_bruto = round(p_valor_bruto, 2),
    tipo_saque = p_tipo_saque,
    descricao = v_descricao
  where id = p_transferencia_id;

  select id
  into v_taxa_id
  from public.saidas
  where saque_transferencia_id = p_transferencia_id
  for update;

  if v_taxa > 0 then
    if v_taxa_id is null then
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
        v_taxa,
        v_taxa,
        coalesce(p_data, current_date),
        'Taxa de Saque da Plataforma',
        'Taxa do saque ' || v_rotulo_tipo || ' da plataforma ' || v_nome_plataforma,
        'pago',
        'saida',
        'trabalho',
        p_transferencia_id
      );
    else
      update public.saidas
      set
        data_compra = coalesce(p_data, current_date),
        data_efetivacao = coalesce(p_data, current_date),
        forma_pagamento = 'desconto_transferencia',
        conta_id = null,
        valor_total = v_taxa,
        valor_parcela = v_taxa,
        categoria = 'Taxa de Saque da Plataforma',
        descricao = 'Taxa do saque ' || v_rotulo_tipo || ' da plataforma ' || v_nome_plataforma,
        status = 'pago',
        tipo_movimentacao = 'saida',
        finalidade = 'trabalho'
      where id = v_taxa_id;
    end if;
  elsif v_taxa_id is not null then
    delete from public.saidas
    where id = v_taxa_id;
  end if;
end;
$$;

grant execute on function public.editar_saque_plataforma(
  bigint,
  bigint,
  numeric,
  text,
  numeric,
  date
) to anon, authenticated, service_role;
