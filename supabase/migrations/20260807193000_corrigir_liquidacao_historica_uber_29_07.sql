begin;

do $$
declare
  v_ganho public.entrada_plataformas%rowtype;
  v_ganho_depois public.entrada_plataformas%rowtype;
  v_recebimento public.transferencias%rowtype;
  v_saque_1_id bigint;
  v_saque_2_id bigint;
  v_saldo_uber_antes numeric(12, 2);
  v_saldo_uber_depois numeric(12, 2);
begin
  perform pg_advisory_xact_lock(
    hashtextextended('corrigir_liquidacao_historica_uber_29_07', 0)
  );

  if exists (
    select 1
    from public.transferencias transferencia
    left join public.entrada_plataformas ganho
      on ganho.id = transferencia.entrada_plataforma_id
    where transferencia.tipo = 'recebimento_direto_plataforma'
      and (
        transferencia.entrada_plataforma_id is null
        or ganho.id is null
        or transferencia.plataforma_id is distinct from ganho.plataforma_id
        or transferencia.conta_destino_id is distinct from ganho.conta_destino_id
        or round(transferencia.valor, 2) is distinct from round(
          coalesce(ganho.faturamento, 0)
          + coalesce(ganho.valor_reembolso, 0),
          2
        )
      )
  ) then
    raise exception
      'Existem recebimentos diretos de plataforma sem vínculo íntegro com o ganho de origem.';
  end if;

  select round(
    coalesce((
      select sum(
        coalesce(ganho.faturamento, 0)
        + coalesce(ganho.valor_reembolso, 0)
      )
      from public.entrada_plataformas ganho
      where ganho.plataforma_id = 1
        and ganho.destino_financeiro = 'plataforma'
    ), 0)
    - coalesce((
      select sum(coalesce(transferencia.valor_bruto, transferencia.valor, 0))
      from public.transferencias transferencia
      where transferencia.plataforma_id = 1
        and transferencia.tipo in (
          'saque_plataforma',
          'recebimento_automatico_plataforma'
        )
    ), 0),
    2
  )
  into v_saldo_uber_antes;

  select *
  into v_ganho
  from public.entrada_plataformas
  where id = 43
  for update;

  if not found then
    raise exception 'Ganho histórico entrada_plataformas.id = 43 não encontrado.';
  end if;

  if v_ganho.plataforma_id <> 1
    or round(coalesce(v_ganho.faturamento, 0), 2) <> 164.98
    or round(coalesce(v_ganho.valor_reembolso, 0), 2) <> 0
    or v_ganho.destino_financeiro not in ('conta', 'plataforma')
    or (
      v_ganho.destino_financeiro = 'conta'
      and v_ganho.conta_destino_id is distinct from 2
    )
    or (
      v_ganho.destino_financeiro = 'plataforma'
      and v_ganho.conta_destino_id is not null
    ) then
    raise exception
      'Ganho histórico entrada_plataformas.id = 43 não corresponde ao estado auditado.';
  end if;

  select *
  into v_recebimento
  from public.transferencias
  where id = 48
  for update;

  if found and (
    v_recebimento.tipo <> 'recebimento_direto_plataforma'
    or v_recebimento.entrada_plataforma_id is distinct from 43
    or v_recebimento.plataforma_id is distinct from 1
    or v_recebimento.conta_origem_id is not null
    or v_recebimento.conta_destino_id is distinct from 2
    or v_recebimento.data <> date '2026-07-29'
    or round(v_recebimento.valor, 2) <> 164.98
    or round(coalesce(v_recebimento.valor_bruto, 0), 2) <> 164.98
  ) then
    raise exception
      'Transferência histórica transferencias.id = 48 não corresponde ao estado auditado.';
  end if;

  if exists (
    select 1
    from public.transferencias
    where entrada_plataforma_id = 43
      and tipo = 'recebimento_direto_plataforma'
      and id <> 48
  ) then
    raise exception
      'Existe outro recebimento direto vinculado a entrada_plataformas.id = 43.';
  end if;

  if (
    select count(*)
    from public.transferencias
    where data = date '2026-07-29'
      and conta_origem_id is null
      and conta_destino_id = 2
      and plataforma_id = 1
      and tipo = 'saque_plataforma'
      and tipo_saque = 'instantaneo'
      and round(valor_bruto, 2) = 112.50
      and round(valor, 2) = 108.00
      and descricao = 'Saque instantâneo da plataforma Uber'
  ) > 1 or (
    select count(*)
    from public.transferencias
    where data = date '2026-07-29'
      and conta_origem_id is null
      and conta_destino_id = 2
      and plataforma_id = 1
      and tipo = 'saque_plataforma'
      and tipo_saque = 'instantaneo'
      and round(valor_bruto, 2) = 52.48
      and round(valor, 2) = 47.98
      and descricao = 'Saque instantâneo da plataforma Uber'
  ) > 1 then
    raise exception
      'Já existem saques históricos duplicados para a conciliação da Uber em 29/07/2026.';
  end if;

  delete from public.transferencias
  where id = 48
    and tipo = 'recebimento_direto_plataforma'
    and entrada_plataforma_id = 43;

  update public.entrada_plataformas
  set
    destino_financeiro = 'plataforma',
    conta_destino_id = null
  where id = 43
    and (
      destino_financeiro is distinct from 'plataforma'
      or conta_destino_id is not null
    );

  select *
  into v_ganho_depois
  from public.entrada_plataformas
  where id = 43;

  if (
    to_jsonb(v_ganho_depois)
      - 'destino_financeiro'
      - 'conta_destino_id'
  ) is distinct from (
    to_jsonb(v_ganho)
      - 'destino_financeiro'
      - 'conta_destino_id'
  ) then
    raise exception
      'A reclassificação alterou campos não autorizados do ganho histórico.';
  end if;

  select id
  into v_saque_1_id
  from public.transferencias
  where data = date '2026-07-29'
    and conta_origem_id is null
    and conta_destino_id = 2
    and plataforma_id = 1
    and tipo = 'saque_plataforma'
    and tipo_saque = 'instantaneo'
    and round(valor_bruto, 2) = 112.50
    and round(valor, 2) = 108.00
    and descricao = 'Saque instantâneo da plataforma Uber';

  if v_saque_1_id is null then
    insert into public.transferencias (
      data,
      conta_origem_id,
      conta_destino_id,
      valor,
      valor_bruto,
      descricao,
      tipo,
      plataforma_id,
      tipo_saque
    ) values (
      date '2026-07-29',
      null,
      2,
      108.00,
      112.50,
      'Saque instantâneo da plataforma Uber',
      'saque_plataforma',
      1,
      'instantaneo'
    )
    returning id into v_saque_1_id;
  end if;

  select id
  into v_saque_2_id
  from public.transferencias
  where data = date '2026-07-29'
    and conta_origem_id is null
    and conta_destino_id = 2
    and plataforma_id = 1
    and tipo = 'saque_plataforma'
    and tipo_saque = 'instantaneo'
    and round(valor_bruto, 2) = 52.48
    and round(valor, 2) = 47.98
    and descricao = 'Saque instantâneo da plataforma Uber';

  if v_saque_2_id is null then
    insert into public.transferencias (
      data,
      conta_origem_id,
      conta_destino_id,
      valor,
      valor_bruto,
      descricao,
      tipo,
      plataforma_id,
      tipo_saque
    ) values (
      date '2026-07-29',
      null,
      2,
      47.98,
      52.48,
      'Saque instantâneo da plataforma Uber',
      'saque_plataforma',
      1,
      'instantaneo'
    )
    returning id into v_saque_2_id;
  end if;

  insert into public.saidas (
    data_compra,
    forma_pagamento,
    conta_id,
    numero_parcelas,
    valor_total,
    valor_parcela,
    data_efetivacao,
    categoria,
    descricao,
    status,
    tipo_movimentacao,
    finalidade,
    saque_transferencia_id
  )
  select
    date '2026-07-29',
    'desconto_transferencia',
    null,
    1,
    4.50,
    4.50,
    date '2026-07-29',
    'Taxa de Saque da Plataforma',
    'Taxa do saque instantâneo da plataforma Uber',
    'pago',
    'saida',
    'trabalho',
    v_saque_1_id
  where not exists (
    select 1
    from public.saidas
    where saque_transferencia_id = v_saque_1_id
  );

  insert into public.saidas (
    data_compra,
    forma_pagamento,
    conta_id,
    numero_parcelas,
    valor_total,
    valor_parcela,
    data_efetivacao,
    categoria,
    descricao,
    status,
    tipo_movimentacao,
    finalidade,
    saque_transferencia_id
  )
  select
    date '2026-07-29',
    'desconto_transferencia',
    null,
    1,
    4.50,
    4.50,
    date '2026-07-29',
    'Taxa de Saque da Plataforma',
    'Taxa do saque instantâneo da plataforma Uber',
    'pago',
    'saida',
    'trabalho',
    v_saque_2_id
  where not exists (
    select 1
    from public.saidas
    where saque_transferencia_id = v_saque_2_id
  );

  if exists (
    select 1
    from public.saidas
    where saque_transferencia_id in (v_saque_1_id, v_saque_2_id)
    group by saque_transferencia_id
    having count(*) <> 1
      or round(sum(valor_total), 2) <> 4.50
  ) or (
    select count(*)
    from public.saidas
    where saque_transferencia_id in (v_saque_1_id, v_saque_2_id)
      and data_compra = date '2026-07-29'
      and data_efetivacao = date '2026-07-29'
      and forma_pagamento = 'desconto_transferencia'
      and conta_id is null
      and categoria = 'Taxa de Saque da Plataforma'
      and status = 'pago'
      and tipo_movimentacao = 'saida'
      and round(valor_total, 2) = 4.50
  ) <> 2 then
    raise exception 'As taxas dos saques históricos não correspondem ao estado auditado.';
  end if;

  if exists (
    select 1
    from public.transferencias
    where entrada_plataforma_id = 43
      and tipo = 'recebimento_direto_plataforma'
  ) then
    raise exception
      'O recebimento direto incorreto de entrada_plataformas.id = 43 ainda existe.';
  end if;

  if (
    select count(*)
    from public.transferencias
    where id in (v_saque_1_id, v_saque_2_id)
      and tipo = 'saque_plataforma'
      and tipo_saque = 'instantaneo'
      and plataforma_id = 1
      and conta_destino_id = 2
      and data = date '2026-07-29'
  ) <> 2 then
    raise exception 'Os dois saques históricos da Uber não foram reconstruídos.';
  end if;

  if (
    select round(sum(valor_bruto), 2)
    from public.transferencias
    where id in (v_saque_1_id, v_saque_2_id)
  ) <> 164.98 or (
    select round(sum(valor), 2)
    from public.transferencias
    where id in (v_saque_1_id, v_saque_2_id)
  ) <> 155.98 then
    raise exception 'Os valores bruto e líquido dos saques não fecham a conciliação.';
  end if;

  select round(
    coalesce((
      select sum(
        coalesce(ganho.faturamento, 0)
        + coalesce(ganho.valor_reembolso, 0)
      )
      from public.entrada_plataformas ganho
      where ganho.plataforma_id = 1
        and ganho.destino_financeiro = 'plataforma'
    ), 0)
    - coalesce((
      select sum(coalesce(transferencia.valor_bruto, transferencia.valor, 0))
      from public.transferencias transferencia
      where transferencia.plataforma_id = 1
        and transferencia.tipo in (
          'saque_plataforma',
          'recebimento_automatico_plataforma'
        )
    ), 0),
    2
  )
  into v_saldo_uber_depois;

  if v_saldo_uber_depois is distinct from v_saldo_uber_antes then
    raise exception
      'A correção alteraria o saldo da Uber: antes %, depois %.',
      v_saldo_uber_antes,
      v_saldo_uber_depois;
  end if;
end;
$$;

commit;
