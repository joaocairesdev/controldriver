begin;

do $$
declare
  v_fatura_ativa_id bigint;
begin
  perform 1
  from public.renegociacoes
  where id = 3
  for update;

  if not found then
    raise exception 'Renegociacao 3 nao encontrada; nenhuma correcao foi aplicada.';
  end if;

  if not exists (
    select 1 from public.faturas_cartao
    where id in (13, 14) and cartao_id = 6
      and status = 'renegociada' and renegociacao_id = 3
    group by cartao_id having count(*) = 2
  ) then
    raise exception 'Faturas historicas 13 e 14 nao correspondem ao estado auditado.';
  end if;

  if not exists (
    select 1 from public.faturas_cartao
    where id = 13 and round(valor_total, 2) = 334.25
  ) or not exists (
    select 1 from public.saidas_parcelas
    where id = 61 and saida_id = 262 and cartao_id = 6
      and fatura_id = 13 and round(valor_parcela, 2) = 100.00
  ) then
    raise exception 'Compra posterior de R$ 100,00 nao corresponde ao estado auditado.';
  end if;

  if exists (
    select 1 from public.faturas_cartao ativa
    join public.faturas_cartao historica
      on historica.id = 13
     and ativa.cartao_id = historica.cartao_id
     and ativa.mes = historica.mes
     and ativa.ano = historica.ano
    where ativa.status in ('aberta', 'fechada', 'parcial')
  ) then
    raise exception 'Ja existe fatura ativa para a competencia da fatura 13.';
  end if;

  insert into public.faturas_cartao (
    cartao_id, mes_referencia, ano_referencia, data_fechamento,
    data_vencimento_prevista, data_vencimento_real, valor_total, status,
    mes, ano, data_vencimento, valor_pago, renegociacao_id
  )
  select
    cartao_id, mes_referencia, ano_referencia, data_fechamento,
    data_vencimento_prevista, data_vencimento_real, 100.00, 'aberta',
    mes, ano, data_vencimento, 0, null
  from public.faturas_cartao where id = 13
  returning id into v_fatura_ativa_id;

  update public.saidas_parcelas
  set fatura_id = v_fatura_ativa_id
  where id = 61 and fatura_id = 13;
  if not found then raise exception 'Parcela 61 nao pode ser movida com seguranca.'; end if;

  update public.faturas_cartao
  set valor_total = 234.25
  where id = 13 and valor_total = 334.25
    and status = 'renegociada' and renegociacao_id = 3;
  if not found then raise exception 'Fatura 13 nao pode ser restaurada ao total historico.'; end if;

  if (select round(coalesce(sum(valor_parcela), 0), 2)
      from public.saidas_parcelas where fatura_id = 13) <> 234.25
    or (select round(coalesce(sum(valor_parcela), 0), 2)
        from public.saidas_parcelas where fatura_id = v_fatura_ativa_id) <> 100.00 then
    raise exception 'Validacao final dos totais falhou.';
  end if;
end;
$$;

commit;
