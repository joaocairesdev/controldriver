begin;

drop index if exists public.faturas_cartao_cartao_mes_ano_idx;

create unique index faturas_cartao_ativa_cartao_mes_ano_idx
on public.faturas_cartao using btree (cartao_id, mes, ano)
where status in ('aberta', 'fechada', 'parcial');

commit;
