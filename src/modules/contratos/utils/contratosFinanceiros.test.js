import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularTaxaJurosPercentual,
  calcularResumoContrato,
  contratoPossuiHistoricoProtegido,
  dividirValorEmParcelas,
  gerarParcelasContrato,
  planoConfereComValorContratado,
  rotuloEntradaAvulsa,
} from "./contratosFinanceiros.js";

test("gera parcelas diárias, semanais, quinzenais e mensais", () => {
  assert.deepEqual(
    gerarParcelasContrato({ quantidade: 3, valorParcela: 100, primeiroVencimento: "2026-01-31", periodicidade: "mensal" }),
    [
      { numero: 1, vencimento: "2026-01-31", valor: 100 },
      { numero: 2, vencimento: "2026-02-28", valor: 100 },
      { numero: 3, vencimento: "2026-03-31", valor: 100 },
    ]
  );
  assert.equal(gerarParcelasContrato({ quantidade: 2, valorParcela: 10, primeiroVencimento: "2026-01-01", periodicidade: "diaria" })[1].vencimento, "2026-01-02");
  assert.equal(gerarParcelasContrato({ quantidade: 2, valorParcela: 10, primeiroVencimento: "2026-01-01", periodicidade: "semanal" })[1].vencimento, "2026-01-08");
  assert.equal(gerarParcelasContrato({ quantidade: 2, valorParcela: 10, primeiroVencimento: "2026-01-01", periodicidade: "quinzenal" })[1].vencimento, "2026-01-16");
});

test("valida que o plano corresponde ao valor contratado", () => {
  assert.equal(planoConfereComValorContratado(1200, 12, 100), true);
  assert.equal(planoConfereComValorContratado(1200, 12, 99.99), false);
});

test("calcula saldo, pagamentos parciais e próximo vencimento", () => {
  const resumo = calcularResumoContrato({
    parcelas: [
      { valor: 100, data_vencimento: "2026-01-10", status: "paga", saida: { status: "pago", valor_pago: 100 } },
      { valor: 100, data_vencimento: "2026-02-10", status: "parcial", saida: { status: "parcial", valor_pago: 40 } },
      { valor: 100, data_vencimento: "2026-03-10", status: "aberta", saida: { status: "aberto", valor_pago: 0 } },
      { valor: 100, data_vencimento: "2026-04-10", status: "cancelada" },
    ],
  });

  assert.equal(resumo.totalPago, 140);
  assert.equal(resumo.saldoDevedor, 160);
  assert.equal(resumo.proximoVencimento, "2026-02-10");
  assert.equal(resumo.parcelasPagas, 1);
  assert.equal(resumo.parcelasAtivas, 3);
});

test("representa empréstimo à vista com uma única obrigação", () => {
  assert.deepEqual(
    gerarParcelasContrato({ quantidade: 1, valorParcela: 550, primeiroVencimento: "2026-08-01", periodicidade: "mensal" }),
    [{ numero: 1, vencimento: "2026-08-01", valor: 550 }]
  );
});

test("calcula taxa de juros a partir dos valores em centavos", () => {
  assert.equal(calcularTaxaJurosPercentual(1000, 1000), 0);
  assert.equal(calcularTaxaJurosPercentual(1000, 1200), 20);
});

test("divide o valor contratado e fecha diferenças na última parcela", () => {
  assert.deepEqual(dividirValorEmParcelas(1200, 3), [400, 400, 400]);
  assert.deepEqual(dividirValorEmParcelas(1000, 3), [333.33, 333.33, 333.34]);
  assert.equal(
    dividirValorEmParcelas(1000, 3).reduce((total, valor) => Math.round((total + valor) * 100) / 100, 0),
    1000,
  );
});

test("gera parcelas mensais pelo total contratado preservando o dia-base", () => {
  assert.deepEqual(
    gerarParcelasContrato({
      quantidade: 3,
      valorContratado: 1000,
      primeiroVencimento: "2026-01-31",
    }),
    [
      { numero: 1, vencimento: "2026-01-31", valor: 333.33 },
      { numero: 2, vencimento: "2026-02-28", valor: 333.33 },
      { numero: 3, vencimento: "2026-03-31", valor: 333.34 },
    ],
  );
});

test("identifica somente entradas vinculadas como empréstimo", () => {
  assert.equal(rotuloEntradaAvulsa({ contrato_financeiro_id: 7 }), "Empréstimo");
  assert.equal(rotuloEntradaAvulsa({ finalidade: "pessoal" }), "Entrada Avulsa Pessoal");
  assert.equal(rotuloEntradaAvulsa({}), "Entrada Avulsa");
});

test("bloqueia exclusão quando o contrato possui pagamento", () => {
  assert.equal(contratoPossuiHistoricoProtegido({ parcelas: [{ status: "aberta", valor_pago: 0 }] }), false);
  assert.equal(contratoPossuiHistoricoProtegido({ parcelas: [{ status: "parcial", valor_pago: 10 }] }), true);
  assert.equal(contratoPossuiHistoricoProtegido({ parcelas: [{ status: "aberta", saida: { status: "pago" } }] }), true);
  assert.equal(contratoPossuiHistoricoProtegido({ parcelas: [{ status: "cancelada" }] }), true);
});
