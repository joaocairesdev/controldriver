import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function ler(caminho) {
  return readFile(new URL(caminho, import.meta.url), "utf8");
}

test("card preserva o conteúdo e separa abertura do extrato das ações internas", async () => {
  const fonte = await ler("../components/PlataformasFinanceiras.jsx");

  assert.match(fonte, /onClick=\{onAbrirExtrato\}/);
  assert.match(fonte, /event\.stopPropagation\(\);\s+onSacar\(\);/);
  assert.match(fonte, /event\.stopPropagation\(\);\s+onConfigurar\(\);/);
  assert.match(fonte, /Saldo pendente de conciliação/);
  assert.match(fonte, />\s*Sacar\s*</);
});

test("extrato reutiliza a edição de ganhos e oferece todos os filtros rápidos", async () => {
  const [container, extrato] = await Promise.all([
    ler("../components/PlataformasFinanceiras.jsx"),
    ler("../components/ExtratoPlataformaModal.jsx"),
  ]);

  assert.match(container, /<GanhosPlataformaModal/);
  assert.match(container, /carregarEntradaPlataformaParaEdicao/);
  for (const filtro of ["Todos", "Ganhos", "Saques", "Recebimentos", "Taxas", "Conciliações"]) {
    assert.match(extrato, new RegExp(`titulo: "${filtro}"`));
  }
  assert.match(extrato, /Período liquidado/);
  assert.match(extrato, /Ganho lançado após a liquidação do ciclo/);
  assert.match(extrato, /movimentacao\.statusTaxaTexto/);
  assert.match(container, /titulo="Valor líquido"/);
});

test("edição do saque mantém transferência, data e taxa na mesma função SQL", async () => {
  const migration = await ler(
    "../../../../supabase/migrations/20260805120000_editar_saque_plataforma.sql",
  );

  assert.match(migration, /create or replace function public\.editar_saque_plataforma/);
  assert.match(migration, /update public\.transferencias[\s\S]*data = coalesce\(p_data/);
  assert.match(migration, /valor = v_valor_liquido/);
  assert.match(migration, /valor_bruto = round\(p_valor_bruto, 2\)/);
  assert.match(migration, /update public\.saidas[\s\S]*valor_total = round\(p_taxa, 2\)/);
  assert.match(migration, /categoria = 'Taxa de Saque da Plataforma'/);
  assert.match(migration, /insert into public\.saidas/);
  assert.match(migration, /delete from public\.saidas/);
});
