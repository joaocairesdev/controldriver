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
  v_tipos_disponiveis text[];
  v_valor_liquido numeric(12, 2);
  v_rotulo_tipo text;
  v_taxa_id bigint;
begin
  if coalesce(p_valor_bruto, 0) <= 0 then
    raise exception 'O valor bruto do saque deve ser maior que zero.';
  end if;

  if coalesce(p_taxa, 0) < 0 or coalesce(p_taxa, 0) > p_valor_bruto then
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

  select nome, tipos_saque_disponiveis
  into v_nome_plataforma, v_tipos_disponiveis
  from public.plataformas
  where id = v_transferencia.plataforma_id
    and modo_recebimento = 'retido';

  if v_nome_plataforma is null then
    raise exception 'Plataforma retida não encontrada.';
  end if;

  if p_tipo_saque <> v_transferencia.tipo_saque
    and not p_tipo_saque = any(v_tipos_disponiveis) then
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
