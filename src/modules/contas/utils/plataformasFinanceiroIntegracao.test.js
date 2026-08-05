import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function ler(caminho) {
  return readFile(new URL(caminho, import.meta.url), "utf8");
}

test("card preserva o conteúdo e separa abertura do extrato das ações internas", async () => {
  const fonte = await ler("../components/PlataformasFinanceiras.jsx");

  assert.match(fonte, /onClick=\{onAbrirExtrato\}/);
  assert.match(fonte, /event\.stopPropagation\(\);\s+if \(permiteSaque\) onSacar\(\);/);
  assert.match(fonte, /event\.stopPropagation\(\);\s+onConfigurar\(\);/);
  assert.match(fonte, /Saldo pendente de conciliação/);
  assert.match(fonte, />\s*Sacar\s*</);
});

test("extrato mantém ganhos somente leitura e oferece busca e paginação", async () => {
  const [container, extrato] = await Promise.all([
    ler("../components/PlataformasFinanceiras.jsx"),
    ler("../components/ExtratoPlataformaModal.jsx"),
  ]);

  assert.doesNotMatch(container, /<GanhosPlataformaModal/);
  assert.doesNotMatch(container, /carregarEntradaPlataformaParaEdicao/);
  assert.match(extrato, /Pesquisar por descrição, tipo, valor ou data/);
  assert.match(extrato, /const ITENS_POR_PAGINA = 50/);
  assert.match(extrato, /Período liquidado/);
  assert.match(extrato, /Ganho lançado após o pagamento semanal/);
  assert.match(extrato, /movimentacao\.statusTaxaTexto/);
  assert.match(extrato, /Excluir recebimento automático/);
  assert.match(container, /titulo="Valor líquido"/);
});

test("cards respeitam visibilidade, saldo e grid responsiva", async () => {
  const fonte = await ler("../components/PlataformasFinanceiras.jsx");

  assert.match(fonte, /plataforma\.exibir_nas_contas !== false/);
  assert.match(fonte, /grid-cols-1 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6/);
  assert.match(fonte, /Number\(plataforma\.saldo \|\| 0\) > 0/);
  assert.match(fonte, /disabled=\{!permiteSaque\}/);
  assert.match(fonte, /Exibir nas Contas/);
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

test("preferência de exibição possui migration sem alterar regras financeiras", async () => {
  const [migration, servico] = await Promise.all([
    ler("../../../../supabase/migrations/20260805150000_exibir_plataformas_nas_contas.sql"),
    ler("../services/plataformasFinanceiroService.js"),
  ]);

  assert.match(migration, /add column if not exists exibir_nas_contas boolean not null default true/);
  assert.match(servico, /\.eq\("tipo", "recebimento_automatico_plataforma"\)/);
  assert.match(servico, /\.update\(\{ exibir_nas_contas: Boolean\(exibir\) \}\)/);
});
