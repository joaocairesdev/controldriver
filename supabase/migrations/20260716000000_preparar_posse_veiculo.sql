-- MIGRATION PREPARADA, NÃO APLICADA AUTOMATICAMENTE.
-- Permite distinguir veículos próprios/alugados e, para próprios, quitados/financiados.
alter table public.veiculos
  add column tipo_posse text,
  add column situacao_aquisicao text;

alter table public.veiculos
  add constraint veiculos_tipo_posse_check
    check (tipo_posse is null or tipo_posse in ('proprio', 'alugado')),
  add constraint veiculos_situacao_aquisicao_check
    check (
      (tipo_posse is null and situacao_aquisicao is null)
      or (tipo_posse is not distinct from 'alugado' and situacao_aquisicao is null)
      or (
        tipo_posse is not distinct from 'proprio'
        and situacao_aquisicao is not null
        and situacao_aquisicao in ('quitado', 'financiado')
      )
    );

comment on column public.veiculos.tipo_posse is
  'Tipo de posse informado no cadastro: proprio ou alugado.';
comment on column public.veiculos.situacao_aquisicao is
  'Situação aplicável apenas a veículo próprio: quitado ou financiado.';
