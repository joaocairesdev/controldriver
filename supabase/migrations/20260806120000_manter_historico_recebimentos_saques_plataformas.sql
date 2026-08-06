update public.transferencias transferencia
set valor_bruto = round(
  coalesce(transferencia.valor, 0) + coalesce((
    select taxa.valor_total
    from public.saidas taxa
    where taxa.saque_transferencia_id = transferencia.id
    limit 1
  ), 0),
  2
)
where transferencia.tipo = 'saque_plataforma'
  and transferencia.valor_bruto is null;

update public.transferencias
set valor_bruto = round(coalesce(valor, 0), 2)
where tipo = 'recebimento_automatico_plataforma'
  and valor_bruto is null;

create or replace function public.editar_recebimento_semanal_plataforma(
  p_transferencia_id bigint,
  p_conta_destino_id bigint,
  p_data date,
  p_descricao text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_tipo text;
  v_entrada_plataforma_id bigint;
begin
  if p_data is null then
    raise exception 'Informe a data do recebimento semanal.';
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

  select tipo, entrada_plataforma_id
  into v_tipo, v_entrada_plataforma_id
  from public.transferencias
  where id = p_transferencia_id
    and tipo in (
      'recebimento_automatico_plataforma',
      'recebimento_direto_plataforma'
    )
  for update;

  if not found then
    raise exception 'Recebimento semanal automático não encontrado.';
  end if;

  if v_tipo = 'recebimento_direto_plataforma'
    and v_entrada_plataforma_id is not null then
    update public.entrada_plataformas
    set conta_destino_id = p_conta_destino_id
    where id = v_entrada_plataforma_id;
  end if;

  update public.transferencias
  set
    data = p_data,
    conta_destino_id = p_conta_destino_id,
    descricao = nullif(trim(p_descricao), '')
  where id = p_transferencia_id
    and tipo in (
      'recebimento_automatico_plataforma',
      'recebimento_direto_plataforma'
    );
end;
$$;

grant execute on function public.editar_recebimento_semanal_plataforma(bigint, bigint, date, text)
  to anon, authenticated, service_role;

create or replace function public.excluir_recebimento_semanal_plataforma(
  p_transferencia_id bigint
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_tipo text;
  v_entrada_plataforma_id bigint;
begin
  select tipo, entrada_plataforma_id
  into v_tipo, v_entrada_plataforma_id
  from public.transferencias
  where id = p_transferencia_id
    and tipo in (
      'recebimento_automatico_plataforma',
      'recebimento_direto_plataforma'
    )
  for update;

  if not found then
    raise exception 'Recebimento semanal automático não encontrado.';
  end if;

  if v_tipo = 'recebimento_direto_plataforma'
    and v_entrada_plataforma_id is not null then
    update public.entrada_plataformas
    set
      destino_financeiro = 'plataforma',
      conta_destino_id = null
    where id = v_entrada_plataforma_id;
  end if;

  delete from public.transferencias
  where id = p_transferencia_id;
end;
$$;

grant execute on function public.excluir_recebimento_semanal_plataforma(bigint)
  to anon, authenticated, service_role;

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
  v_data date := coalesce(p_data, current_date);
begin
  if v_data > current_date then
    raise exception 'A data do saque não pode ser futura.';
  end if;

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
    v_data,
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
      v_data,
      'desconto_transferencia',
      null,
      round(p_taxa, 2),
      round(p_taxa, 2),
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

grant execute on function public.registrar_saque_plataforma(bigint, bigint, numeric, text, numeric, date)
  to anon, authenticated, service_role;

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
  v_rotulo_tipo text;
  v_taxa_id bigint;
begin
  if coalesce(p_data, current_date) > current_date then
    raise exception 'A data do saque não pode ser futura.';
  end if;

  if coalesce(p_valor_bruto, 0) <= 0 then
    raise exception 'O valor bruto do saque deve ser maior que zero.';
  end if;

  if coalesce(p_taxa, 0) < 0 or coalesce(p_taxa, 0) > p_valor_bruto then
    raise exception 'A taxa deve estar entre zero e o valor do saque.';
  end if;

  if p_tipo_saque is null
    or p_tipo_saque not in ('instantaneo', 'agendado', 'outro') then
    raise exception 'Tipo de saque inválido.';
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

  v_valor_liquido := round(p_valor_bruto - coalesce(p_taxa, 0), 2);
  v_rotulo_tipo := case p_tipo_saque
    when 'instantaneo' then 'instantâneo'
    when 'agendado' then 'agendado'
    else 'outro'
  end;

  update public.transferencias
  set
    data = coalesce(p_data, current_date),
    conta_destino_id = p_conta_destino_id,
    valor = v_valor_liquido,
    valor_bruto = round(p_valor_bruto, 2),
    tipo_saque = p_tipo_saque,
    descricao = 'Saque ' || v_rotulo_tipo || ' da plataforma ' || v_nome_plataforma
  where id = p_transferencia_id;

  select id
  into v_taxa_id
  from public.saidas
  where saque_transferencia_id = p_transferencia_id
  for update;

  if coalesce(p_taxa, 0) > 0 then
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
        round(p_taxa, 2),
        round(p_taxa, 2),
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
        valor_total = round(p_taxa, 2),
        valor_parcela = round(p_taxa, 2),
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

grant execute on function public.editar_saque_plataforma(bigint, bigint, numeric, text, numeric, date)
  to anon, authenticated, service_role;

create or replace function public.excluir_saque_plataforma(
  p_transferencia_id bigint
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform 1
  from public.transferencias
  where id = p_transferencia_id
    and tipo = 'saque_plataforma'
  for update;

  if not found then
    raise exception 'Saque da plataforma não encontrado.';
  end if;

  delete from public.saidas
  where saque_transferencia_id = p_transferencia_id;

  delete from public.transferencias
  where id = p_transferencia_id
    and tipo = 'saque_plataforma';
end;
$$;

grant execute on function public.excluir_saque_plataforma(bigint)
  to anon, authenticated, service_role;
