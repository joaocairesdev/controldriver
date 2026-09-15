begin;

alter table public.contratos_financeiros
  add column data_inicio_controle_financeiro date;

alter table public.contratos_financeiros
  add constraint contratos_financeiros_inicio_controle_check
  check (
    data_inicio_controle_financeiro is null
    or data_inicio is null
    or data_inicio_controle_financeiro >= data_inicio
  );

create unique index saidas_contrato_parcela_canonica_unique_idx
  on public.saidas (contrato_financeiro_parcela_id)
  where contrato_financeiro_parcela_id is not null
    and conta_pagar_origem_id is null;

create unique index saidas_parcelas_saida_numero_unique_idx
  on public.saidas_parcelas (saida_id, numero_parcela)
  where saida_id is not null;

comment on column public.contratos_financeiros.data_inicio_controle_financeiro is
  'Primeiro vencimento inclusivo controlado financeiramente pelo ControlDriver. Obrigações anteriores permanecem históricas e não geram fatos financeiros retroativos.';

commit;
