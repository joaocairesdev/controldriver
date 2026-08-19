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
  assert.match(extrato, /onEditarRecebimento/);
  assert.match(extrato, /movimentacao\.statusTaxaTexto/);
  assert.match(extrato, /Excluir recebimento semanal automático/);
  assert.match(container, /titulo="Valor líquido"/);
});

test("cards preservam todas as plataformas e a hierarquia visual responsiva", async () => {
  const fonte = await ler("../components/PlataformasFinanceiras.jsx");

  assert.match(fonte, /plataformasVisiveis\.map\(\(plataforma\)/);
  assert.match(fonte, /grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5/);
  assert.match(fonte, /Number\(plataforma\.saldo \|\| 0\) > 0/);
  assert.match(fonte, /disabled=\{!permiteSaque\}/);
  assert.match(fonte, /className="h-10 w-10 object-contain"/);
  assert.match(fonte, /break-words text-base font-black/);
  assert.match(fonte, /mt-auto h-9 w-full/);
  assert.doesNotMatch(fonte, /font-black truncate/);
});

test("lista usa logo, nome e switch apenas para exibição de plataformas sem saldo", async () => {
  const fonte = await ler("../components/PlataformasFinanceiras.jsx");

  assert.match(fonte, /function ListaConfiguracaoPlataformasModal/);
  assert.match(fonte, /<LogoPlataforma nome=\{plataforma\.nome\}/);
  assert.match(fonte, /Mostrar mesmo sem saldo/);
  assert.match(fonte, /<ToggleSwitch[\s\S]*onAlternarExibicao\(plataforma, valor\)/);
  assert.doesNotMatch(fonte, /Participa do Saldo Consolidado/);
  assert.match(fonte, /plataformas\.length > 8/);
  assert.match(fonte, /placeholder="Buscar\.\.\."/);
  assert.doesNotMatch(fonte, /não pode ser ocultada/);
  assert.doesNotMatch(fonte, /Configurar recebimentos e taxas de saque\./);
  assert.doesNotMatch(fonte, /Plataformas com saldo não podem ser ocultadas\./);
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

test("preferência persistida controla a exibição sem alterar regras financeiras", async () => {
  const [migration, servico] = await Promise.all([
    ler("../../../../supabase/migrations/20260805150000_exibir_plataformas_nas_contas.sql"),
    ler("../services/plataformasFinanceiroService.js"),
  ]);

  assert.match(migration, /add column if not exists exibir_nas_contas boolean not null default true/);
  assert.match(servico, /supabase\.rpc\("excluir_recebimento_semanal_plataforma"/);
  assert.match(servico, /\.update\(\{ exibir_nas_contas: Boolean\(participa\) \}\)/);
});

test("recebimento semanal permite editar metadados sem alterar o valor", async () => {
  const [modal, extrato, migration] = await Promise.all([
    ler("../components/EditarRecebimentoSemanalModal.jsx"),
    ler("../components/ExtratoPlataformaModal.jsx"),
    ler("../../../../supabase/migrations/20260806120000_manter_historico_recebimentos_saques_plataformas.sql"),
  ]);

  assert.match(extrato, /onEditarRecebimento/);
  assert.match(extrato, /<FiEdit2 \/>[\s\S]*Editar/);
  assert.match(extrato, /<FiTrash2 \/>[\s\S]*Excluir/);
  assert.match(modal, /editarRecebimentoSemanalPlataforma/);
  assert.match(modal, /titulo="Editar recebimento semanal automático"/);
  assert.match(modal, /O valor é definido pelo histórico da carteira e não pode ser alterado/);
  assert.doesNotMatch(modal, /setValor/);
  assert.match(migration, /create or replace function public\.editar_recebimento_semanal_plataforma/);
  assert.match(migration, /data = p_data/);
  assert.match(migration, /conta_destino_id = p_conta_destino_id/);
  assert.match(migration, /descricao = nullif\(trim\(p_descricao\), ''\)/);
  assert.match(migration, /'recebimento_direto_plataforma'/);
  assert.match(migration, /create or replace function public\.excluir_recebimento_semanal_plataforma/);
  assert.match(migration, /destino_financeiro = 'plataforma'/);
  assert.doesNotMatch(
    migration.match(/create or replace function public\.editar_recebimento_semanal_plataforma[\s\S]*?\$\$;/)?.[0] || "",
    /valor\s*=/,
  );
});

test("extratos e detalhes usam a nomenclatura semanal e oferecem manutenção", async () => {
  const fontes = await Promise.all([
    ler("../components/ExtratoPlataformaModal.jsx"),
    ler("../components/ModalExtratoConta.jsx"),
    ler("../../extrato/pages/Extrato.jsx"),
    ler("../../extrato/components/DetalhesLancamentoModal.jsx"),
    ler("./plataformasFinanceiro.js"),
  ]);
  const interfaceCompleta = fontes.join("\n");
  const nomeRemovido = ["Recebimento complementar", "automático"].join(" ");

  assert.doesNotMatch(interfaceCompleta, new RegExp(nomeRemovido, "i"));
  assert.match(fontes[1], /Recebimento semanal automático/);
  assert.match(fontes[2], /<EditarRecebimentoSemanalModal/);
  assert.match(fontes[2], /excluirRecebimentoAutomaticoPlataforma/);
  assert.match(fontes[3], /recebimentoAutomatico[\s\S]*<FiEdit2 \/> Editar/);
  assert.match(fontes[3], /recebimentoAutomatico[\s\S]*<FiTrash2 \/> Excluir/);
});

test("saque histórico recupera o bruto e sincroniza criação, edição e remoção da taxa", async () => {
  const [container, migration] = await Promise.all([
    ler("../components/PlataformasFinanceiras.jsx"),
    ler("../../../../supabase/migrations/20260806120000_manter_historico_recebimentos_saques_plataformas.sql"),
  ]);

  assert.match(container, /obterValorBrutoTransferencia\(saque\)/);
  assert.match(container, /opcoes=\{tiposDisponiveis\}/);
  assert.match(migration, /where transferencia\.tipo = 'saque_plataforma'[\s\S]*valor_bruto is null/);
  assert.match(migration, /taxa\.saque_transferencia_id = transferencia\.id/);
  assert.match(migration, /insert into public\.saidas/);
  assert.match(migration, /update public\.saidas[\s\S]*valor_total = round\(p_taxa, 2\)/);
  assert.match(migration, /elsif v_taxa_id is not null then\s*delete from public\.saidas/);
  const edicaoSaque = migration.match(
    /create or replace function public\.editar_saque_plataforma[\s\S]*?grant execute on function public\.editar_saque_plataforma/,
  )?.[0] || "";
  assert.doesNotMatch(edicaoSaque, /and modo_recebimento = 'retido'/);
});

test("recebimentos novos são exclusivamente manuais", async () => {
  const [app, container, extrato, servico, migration] = await Promise.all([
    ler("../../../app/AppShell.jsx"),
    ler("../components/PlataformasFinanceiras.jsx"),
    ler("../components/ExtratoPlataformaModal.jsx"),
    ler("../services/plataformasFinanceiroService.js"),
    ler("../../../../supabase/migrations/20260807120000_recebimentos_plataformas_manuais.sql"),
  ]);

  assert.doesNotMatch(app, /processarRecebimentosAutomaticos/);
  assert.doesNotMatch(servico, /processar_recebimentos_automaticos/);
  assert.doesNotMatch(servico, /ultimaLiquidacao|proximoRecebimento/);
  assert.match(container, /titulo: "Recebimento semanal"/);
  assert.match(container, /titulo: "Saque instantâneo"/);
  assert.match(container, /titulo: "Saque agendado"/);
  assert.match(container, /disabled=\{tipoSaque === "semanal"\}/);
  assert.match(container, /label="Dia do recebimento semanal"/);
  assert.doesNotMatch(container, /Modo de recebimento/);
  assert.doesNotMatch(extrato, /Última liquidação/);
  assert.doesNotMatch(extrato, /Próximo recebimento semanal automático/);
  assert.match(migration, /drop function if exists public\.processar_recebimentos_automaticos\(date\)/);
  assert.match(migration, /drop function if exists public\.processar_recebimento_automatico_plataforma/);
  assert.match(migration, /new\.destino_financeiro := 'plataforma'/);
  assert.match(migration, /p_tipo_saque not in \('semanal', 'instantaneo', 'agendado'\)/);
  assert.match(migration, /when p_tipo_saque = 'semanal' then 0/);
  assert.match(migration, /'Recebimento semanal da plataforma '/);
});

test("extrato abre diretamente a manutenção do saque e permite exclusão transacional", async () => {
  const [extrato, container, servico, migration] = await Promise.all([
    ler("../components/ExtratoPlataformaModal.jsx"),
    ler("../components/PlataformasFinanceiras.jsx"),
    ler("../services/plataformasFinanceiroService.js"),
    ler("../../../../supabase/migrations/20260806120000_manter_historico_recebimentos_saques_plataformas.sql"),
  ]);

  assert.match(
    extrato,
    /if \(movimentacao\.tipo === "saque"\) \{\s*onEditarSaque\?\.\(movimentacao\);\s*return;/,
  );
  assert.doesNotMatch(extrato, /const saque = movimentacao\.tipo === "saque"/);
  assert.match(container, /<Campo label="Data do saque"/);
  assert.match(container, /<Campo label="Valor bruto"/);
  assert.match(container, /<Campo label="Conta destino"/);
  assert.match(container, /<Campo label="Tipo do saque"/);
  assert.match(container, /<Campo label="Taxa"/);
  assert.match(container, /<ResumoLinha titulo="Valor líquido"/);
  assert.match(container, /z=\{emEdicao \? "z-\[200\]" : "z-\[100\]"\}/);
  assert.match(container, /Excluir saque/);
  assert.match(container, /<ConfirmacaoModal[\s\S]*titulo="Excluir saque\?"/);
  assert.match(container, /onExcluido=/);
  assert.match(servico, /supabase\.rpc\("excluir_saque_plataforma"/);
  assert.match(migration, /create or replace function public\.excluir_saque_plataforma/);
  assert.match(migration, /delete from public\.saidas[\s\S]*saque_transferencia_id = p_transferencia_id/);
  assert.match(migration, /delete from public\.transferencias[\s\S]*tipo = 'saque_plataforma'/);
});

test("novo saque aceita data histórica e bloqueia datas futuras em toda a transação", async () => {
  const [container, migration] = await Promise.all([
    ler("../components/PlataformasFinanceiras.jsx"),
    ler("../../../../supabase/migrations/20260806120000_manter_historico_recebimentos_saques_plataformas.sql"),
  ]);

  assert.match(container, /const \[dataSaque, setDataSaque\] = useState\(saque\?\.data \|\| hojeBrasil\(\)\)/);
  assert.match(container, /<Campo label="Data do saque" erro=\{erros\.dataSaque\}/);
  assert.doesNotMatch(container, /\{emEdicao \? \(\s*<Campo label="Data do saque"/);
  assert.match(container, /if \(dataSaque > hojeBrasil\(\)\)/);
  assert.match(container, /maxDate=\{hojeBrasil\(\)\}/);
  assert.match(migration, /create or replace function public\.registrar_saque_plataforma/);
  assert.match(migration, /v_data date := coalesce\(p_data, current_date\)/);
  assert.match(migration, /if v_data > current_date then/);
  assert.match(migration, /insert into public\.transferencias[\s\S]*\) values \(\s*v_data,/);
  assert.match(migration, /insert into public\.saidas[\s\S]*\) values \(\s*v_data,[\s\S]*v_data,/);
  assert.match(migration, /create or replace function public\.editar_saque_plataforma[\s\S]*coalesce\(p_data, current_date\) > current_date/);
});
