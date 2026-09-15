-- Exclusao administrativa, atomica e conservadora de uma protecao veicular.
-- Uma chamada de funcao PostgreSQL executa dentro da transacao da instrucao;
-- qualquer excecao reverte todos os deletes e updates realizados pela chamada.

create or replace function public.excluir_protecao_veicular_definitivamente(
  p_protecao_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_contrato_id bigint;
  v_tipo_contrato text;
  v_status_contrato text;
  v_status_protecao text;
  v_protecao_ativa boolean;
  v_plano_ids bigint[] := '{}'::bigint[];
  v_parcela_ids bigint[] := '{}'::bigint[];
  v_saidas_parcelas_ids bigint[] := '{}'::bigint[];
  v_saida_ids bigint[] := '{}'::bigint[];
  v_fatura_ids bigint[] := '{}'::bigint[];
  v_planos_esperados integer := 0;
  v_parcelas_esperadas integer := 0;
  v_saidas_esperadas integer := 0;
  v_planos_removidos integer := 0;
  v_parcelas_removidas integer := 0;
  v_saidas_removidas integer := 0;
  v_faturas_recalculadas integer := 0;
  v_linhas_fatura_esperadas integer := 0;
  v_linhas_fatura_removidas integer := 0;
  v_registros_afetados integer := 0;
  v_fk_nao_prevista text;
begin
  if p_protecao_id is null or p_protecao_id <= 0 then
    raise exception using
      errcode = '22023',
      message = 'Informe uma protecao veicular valida para exclusao definitiva.';
  end if;

  -- conta_pagar_origem_id nao possui FK. O lock de tabela em saidas e necessario
  -- para impedir que um pagamento seja inserido entre a validacao e os deletes.
  -- Os demais locks impedem novos vinculos logicos durante a decisao final.
  lock table
    public.veiculos_protecoes,
    public.contratos_financeiros,
    public.contratos_financeiros_planos_cobranca,
    public.contratos_financeiros_parcelas,
    public.saidas,
    public.saidas_parcelas,
    public.faturas_cartao,
    public.renegociacoes_itens,
    public.entradas_avulsas,
    public.manutencao_pagamentos,
    public.saidas_abastecimentos,
    public.saidas_manutencoes,
    public.saidas_recargas_eletricas,
    public.saidas_tag,
    public.veiculos_cobrancas_geradas,
    public.veiculos_documentos
  in share row exclusive mode;

  select
    vp.contrato_financeiro_id,
    vp.status,
    vp.ativo
  into
    v_contrato_id,
    v_status_protecao,
    v_protecao_ativa
  from public.veiculos_protecoes vp
  where vp.id = p_protecao_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Protecao veicular nao encontrada.';
  end if;

  if v_contrato_id is null then
    raise exception using
      errcode = '23514',
      message = 'A protecao nao possui contrato financeiro vinculado; exclusao definitiva abortada.';
  end if;

  if coalesce(v_protecao_ativa, true)
    or v_status_protecao not in ('cancelada', 'substituida', 'encerrada') then
    raise exception using
      errcode = '23514',
      message = 'Somente uma protecao inativa e encerrada pode ser excluida definitivamente.';
  end if;

  select cf.tipo_contrato, cf.status
  into v_tipo_contrato, v_status_contrato
  from public.contratos_financeiros cf
  where cf.id = v_contrato_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'O contrato financeiro vinculado a protecao nao foi encontrado.';
  end if;

  if coalesce(v_tipo_contrato, '') not in ('protecao_veicular', 'seguro') then
    raise exception using
      errcode = '23514',
      message = 'O contrato vinculado nao e um contrato de protecao veicular.';
  end if;

  if coalesce(v_status_contrato, '') <> 'cancelado' then
    raise exception using
      errcode = '23514',
      message = 'O contrato financeiro precisa estar cancelado antes da exclusao definitiva.';
  end if;

  if exists (
    select 1
    from public.veiculos_protecoes vp
    where vp.contrato_financeiro_id = v_contrato_id
      and vp.id <> p_protecao_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'O contrato financeiro tambem esta vinculado a outra protecao.';
  end if;

  if exists (
    select 1
    from public.veiculos_protecoes vp
    where vp.substitui_protecao_id = p_protecao_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Outra protecao preserva vinculo historico com esta protecao.';
  end if;

  -- Se uma migration futura criar outra FK para uma entidade que sera apagada,
  -- a funcao para ate que esse novo vinculo seja classificado explicitamente.
  select format('%I.%I (%I)', origem_ns.nspname, origem.relname, fk.conname)
  into v_fk_nao_prevista
  from pg_catalog.pg_constraint fk
  join pg_catalog.pg_class destino on destino.oid = fk.confrelid
  join pg_catalog.pg_namespace destino_ns on destino_ns.oid = destino.relnamespace
  join pg_catalog.pg_class origem on origem.oid = fk.conrelid
  join pg_catalog.pg_namespace origem_ns on origem_ns.oid = origem.relnamespace
  where fk.contype = 'f'
    and destino_ns.nspname = 'public'
    and destino.relname in (
      'veiculos_protecoes',
      'contratos_financeiros',
      'contratos_financeiros_planos_cobranca',
      'contratos_financeiros_parcelas',
      'saidas'
    )
    and fk.conname not in (
      'veiculos_protecoes_substitui_protecao_id_fkey',
      'contratos_financeiros_parcelas_contrato_id_fkey',
      'entradas_avulsas_contrato_financeiro_id_fkey',
      'saidas_contrato_financeiro_id_fkey',
      'contratos_financeiros_planos_cobranca_contrato_id_fkey',
      'veiculos_protecoes_contrato_financeiro_id_fkey',
      'contratos_financeiros_parcelas_plano_cobranca_id_fkey',
      'saidas_contrato_financeiro_parcela_id_fkey',
      'contratos_financeiros_parcelas_saida_id_fkey',
      'saidas_abastecimentos_saida_id_fkey',
      'saidas_manutencoes_saida_id_fkey',
      'saidas_parcelas_saida_id_fkey',
      'saidas_recargas_eletricas_saida_id_fkey',
      'saidas_saida_origem_id_fkey',
      'saidas_tag_saida_id_fkey',
      'manutencao_pagamentos_saida_id_fkey',
      'veiculos_cobrancas_geradas_saida_id_fkey',
      'veiculos_documentos_saida_id_fkey'
    )
  order by origem_ns.nspname, origem.relname, fk.conname
  limit 1;

  if v_fk_nao_prevista is not null then
    raise exception using
      errcode = '55000',
      message = 'O schema possui um vinculo ainda nao classificado para exclusao definitiva: ' || v_fk_nao_prevista || '.';
  end if;

  select
    coalesce(array_agg(p.id order by p.id), '{}'::bigint[]),
    count(*)::integer
  into v_plano_ids, v_planos_esperados
  from public.contratos_financeiros_planos_cobranca p
  where p.contrato_id = v_contrato_id;

  perform 1
  from public.contratos_financeiros_planos_cobranca p
  where p.id = any(v_plano_ids)
  for update;

  if v_planos_esperados = 0 then
    raise exception using
      errcode = '23514',
      message = 'O contrato da protecao nao possui planos de cobranca classificaveis.';
  end if;

  select
    coalesce(array_agg(p.id order by p.id), '{}'::bigint[]),
    coalesce(array_agg(p.saida_id order by p.id) filter (where p.saida_id is not null), '{}'::bigint[]),
    count(*)::integer
  into v_parcela_ids, v_saidas_parcelas_ids, v_parcelas_esperadas
  from public.contratos_financeiros_parcelas p
  where p.contrato_id = v_contrato_id;

  perform 1
  from public.contratos_financeiros_parcelas p
  where p.id = any(v_parcela_ids)
  for update;

  if v_parcelas_esperadas = 0 then
    raise exception using
      errcode = '23514',
      message = 'O contrato da protecao nao possui parcelas contratuais classificaveis.';
  end if;

  if exists (
    select 1
    from public.contratos_financeiros_parcelas p
    where p.id = any(v_parcela_ids)
      and (
        p.plano_cobranca_id is null
        or not (p.plano_cobranca_id = any(v_plano_ids))
        or coalesce(p.valor_pago, 0) <> 0
        or p.status <> 'aberta'
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Uma parcela possui pagamento, status protegido ou plano de cobranca incompatível.';
  end if;

  select
    coalesce(array_agg(distinct s.id order by s.id), '{}'::bigint[]),
    count(distinct s.id)::integer
  into v_saida_ids, v_saidas_esperadas
  from public.saidas s
  where s.contrato_financeiro_id = v_contrato_id
    or s.contrato_financeiro_parcela_id = any(v_parcela_ids)
    or s.id = any(v_saidas_parcelas_ids);

  perform 1
  from public.saidas s
  where s.id = any(v_saida_ids)
  for update;

  if exists (
    select 1
    from public.contratos_financeiros_parcelas p
    where p.id = any(v_parcela_ids)
      and p.saida_id is not null
      and not exists (
        select 1
        from public.saidas s
        where s.id = p.saida_id
          and s.contrato_financeiro_id = v_contrato_id
          and s.contrato_financeiro_parcela_id = p.id
      )
  ) or exists (
    select 1
    from public.saidas s
    where s.id = any(v_saida_ids)
      and (
        s.contrato_financeiro_id is distinct from v_contrato_id
        or s.contrato_financeiro_parcela_id is null
        or not (s.contrato_financeiro_parcela_id = any(v_parcela_ids))
        or not exists (
          select 1
          from public.contratos_financeiros_parcelas p
          where p.id = s.contrato_financeiro_parcela_id
            and p.saida_id = s.id
        )
        or s.conta_pagar_origem_id is not null
        or s.saida_origem_id is not null
        or s.fatura_pagamento_id is not null
        or s.renegociacao_id is not null
        or s.financiamento_id is not null
        or s.aluguel_id is not null
        or s.caucao_id is not null
        or s.data_efetivacao is not null
        or coalesce(s.valor_pago, 0) <> 0
        or lower(coalesce(s.status, '')) not in ('aberto', 'pendente', 'fatura')
        or lower(coalesce(s.tipo_movimentacao, '')) not in ('conta_pagar', 'saida')
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Uma saida relacionada possui pagamento, realizacao ou vinculo financeiro incompativel.';
  end if;

  if exists (
    select 1
    from public.saidas pagamento
    where pagamento.conta_pagar_origem_id = any(v_saida_ids)
       or pagamento.saida_origem_id = any(v_saida_ids)
  ) then
    raise exception using
      errcode = '23514',
      message = 'A protecao possui pagamento derivado ou outra saida dependente.';
  end if;

  if exists (
    select 1
    from public.entradas_avulsas e
    where e.contrato_financeiro_id = v_contrato_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'O contrato possui entrada financeira vinculada e nao pode ser excluido.';
  end if;

  if exists (
    select 1 from public.manutencao_pagamentos x where x.saida_id = any(v_saida_ids)
  ) or exists (
    select 1 from public.saidas_abastecimentos x where x.saida_id = any(v_saida_ids)
  ) or exists (
    select 1 from public.saidas_manutencoes x where x.saida_id = any(v_saida_ids)
  ) or exists (
    select 1 from public.saidas_recargas_eletricas x where x.saida_id = any(v_saida_ids)
  ) or exists (
    select 1 from public.saidas_tag x where x.saida_id = any(v_saida_ids)
  ) or exists (
    select 1 from public.veiculos_cobrancas_geradas x where x.saida_id = any(v_saida_ids)
  ) or exists (
    select 1 from public.veiculos_documentos x where x.saida_id = any(v_saida_ids)
  ) then
    raise exception using
      errcode = '23514',
      message = 'Uma saida possui vinculo operacional ou documental que deve ser preservado.';
  end if;

  select
    coalesce(array_agg(distinct sp.fatura_id order by sp.fatura_id) filter (where sp.fatura_id is not null), '{}'::bigint[]),
    count(*)::integer
  into v_fatura_ids, v_linhas_fatura_esperadas
  from public.saidas_parcelas sp
  where sp.saida_id = any(v_saida_ids);

  perform 1
  from public.saidas_parcelas sp
  where sp.saida_id = any(v_saida_ids)
  for update;

  perform 1
  from public.faturas_cartao f
  where f.id = any(v_fatura_ids)
  for update;

  if exists (
    select 1
    from public.saidas_parcelas sp
    join public.saidas s on s.id = sp.saida_id
    where sp.saida_id = any(v_saida_ids)
      and (
        sp.fatura_id is null
        or sp.cartao_id is distinct from s.cartao_id
        or sp.numero_parcela <> 1
        or coalesce(sp.total_parcelas, 1) <> 1
        or round(coalesce(sp.valor_parcela, 0), 2) <> round(coalesce(s.valor_total, 0), 2)
        or lower(coalesce(sp.status, '')) not in ('pendente', 'aberta')
      )
  ) or exists (
    select 1
    from public.saidas s
    where s.id = any(v_saida_ids)
      and lower(coalesce(s.status, '')) = 'fatura'
      and not exists (
        select 1 from public.saidas_parcelas sp where sp.saida_id = s.id
      )
  ) or exists (
    select 1
    from public.saidas s
    where s.id = any(v_saida_ids)
      and lower(coalesce(s.status, '')) <> 'fatura'
      and exists (
        select 1 from public.saidas_parcelas sp where sp.saida_id = s.id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Uma parcela de cartao relacionada nao pode ser classificada com seguranca.';
  end if;

  if exists (
    select 1
    from public.faturas_cartao f
    where f.id = any(v_fatura_ids)
      and (
        coalesce(f.valor_pago, 0) <> 0
        or lower(coalesce(f.status, '')) <> 'aberta'
        or f.renegociacao_id is not null
      )
  ) or exists (
    select 1
    from public.saidas pagamento_fatura
    where pagamento_fatura.fatura_pagamento_id = any(v_fatura_ids)
  ) then
    raise exception using
      errcode = '23514',
      message = 'Uma fatura relacionada possui pagamento, fechamento ou renegociacao.';
  end if;

  if exists (
    select 1
    from public.renegociacoes_itens ri
    where (ri.tipo_origem = 'conta' and ri.origem_id = any(v_saida_ids))
       or (ri.tipo_origem = 'fatura' and ri.origem_id = any(v_fatura_ids))
       or ri.payload->>'contrato_financeiro_id' = v_contrato_id::text
  ) then
    raise exception using
      errcode = '23514',
      message = 'A protecao possui item de renegociacao relacionado.';
  end if;

  delete from public.saidas_parcelas sp
  where sp.saida_id = any(v_saida_ids);
  get diagnostics v_linhas_fatura_removidas = row_count;

  if v_linhas_fatura_removidas <> v_linhas_fatura_esperadas then
    raise exception 'A quantidade de linhas de fatura removidas divergiu da quantidade validada.';
  end if;

  update public.faturas_cartao f
  set valor_total = coalesce((
    select round(sum(sp.valor_parcela), 2)
    from public.saidas_parcelas sp
    where sp.fatura_id = f.id
  ), 0)
  where f.id = any(v_fatura_ids);
  get diagnostics v_faturas_recalculadas = row_count;

  update public.contratos_financeiros_parcelas p
  set saida_id = null
  where p.id = any(v_parcela_ids)
    and p.saida_id is not null;

  delete from public.saidas s
  where s.id = any(v_saida_ids);
  get diagnostics v_saidas_removidas = row_count;

  if v_saidas_removidas <> v_saidas_esperadas then
    raise exception 'A quantidade de saidas removidas divergiu da quantidade validada.';
  end if;

  delete from public.contratos_financeiros_parcelas p
  where p.id = any(v_parcela_ids);
  get diagnostics v_parcelas_removidas = row_count;

  if v_parcelas_removidas <> v_parcelas_esperadas then
    raise exception 'A quantidade de parcelas removidas divergiu da quantidade validada.';
  end if;

  delete from public.contratos_financeiros_planos_cobranca p
  where p.id = any(v_plano_ids);
  get diagnostics v_planos_removidos = row_count;

  if v_planos_removidos <> v_planos_esperados then
    raise exception 'A quantidade de planos removidos divergiu da quantidade validada.';
  end if;

  delete from public.veiculos_protecoes vp
  where vp.id = p_protecao_id
    and vp.contrato_financeiro_id = v_contrato_id;
  get diagnostics v_registros_afetados = row_count;

  if v_registros_afetados <> 1 then
    raise exception 'A protecao validada nao foi removida.';
  end if;

  delete from public.contratos_financeiros cf
  where cf.id = v_contrato_id;
  get diagnostics v_registros_afetados = row_count;

  if v_registros_afetados <> 1 then
    raise exception 'O contrato financeiro validado nao foi removido.';
  end if;

  if exists (select 1 from public.veiculos_protecoes where id = p_protecao_id)
    or exists (select 1 from public.contratos_financeiros where id = v_contrato_id)
    or exists (select 1 from public.contratos_financeiros_planos_cobranca where id = any(v_plano_ids))
    or exists (select 1 from public.contratos_financeiros_parcelas where id = any(v_parcela_ids))
    or exists (select 1 from public.saidas where id = any(v_saida_ids))
    or exists (select 1 from public.saidas_parcelas where saida_id = any(v_saida_ids)) then
    raise exception 'A verificacao final encontrou registros relacionados remanescentes.';
  end if;

  return jsonb_build_object(
    'protecao_id', p_protecao_id,
    'contrato_id', v_contrato_id,
    'planos_removidos', v_planos_removidos,
    'parcelas_removidas', v_parcelas_removidas,
    'saidas_removidas', v_saidas_removidas,
    'linhas_fatura_removidas', v_linhas_fatura_removidas,
    'faturas_recalculadas', v_faturas_recalculadas
  );
end;
$$;

comment on function public.excluir_protecao_veicular_definitivamente(bigint) is
  'Exclui atomicamente uma protecao inativa e cancelada sem historico financeiro; operacao administrativa restrita ao service_role.';

revoke all on function public.excluir_protecao_veicular_definitivamente(bigint) from public;
revoke all on function public.excluir_protecao_veicular_definitivamente(bigint) from anon;
revoke all on function public.excluir_protecao_veicular_definitivamente(bigint) from authenticated;
grant execute on function public.excluir_protecao_veicular_definitivamente(bigint) to service_role;
