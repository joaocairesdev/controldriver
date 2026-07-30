import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raiz = new URL("../../", import.meta.url);

async function ler(caminho) {
  return readFile(new URL(caminho, raiz), "utf8");
}

test("empréstimos e renegociações reutilizam a mesma navegação de parcelas", async () => {
  const [emprestimos, renegociacoes] = await Promise.all([
    ler("modules/contratos/pages/Emprestimos.jsx"),
    ler("modules/renegociacoes/pages/Renegociacoes.jsx"),
  ]);

  for (const pagina of [emprestimos, renegociacoes]) {
    assert.match(pagina, /import ParcelasContrato/);
    assert.match(pagina, /import TelaParcelaContrato/);
    assert.match(pagina, /<ParcelasContrato/);
    assert.match(pagina, /<TelaParcelaContrato/);
  }
  assert.doesNotMatch(renegociacoes, /DetalheRenegociacaoModal/);
  assert.match(renegociacoes, /function TelaRenegociacao/);
});

test("lista separa parcelas abertas das pagas e inicia o histórico recolhido", async () => {
  const lista = await ler("shared/components/financeiro/ParcelasContrato.jsx");
  assert.match(lista, /useState\(false\)/);
  assert.match(lista, /Parcelas em aberto/);
  assert.match(lista, /Ver parcelas pagas/);
  assert.match(lista, /parcelaEstaAtrasada/);
});

test("tela da parcela não mostra nem solicita motivo", async () => {
  const [tela, utilitario] = await Promise.all([
    ler("shared/components/financeiro/TelaParcelaContrato.jsx"),
    ler("shared/utils/parcelasContratos.js"),
  ]);
  assert.match(tela, /Valor previsto/);
  assert.match(tela, /Valor atualizado/);
  assert.match(tela, /Diferença/);
  assert.match(tela, /Observação \(opcional\)/);
  assert.doesNotMatch(tela, /Motivo/);
  assert.doesNotMatch(utilitario, /juros|multa|amortizacao/);
  assert.match(tela, /alterado \?/);
  assert.match(tela, /Observação/);
});

test("resumo da renegociação mantém toda a hierarquia em um card", async () => {
  const [renegociacoes, resumo] = await Promise.all([
    ler("modules/renegociacoes/pages/Renegociacoes.jsx"),
    ler("shared/components/financeiro/ResumoContrato.jsx"),
  ]);
  assert.match(renegociacoes, /titulo="Resumo da renegociação"/);
  assert.match(renegociacoes, /Produtos renegociados/);
  assert.match(renegociacoes, /Saldo renegociado/);
  assert.match(renegociacoes, /Forma de pagamento/);
  assert.match(renegociacoes, /Tipo do acordo/);
  assert.match(renegociacoes, /principal: true/);
  assert.match(resumo, /produtosVisiveis/);
  assert.doesNotMatch(resumo, /divide-y/);
});

test("abastecimento usa cronologia e não pergunta se o tanque foi completado", async () => {
  const [modal, novaSaida, cronologia] = await Promise.all([
    ler("modules/abastecimentos/components/AbastecimentoModal.jsx"),
    ler("modules/saidas/pages/NovaSaida.jsx"),
    ler("modules/abastecimentos/utils/abastecimentosCronologia.js"),
  ]);

  assert.doesNotMatch(modal, /Completou o tanque|tanqueCheio|tanque_cheio|ToggleSwitch/);
  assert.doesNotMatch(modal, /Litros calculados|<ResumoItem|consumoCalculado/);
  assert.doesNotMatch(novaSaida, /Tanque cheio|tanqueCheio|tanque_cheio/);
  assert.doesNotMatch(cronologia, /tanqueCheio|tanque_cheio/);
  assert.match(cronologia, /anterior\?\.odometro/);
});

test("pagamentos múltiplos alterna entre formulário simples e cards", async () => {
  const pagamentos = await ler("shared/components/financeiro/PagamentosMultiplos.jsx");

  assert.match(pagamentos, /import ToggleSwitch/);
  assert.match(pagamentos, /Mais de uma forma de pagamento\?/);
  assert.match(pagamentos, /useState\(false\)/);
  assert.match(pagamentos, /className=\{modoMultiplo/);
  assert.match(pagamentos, /\{modoMultiplo && \(/);
  assert.match(pagamentos, /\{modoMultiplo && \(\s*<Campo\s*label="Valor pago"/);
  assert.match(pagamentos, /ultimoPagamento &&/);
  assert.match(pagamentos, /pagamentos\.length > 1 &&/);
  assert.match(pagamentos, /aria-label="Adicionar outra forma de pagamento"/);
  assert.match(pagamentos, /Remover pagamento/);
  assert.ok(
    pagamentos.lastIndexOf("Mais de uma forma de pagamento?")
      > pagamentos.indexOf("{erroTotal &&"),
    "o toggle deve ser o último controle do formulário"
  );
  assert.ok(
    pagamentos.indexOf("ultimoPagamento &&")
      < pagamentos.indexOf('<div className={`grid grid-cols-1'),
    "as ações devem ficar no cabeçalho do card"
  );
});

test("novo pagamento valida, rola e recebe foco na forma de pagamento", async () => {
  const pagamentos = await ler("shared/components/financeiro/PagamentosMultiplos.jsx");

  assert.match(pagamentos, /validarPagamentoParaAdicionar\(ultimoPagamento\)/);
  assert.match(pagamentos, /scrollIntoView\(\{ behavior: "smooth", block: "nearest" \}\)/);
  assert.match(pagamentos, /querySelector\("\[data-campo-forma-pagamento\] button"\)\?\.focus\(\)/);
  assert.match(pagamentos, /pagamentoNovoRef\.current = novo\.chave/);
});

test("desligar múltiplos pagamentos exige confirmação e preserva o primeiro", async () => {
  const pagamentos = await ler("shared/components/financeiro/PagamentosMultiplos.jsx");

  assert.match(pagamentos, /import ConfirmacaoModal/);
  assert.match(pagamentos, /pagamentos\.length > 1/);
  assert.match(pagamentos, /setConfirmarDesativacao\(true\)/);
  assert.match(pagamentos, /onChange\(\[sincronizarPrimeiroPagamentoComTotal\(\)\]\)/);
  assert.match(pagamentos, /Os pagamentos adicionais serão removidos/);
});

test("ajuste individual alimenta Contas a Pagar sem recalcular o contrato", async () => {
  const [servicoCompartilhado, servicoEmprestimos, contasPagar] = await Promise.all([
    ler("shared/services/parcelasContratosService.js"),
    ler("modules/contratos/services/contratosFinanceirosService.js"),
    ler("modules/contas/pages/ContasPagar.jsx"),
  ]);

  assert.match(servicoCompartilhado, /\.from\("saidas"\)/);
  assert.doesNotMatch(servicoCompartilhado, /\.from\("contratos_financeiros"\)/);
  assert.doesNotMatch(servicoCompartilhado, /\.from\("contratos_financeiros_parcelas"\)/);
  assert.doesNotMatch(servicoEmprestimos, /valor_contratado: Math\.round\(novoTotal/);
  assert.match(contasPagar, /Number\(conta\?\.valor_total \|\| 0\) - Number\(conta\?\.valor_pago \|\| 0\)/);
});

test("pagamento e Extrato preservam o valor efetivamente pago", async () => {
  const [pagamento, extrato] = await Promise.all([
    ler("modules/contas/components/RegistrarPagamentoModal.jsx"),
    ler("modules/extrato/pages/Extrato.jsx"),
  ]);

  assert.match(pagamento, /valor_total: valorArredondado/);
  assert.match(pagamento, /valor_pago: novoValorPago/);
  assert.match(pagamento, /conta_pagar_origem_id: contaPagar\.id/);
  assert.match(extrato, /valor: Number\(saida\.valor_total \|\| 0\)/);
});

test("migration corretiva preserva ajustes e elimina campos de motivo", async () => {
  const migration = await ler("../supabase/migrations/20260730160000_composicao_itens_parcelas.sql");
  assert.match(migration, /add column if not exists itens_parcela/);
  assert.match(migration, /jsonb_build_array/);
  assert.match(migration, /drop column if exists motivo_ajuste_parcela/);
  assert.match(migration, /drop column if exists descricao_ajuste_parcela/);
  assert.match(migration, /drop column if exists valor_previsto/);
  assert.doesNotMatch(migration, /\bdelete\b/i);
});
