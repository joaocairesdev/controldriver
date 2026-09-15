import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = new URL(
  "../../../../supabase/migrations/20260915120000_excluir_protecao_veicular_definitivamente.sql",
  import.meta.url,
);

async function lerMigration() {
  return readFile(migration, "utf8");
}

test("RPC e reutilizavel e nao contem IDs da Loovi hardcoded", async () => {
  const sql = await lerMigration();
  assert.match(sql, /excluir_protecao_veicular_definitivamente\(\s*p_protecao_id bigint/);
  assert.doesNotMatch(sql, /\b(?:10|495|496|497|498|499|500|501|502|503|504|505|506)\b/);
  assert.doesNotMatch(sql, /(?:vp|p|s|cf)\.id\s*=\s*1\b/);
});

test("RPC bloqueia o estado validado e cobre os historicos protegidos", async () => {
  const sql = await lerMigration();
  assert.match(sql, /lock table[\s\S]*public\.saidas[\s\S]*in share row exclusive mode/);
  assert.match(sql, /from public\.veiculos_protecoes vp[\s\S]*for update/);
  assert.match(sql, /coalesce\(p\.valor_pago, 0\) <> 0/);
  assert.match(sql, /pagamento\.conta_pagar_origem_id = any\(v_saida_ids\)/);
  assert.match(sql, /public\.renegociacoes_itens/);
  assert.match(sql, /public\.veiculos_documentos/);
  assert.match(sql, /A protecao nao possui contrato financeiro vinculado/);
  assert.match(sql, /Somente uma protecao inativa e encerrada/);
  assert.match(sql, /s\.financiamento_id is not null/);
});

test("faturas compartilhadas sao preservadas e recalculadas pelas linhas restantes", async () => {
  const sql = await lerMigration();
  assert.doesNotMatch(sql, /delete from public\.faturas_cartao/);
  assert.match(sql, /delete from public\.saidas_parcelas/);
  assert.match(sql, /select round\(sum\(sp\.valor_parcela\), 2\)/);
  assert.match(sql, /where sp\.fatura_id = f\.id/);
});

test("ordem de exclusao rompe as FKs antes de remover o contrato", async () => {
  const sql = await lerMigration();
  const ordem = [
    "delete from public.saidas_parcelas",
    "update public.contratos_financeiros_parcelas",
    "delete from public.saidas s",
    "delete from public.contratos_financeiros_parcelas p",
    "delete from public.contratos_financeiros_planos_cobranca p",
    "delete from public.veiculos_protecoes vp",
    "delete from public.contratos_financeiros cf",
  ].map((trecho) => sql.indexOf(trecho));

  assert.ok(ordem.every((indice) => indice >= 0));
  assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b));
});

test("deletes permanecem limitados aos IDs descobertos pelo vinculo da protecao", async () => {
  const sql = await lerMigration();
  assert.match(sql, /delete from public\.saidas s[\s\S]*where s\.id = any\(v_saida_ids\)/);
  assert.match(sql, /delete from public\.contratos_financeiros_parcelas p[\s\S]*where p\.id = any\(v_parcela_ids\)/);
  assert.match(sql, /delete from public\.contratos_financeiros_planos_cobranca p[\s\S]*where p\.id = any\(v_plano_ids\)/);
  assert.match(sql, /where vp\.id = p_protecao_id[\s\S]*vp\.contrato_financeiro_id = v_contrato_id/);
  assert.match(sql, /where cf\.id = v_contrato_id/);
});

test("execucao fica restrita ao service_role e conserva o invocador", async () => {
  const sql = await lerMigration();
  assert.match(sql, /security invoker/);
  assert.match(sql, /set search_path = pg_catalog, public/);
  assert.match(sql, /revoke all on function[\s\S]*from anon/);
  assert.match(sql, /revoke all on function[\s\S]*from authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /security definer/);
});

test("falhas de validacao e divergencias encerram a chamada com excecao", async () => {
  const sql = await lerMigration();
  assert.match(sql, /raise exception using[\s\S]*Protecao veicular nao encontrada/);
  assert.match(sql, /A quantidade de saidas removidas divergiu/);
  assert.match(sql, /A quantidade de linhas de fatura removidas divergiu/);
  assert.match(sql, /A verificacao final encontrou registros relacionados remanescentes/);
  assert.match(sql, /returns jsonb/);
});
