alter table public.plataformas
  add column if not exists exibir_nas_contas boolean not null default true;

comment on column public.plataformas.exibir_nas_contas is
  'Preferência de exibição da plataforma zerada no módulo Contas.';
