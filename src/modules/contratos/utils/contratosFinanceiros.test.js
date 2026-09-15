import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarValoresIndividuaisAgenda,
  calcularParcelamentoBidirecional,
  calcularTaxaJurosPercentual,
  calcularResumoContrato,
  contratoPossuiHistoricoProtegido,
  dividirValorEmParcelas,
  gerarAgendaMensalContrato,
  gerarParcelasContrato,
  planoConfereComValorContratado,
  rotuloEntradaAvulsa,
  somarValoresParcelas,
  validarAgendaMensalContrato,
} from "./contratosFinanceiros.js";

test("gera doze mensalidades e trata o fim da vigência como exclusivo", () => {
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: "2026-08-24",
    fimVigencia: "2027-08-24",
    primeiroVencimento: "2026-08-24",
    valorPadrao: 356.91,
  });

  assert.equal(agenda.length, 12);
  assert.equal(agenda[0].vencimento, "2026-08-24");
  assert.equal(agenda.at(-1).vencimento, "2027-07-24");
  assert.equal(agenda.some((item) => item.vencimento === "2027-08-24"), false);
});

test("gera a agenda quando o primeiro vencimento é posterior ao início", () => {
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2027-01-01",
    primeiroVencimento: "2026-02-15",
    valorPadrao: 100,
  });

  assert.equal(agenda.length, 11);
  assert.equal(agenda[0].vencimento, "2026-02-15");
  assert.equal(agenda.at(-1).vencimento, "2026-12-15");
});

test("rejeita primeiro vencimento anterior ao início da vigência", () => {
  assert.throws(() => gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2027-01-01",
    primeiroVencimento: "2025-12-31",
    valorPadrao: 100,
  }), /dentro da vigência/);
});

test("rejeita primeiro vencimento igual ao fim exclusivo da vigência", () => {
  assert.throws(() => gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2027-01-01",
    primeiroVencimento: "2027-01-01",
    valorPadrao: 100,
  }), /dentro da vigência/);
});

test("rejeita primeiro vencimento posterior ao fim da vigência", () => {
  assert.throws(() => gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2027-01-01",
    primeiroVencimento: "2027-02-01",
    valorPadrao: 100,
  }), /dentro da vigência/);
});

test("preserva o dia-base 31 ao atravessar fevereiro e meses de 30 dias", () => {
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-05-01",
    primeiroVencimento: "2026-01-31",
    valorPadrao: 100,
  });

  assert.deepEqual(agenda.map((item) => item.vencimento), [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
    "2026-04-30",
  ]);
});

test("preserva os dias-base 28 e 30 após fevereiro", () => {
  const gerarDatas = (primeiroVencimento) => gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-04-01",
    primeiroVencimento,
    valorPadrao: 100,
  }).map((item) => item.vencimento);

  assert.deepEqual(gerarDatas("2026-01-28"), [
    "2026-01-28",
    "2026-02-28",
    "2026-03-28",
  ]);
  assert.deepEqual(gerarDatas("2026-01-30"), [
    "2026-01-30",
    "2026-02-28",
    "2026-03-30",
  ]);
});

test("ajusta fevereiro em ano não bissexto sem perder o dia-base", () => {
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-04-01",
    primeiroVencimento: "2026-01-29",
    valorPadrao: 100,
  });

  assert.deepEqual(agenda.map((item) => item.vencimento), [
    "2026-01-29",
    "2026-02-28",
    "2026-03-29",
  ]);
});

test("usa 29 de fevereiro em ano bissexto", () => {
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: "2028-01-01",
    fimVigencia: "2028-04-01",
    primeiroVencimento: "2028-01-29",
    valorPadrao: 100,
  });

  assert.deepEqual(agenda.map((item) => item.vencimento), [
    "2028-01-29",
    "2028-02-29",
    "2028-03-29",
  ]);
});

test("gera somente uma mensalidade em vigência curta", () => {
  assert.deepEqual(gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-10",
    fimVigencia: "2026-02-01",
    primeiroVencimento: "2026-01-31",
    valorPadrao: 75.5,
  }), [{ numero: 1, vencimento: "2026-01-31", valor: 75.5 }]);
});

test("rejeita vigência sem intervalo para vencimentos", () => {
  assert.throws(() => gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-01-01",
    primeiroVencimento: "2026-01-01",
    valorPadrao: 100,
  }), /posterior ao início/);
});

test("preserva o valor padrão em cada item da agenda", () => {
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-04-01",
    primeiroVencimento: "2026-01-28",
    valorPadrao: 356.91,
  });

  assert.deepEqual(agenda.map((item) => item.valor), [356.91, 356.91, 356.91]);
});

test("aplica uma exceção individual sem alterar as demais mensalidades", () => {
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: "2026-08-24",
    fimVigencia: "2027-08-24",
    primeiroVencimento: "2026-08-24",
    valorPadrao: 356.91,
  });
  const ajustada = aplicarValoresIndividuaisAgenda(agenda, {
    "2026-08-24": 178.46,
  });

  assert.equal(ajustada[0].valor, 178.46);
  assert.deepEqual(ajustada.slice(1).map((item) => item.valor), Array(11).fill(356.91));
});

test("aplica exceções nas três primeiras mensalidades e recalcula o custo", () => {
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: "2026-08-24",
    fimVigencia: "2027-08-24",
    primeiroVencimento: "2026-08-24",
    valorPadrao: 356.91,
  });
  const ajustada = aplicarValoresIndividuaisAgenda(agenda, {
    "2026-08-24": 178.46,
    "2026-09-24": 200,
    "2026-10-24": 250,
  });

  assert.deepEqual(ajustada.slice(0, 3).map((item) => item.valor), [178.46, 200, 250]);
  assert.equal(somarValoresParcelas(ajustada), 3840.65);
});

test("mudança do valor padrão preserva somente as exceções explícitas", () => {
  const dados = {
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-04-01",
    primeiroVencimento: "2026-01-10",
  };
  const novaAgenda = gerarAgendaMensalContrato({ ...dados, valorPadrao: 120 });
  const ajustada = aplicarValoresIndividuaisAgenda(novaAgenda, {
    "2026-01-10": 80,
  });

  assert.deepEqual(ajustada.map((item) => item.valor), [80, 120, 120]);
});

test("valida e normaliza cada valor recebido na agenda mensal", () => {
  const agenda = validarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-04-01",
    primeiroVencimento: "2026-01-10",
    valorPadrao: 100,
    agenda: [
      { numero: 1, vencimento: "2026-01-10", valor: 50.125 },
      { numero: 2, vencimento: "2026-02-10", valor: 100 },
      { numero: 3, vencimento: "2026-03-10", valor: 100 },
    ],
  });

  assert.deepEqual(agenda.map((item) => item.valor), [50.13, 100, 100]);
});

test("rejeita agenda mensal adulterada", () => {
  assert.throws(() => validarAgendaMensalContrato({
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-04-01",
    primeiroVencimento: "2026-01-10",
    valorPadrao: 100,
    agenda: [
      { numero: 1, vencimento: "2026-01-10", valor: 100 },
      { numero: 2, vencimento: "2026-02-11", valor: 100 },
      { numero: 3, vencimento: "2026-03-10", valor: 100 },
    ],
  }), /parcela inválida/);
});

test("total e quantidade distribuem os centavos entre as parcelas", () => {
  const calculo = calcularParcelamentoBidirecional({
    quantidade: 3,
    valorTotal: 100,
    valorParcela: 0,
    origem: "total",
  });

  assert.equal(calculo.valorParcela, 33.33);
  assert.deepEqual(calculo.valoresParcelas, [33.33, 33.33, 33.34]);
  assert.equal(calculo.valorTotal, 100);
});

test("valor da parcela e quantidade calculam o total", () => {
  const calculo = calcularParcelamentoBidirecional({
    quantidade: 3,
    valorTotal: 0,
    valorParcela: 33.33,
    origem: "parcela",
  });

  assert.equal(calculo.valorTotal, 99.99);
  assert.deepEqual(calculo.valoresParcelas, [33.33, 33.33, 33.33]);
});

test("mudança de quantidade respeita a última origem do parcelamento", () => {
  const peloTotal = calcularParcelamentoBidirecional({
    quantidade: 4,
    valorTotal: 100,
    valorParcela: 33.33,
    origem: "total",
  });
  const pelaParcela = calcularParcelamentoBidirecional({
    quantidade: 4,
    valorTotal: 100,
    valorParcela: 33.33,
    origem: "parcela",
  });

  assert.deepEqual(peloTotal.valoresParcelas, [25, 25, 25, 25]);
  assert.equal(pelaParcela.valorTotal, 133.32);
});

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
