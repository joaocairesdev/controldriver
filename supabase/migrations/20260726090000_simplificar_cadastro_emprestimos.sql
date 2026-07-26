-- Permite que o cadastro represente somente a obrigação contratual.
-- Formas e origens reais continuam sendo registradas ao pagar a Conta a Pagar.

alter table public.contratos_financeiros
  alter column forma_pagamento drop not null;

alter table public.contratos_financeiros
  drop constraint if exists contratos_financeiros_pagamento_check;

alter table public.contratos_financeiros
  add constraint contratos_financeiros_pagamento_check check (
    (
      forma_pagamento is null
      and conta_pagamento_id is null
      and cartao_pagamento_id is null
    )
    or (
      forma_pagamento in ('credito_avista', 'credito_parcelado')
      and cartao_pagamento_id is not null
      and conta_pagamento_id is null
    )
    or (
      forma_pagamento is not null
      and forma_pagamento not in ('credito_avista', 'credito_parcelado')
      and conta_pagamento_id is not null
      and cartao_pagamento_id is null
    )
  );

create or replace function public.criar_contrato_financeiro(
  p_contrato jsonb,
  p_parcelas jsonb
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_contrato_id bigint;
  v_parcela_id bigint;
  v_saida_id bigint;
  v_parcela jsonb;
  v_total_parcelas numeric;
  v_forma_pagamento text;
  v_conta_pagamento_id bigint;
  v_cartao_pagamento_id bigint;
begin
  if jsonb_typeof(p_parcelas) <> 'array'
    or jsonb_array_length(p_parcelas) <> (p_contrato->>'quantidade_parcelas')::integer then
    raise exception 'A agenda de parcelas não corresponde à quantidade informada.';
  end if;

  select coalesce(sum((item->>'valor')::numeric), 0)
  into v_total_parcelas
  from jsonb_array_elements(p_parcelas) as item;

  if round(v_total_parcelas, 2) <> round((p_contrato->>'valor_contratado')::numeric, 2) then
    raise exception 'A soma das parcelas não corresponde ao valor contratado.';
  end if;

  v_forma_pagamento := nullif(p_contrato->>'forma_pagamento', '');
  v_conta_pagamento_id := nullif(p_contrato->>'conta_pagamento_id', '')::bigint;
  v_cartao_pagamento_id := nullif(p_contrato->>'cartao_pagamento_id', '')::bigint;

  insert into public.contratos_financeiros (
    tipo_contrato,
    tipo_credor,
    credor_nome,
    valor_recebido,
    valor_contratado,
    taxa_juros_percentual,
    data_contratacao,
    data_recebimento,
    conta_recebimento_id,
    descricao,
    observacoes,
    modo_pagamento,
    quantidade_parcelas,
    valor_parcela,
    primeiro_vencimento,
    periodicidade,
    forma_pagamento,
    conta_pagamento_id,
    cartao_pagamento_id
  ) values (
    coalesce(p_contrato->>'tipo_contrato', 'emprestimo'),
    p_contrato->>'tipo_credor',
    trim(p_contrato->>'credor_nome'),
    (p_contrato->>'valor_recebido')::numeric,
    (p_contrato->>'valor_contratado')::numeric,
    coalesce((p_contrato->>'taxa_juros_percentual')::numeric, 0),
    (p_contrato->>'data_contratacao')::date,
    (p_contrato->>'data_recebimento')::date,
    (p_contrato->>'conta_recebimento_id')::bigint,
    nullif(trim(p_contrato->>'descricao'), ''),
    nullif(trim(p_contrato->>'observacoes'), ''),
    p_contrato->>'modo_pagamento',
    (p_contrato->>'quantidade_parcelas')::integer,
    (p_contrato->>'valor_parcela')::numeric,
    (p_contrato->>'primeiro_vencimento')::date,
    coalesce(nullif(p_contrato->>'periodicidade', ''), 'mensal'),
    v_forma_pagamento,
    v_conta_pagamento_id,
    v_cartao_pagamento_id
  ) returning id into v_contrato_id;

  insert into public.entradas_avulsas (
    data,
    conta_id,
    valor,
    descricao,
    finalidade,
    contrato_financeiro_id
  ) values (
    (p_contrato->>'data_recebimento')::date,
    (p_contrato->>'conta_recebimento_id')::bigint,
    (p_contrato->>'valor_recebido')::numeric,
    coalesce(nullif(trim(p_contrato->>'descricao'), ''), 'Empréstimo recebido - ' || trim(p_contrato->>'credor_nome')),
    null,
    v_contrato_id
  );

  for v_parcela in select value from jsonb_array_elements(p_parcelas)
  loop
    insert into public.contratos_financeiros_parcelas (
      contrato_id,
      numero,
      data_vencimento,
      valor
    ) values (
      v_contrato_id,
      (v_parcela->>'numero')::integer,
      (v_parcela->>'vencimento')::date,
      (v_parcela->>'valor')::numeric
    ) returning id into v_parcela_id;

    insert into public.saidas (
      data_compra,
      forma_pagamento,
      conta_id,
      cartao_id,
      numero_parcelas,
      valor_total,
      valor_parcela,
      categoria,
      descricao,
      status,
      tipo_movimentacao,
      data_vencimento,
      finalidade,
      contrato_financeiro_id,
      contrato_financeiro_parcela_id
    ) values (
      (v_parcela->>'vencimento')::date,
      coalesce(v_forma_pagamento, 'pendente'),
      v_conta_pagamento_id,
      v_cartao_pagamento_id,
      1,
      (v_parcela->>'valor')::numeric,
      (v_parcela->>'valor')::numeric,
      'Empréstimo',
      'Parcela ' || (v_parcela->>'numero') || '/' || (p_contrato->>'quantidade_parcelas') || ' - ' || trim(p_contrato->>'credor_nome'),
      'aberto',
      'conta_pagar',
      (v_parcela->>'vencimento')::date,
      null,
      v_contrato_id,
      v_parcela_id
    ) returning id into v_saida_id;

    update public.contratos_financeiros_parcelas
    set saida_id = v_saida_id
    where id = v_parcela_id;
  end loop;

  return v_contrato_id;
end;
$$;

create or replace function public.excluir_contrato_financeiro_seguro(
  p_contrato_id bigint
)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  perform id
  from public.contratos_financeiros
  where id = p_contrato_id
  for update;

  if not found then
    raise exception 'Empréstimo não encontrado.';
  end if;

  if exists (
    select 1
    from public.contratos_financeiros_parcelas p
    left join public.saidas s on s.id = p.saida_id
    where p.contrato_id = p_contrato_id
      and (
        p.valor_pago > 0
        or p.status <> 'aberta'
        or coalesce(s.valor_pago, 0) > 0
        or coalesce(s.status, 'aberto') not in ('aberto', 'pendente')
      )
  ) or exists (
    select 1
    from public.saidas s
    where s.contrato_financeiro_id = p_contrato_id
      and s.tipo_movimentacao <> 'conta_pagar'
  ) then
    raise exception 'Este empréstimo possui pagamentos ou histórico protegido e não pode ser excluído.';
  end if;

  update public.contratos_financeiros_parcelas
  set saida_id = null
  where contrato_id = p_contrato_id;

  delete from public.saidas
  where contrato_financeiro_id = p_contrato_id
    and tipo_movimentacao = 'conta_pagar';

  delete from public.contratos_financeiros_parcelas
  where contrato_id = p_contrato_id;

  delete from public.entradas_avulsas
  where contrato_financeiro_id = p_contrato_id;

  delete from public.contratos_financeiros
  where id = p_contrato_id;

  return true;
end;
$$;

grant execute on function public.excluir_contrato_financeiro_seguro(bigint)
  to anon, authenticated, service_role;
