-- Substitui os metadados de motivo por uma composição de itens da parcela.
-- Preserva ajustes eventualmente gravados pela migration anterior.

alter table public.saidas
  add column if not exists itens_parcela jsonb;

update public.saidas
set itens_parcela = jsonb_build_array(
  jsonb_build_object(
    'id', 'origem',
    'nome', coalesce(nullif(descricao, ''), categoria, 'Contrato financeiro'),
    'valor_previsto', coalesce(valor_previsto, valor_total),
    'valor_atualizado', valor_total,
    'observacao', nullif(descricao_ajuste_parcela, '')
  )
)
where itens_parcela is null
  and (
    valor_previsto is not null
    or motivo_ajuste_parcela is not null
    or descricao_ajuste_parcela is not null
  );

alter table public.saidas
  drop constraint if exists saidas_valor_previsto_positivo_check,
  drop constraint if exists saidas_motivo_ajuste_parcela_check;

alter table public.saidas
  drop column if exists valor_previsto,
  drop column if exists motivo_ajuste_parcela,
  drop column if exists descricao_ajuste_parcela;

alter table public.saidas
  add constraint saidas_itens_parcela_array_check
  check (itens_parcela is null or jsonb_typeof(itens_parcela) = 'array');

comment on column public.saidas.itens_parcela is
  'Composição opcional da cobrança contratual, com valor previsto e atualizado por origem.';
