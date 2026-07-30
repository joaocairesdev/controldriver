alter table public.saidas
  add column if not exists valor_previsto numeric(14,2),
  add column if not exists motivo_ajuste_parcela text,
  add column if not exists descricao_ajuste_parcela text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saidas_valor_previsto_positivo_check'
      and conrelid = 'public.saidas'::regclass
  ) then
    alter table public.saidas
      add constraint saidas_valor_previsto_positivo_check
      check (valor_previsto is null or valor_previsto > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'saidas_motivo_ajuste_parcela_check'
      and conrelid = 'public.saidas'::regclass
  ) then
    alter table public.saidas
      add constraint saidas_motivo_ajuste_parcela_check
      check (
        motivo_ajuste_parcela is null
        or motivo_ajuste_parcela in (
          'juros',
          'multa',
          'juros_multa',
          'desconto',
          'amortizacao',
          'outro'
        )
      );
  end if;
end
$$;

comment on column public.saidas.valor_previsto is
  'Valor original da cobrança antes de um ajuste individual de parcela; nulo em registros legados sem ajuste.';
comment on column public.saidas.motivo_ajuste_parcela is
  'Motivo do ajuste individual aplicado à cobrança de uma parcela contratual.';
comment on column public.saidas.descricao_ajuste_parcela is
  'Descrição opcional do ajuste individual aplicado à cobrança de uma parcela contratual.';
