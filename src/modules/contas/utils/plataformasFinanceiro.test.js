import test from "node:test";
import assert from "node:assert/strict";

import {
  calcularSaldosPlataformas,
  calcularValorLiquidoSaque,
  obterTaxaPadraoSaque,
  montarMovimentacoesPlataforma,
  calcularSaldoExtratoPlataforma,
  filtrarMovimentacoesPlataforma,
  pesquisarMovimentacoesPlataforma,
  normalizarDescricaoRecebimentoSemanal,
  obterValorBrutoTransferencia,
} from "./plataformasFinanceiro.js";

const plataformas = [
  {
    id: 1,
    nome: "Uber",
    carteira_ativa_desde: "2026-08-04T12:00:00Z",
    taxa_saque_instantaneo: 4.5,
    taxa_saque_agendado: 1,
    tipos_saque_disponiveis: ["instantaneo", "agendado"],
    tipo_saque_padrao: "agendado",
  },
];

test("modo retido alimenta a carteira e modo instantâneo credita somente a conta", () => {
  const resultado = calcularSaldosPlataformas(
    plataformas,
    [
      {
        plataforma_id: 1,
        faturamento: 100,
        valor_reembolso: 10,
        destino_financeiro: "plataforma",
      },
      {
        plataforma_id: 1,
        faturamento: 500,
        destino_financeiro: "conta",
      },
      {
        plataforma_id: 1,
        faturamento: 300,
        destino_financeiro: "conta",
      },
    ],
  );

  assert.equal(resultado[0].saldo, 110);
});

test("ganho anterior ao pagamento fica retido e ganho tardio de ciclo liquidado vai para a conta", () => {
  const resultado = calcularSaldosPlataformas(
    plataformas,
    [
      {
        plataforma_id: 1,
        faturamento: 140,
        destino_financeiro: "plataforma",
        ciclo_operacional_fim: "2026-08-09",
      },
      {
        plataforma_id: 1,
        faturamento: 60,
        destino_financeiro: "conta",
        ciclo_operacional_fim: "2026-08-02",
      },
    ],
  );

  assert.equal(resultado[0].saldo, 140);
});

test("saque bruto maior que o saldo gera pendência conciliada por novos ganhos", () => {
  const aposSaque = calcularSaldosPlataformas(
    plataformas,
    [
      {
        plataforma_id: 1,
        faturamento: 500,
        destino_financeiro: "plataforma",
      },
    ],
    [
      {
        plataforma_id: 1,
        tipo: "saque_plataforma",
        valor_bruto: 650,
      },
    ],
  );

  assert.equal(aposSaque[0].saldo, -150);

  const conciliado = calcularSaldosPlataformas(
    plataformas,
    [
      {
        plataforma_id: 1,
        faturamento: 500,
        destino_financeiro: "plataforma",
      },
      {
        plataforma_id: 1,
        faturamento: 150,
        destino_financeiro: "plataforma",
      },
    ],
    [
      {
        plataforma_id: 1,
        tipo: "saque_plataforma",
        valor_bruto: 650,
      },
    ],
  );

  assert.equal(conciliado[0].saldo, 0);
});

test("taxa reduz o valor recebido, mas não altera o valor bruto do saque", () => {
  assert.equal(calcularValorLiquidoSaque(100, 4.5), 95.5);
  assert.equal(obterTaxaPadraoSaque(plataformas[0], "instantaneo"), 4.5);
  assert.equal(obterTaxaPadraoSaque(plataformas[0], "agendado"), 1);
  assert.equal(obterTaxaPadraoSaque(plataformas[0], "semanal"), 0);
  assert.equal(
    obterValorBrutoTransferencia({
      tipo: "saque_plataforma",
      valor: 95.5,
      valor_bruto: null,
      taxa: 4.5,
    }),
    100,
  );
});

test("saque histórico sem bruto mantém taxa, extrato e saldo sincronizados", () => {
  const transferencias = [{
    id: 40,
    plataforma_id: 1,
    tipo: "saque_plataforma",
    valor: 95.5,
    valor_bruto: null,
    taxa: 4.5,
  }];
  const saldo = calcularSaldosPlataformas(
    plataformas,
    [{ plataforma_id: 1, faturamento: 150, destino_financeiro: "plataforma" }],
    transferencias,
  );
  const movimentacoes = montarMovimentacoesPlataforma({
    plataforma: plataformas[0],
    transferencias,
    taxas: [{ saque_transferencia_id: 40, valor_total: 4.5 }],
  });

  assert.equal(saldo[0].saldo, 50);
  assert.equal(movimentacoes[0].valor, 100);
  assert.equal(movimentacoes[0].valorLiquido, 95.5);
});

test("recebimento automático liquida o saldo sem taxa", () => {
  const resultado = calcularSaldosPlataformas(
    plataformas,
    [{ plataforma_id: 1, faturamento: 320, destino_financeiro: "plataforma" }],
    [{
      plataforma_id: 1,
      tipo: "recebimento_automatico_plataforma",
      valor_bruto: 320,
    }],
  );

  assert.equal(resultado[0].saldo, 0);

  const reconstruido = calcularSaldosPlataformas(
    plataformas,
    [{ plataforma_id: 1, faturamento: 320, destino_financeiro: "plataforma" }],
    [],
  );
  assert.equal(reconstruido[0].saldo, 320);
});

test("padroniza a nomenclatura dos recebimentos semanais", () => {
  assert.equal(
    normalizarDescricaoRecebimentoSemanal(
      "Recebimento automático da plataforma Uber",
      "Uber",
    ),
    "Recebimento semanal automático da plataforma Uber",
  );
  assert.equal(
    normalizarDescricaoRecebimentoSemanal("", "99"),
    "Recebimento semanal automático da plataforma 99",
  );
});

test("saque parcial preserva o saldo restante", () => {
  const resultado = calcularSaldosPlataformas(
    plataformas,
    [{ plataforma_id: 1, faturamento: 100, destino_financeiro: "plataforma" }],
    [{ plataforma_id: 1, tipo: "saque_plataforma", valor_bruto: 35 }],
  );

  assert.equal(resultado[0].saldo, 65);
});

test("saque integral zera a carteira pelo valor bruto", () => {
  const resultado = calcularSaldosPlataformas(
    plataformas,
    [{ plataforma_id: 1, faturamento: 100, destino_financeiro: "plataforma" }],
    [{ plataforma_id: 1, tipo: "saque_plataforma", valor_bruto: 100 }],
  );

  assert.equal(resultado[0].saldo, 0);
});

test("excluir saque restitui exatamente o valor bruto à carteira", () => {
  const ganhos = [{
    plataforma_id: 1,
    faturamento: 200,
    destino_financeiro: "plataforma",
  }];
  const comSaque = calcularSaldosPlataformas(
    plataformas,
    ganhos,
    [{ plataforma_id: 1, tipo: "saque_plataforma", valor_bruto: 80 }],
  );
  const semSaque = calcularSaldosPlataformas(plataformas, ganhos, []);

  assert.equal(comSaque[0].saldo, 120);
  assert.equal(semSaque[0].saldo, 200);
});

test("valida a matemática do histórico informado da Uber sem mascarar taxas", () => {
  const saques = [
    { data: "2026-07-29", liquido: 108, taxa: 4.5, bruto: 112.5 },
    { data: "2026-07-29", liquido: 47.98, taxa: 4.5, bruto: 52.48 },
    { data: "2026-07-31", liquido: 53.03, taxa: 4.5, bruto: 57.53 },
    { data: "2026-08-01", liquido: 65.25, taxa: 4.5, bruto: 69.75 },
    { data: "2026-08-04", liquido: 91.96, taxa: 4.5, bruto: 96.46 },
    { data: "2026-08-05", liquido: 99.34, taxa: 4.5, bruto: 103.84 },
    { data: "2026-08-06", liquido: 237.57, taxa: 4.5, bruto: 242.07 },
  ];

  saques.forEach((saque) => {
    assert.equal(calcularValorLiquidoSaque(saque.bruto, saque.taxa), saque.liquido);
  });

  const totalLiquido = Number(saques.reduce((total, saque) => total + saque.liquido, 0).toFixed(2));
  const totalTaxas = Number(saques.reduce((total, saque) => total + saque.taxa, 0).toFixed(2));
  const totalBruto = Number(saques.reduce((total, saque) => total + saque.bruto, 0).toFixed(2));
  const totalCarteira = Number((32.4 + totalBruto).toFixed(2));
  const saldo = calcularSaldosPlataformas(
    plataformas,
    [{ plataforma_id: 1, faturamento: totalCarteira, destino_financeiro: "plataforma" }],
    [
      {
        plataforma_id: 1,
        tipo: "recebimento_automatico_plataforma",
        valor_bruto: 32.4,
      },
      ...saques.map((saque) => ({
        plataforma_id: 1,
        tipo: "saque_plataforma",
        valor: saque.liquido,
        valor_bruto: saque.bruto,
        taxa: saque.taxa,
      })),
    ],
  );

  assert.equal(totalLiquido, 703.13);
  assert.equal(totalTaxas, 31.5);
  assert.equal(totalBruto, 734.63);
  assert.equal(totalCarteira, 767.03);
  assert.equal(saldo[0].saldo, 0);
});

test("evidencia o ajuste Uber de 13,71 ainda não lançado nos ganhos", () => {
  const recebimentoSemanal = 32.4;
  const ganhosUberEncontrados = 753.32;
  const totalSaquesBrutos = 734.63;
  const totalSaidasEsperadas = Number((recebimentoSemanal + totalSaquesBrutos).toFixed(2));
  const saldoFinal = Number((ganhosUberEncontrados - totalSaidasEsperadas).toFixed(2));
  const saldoApos31Julho = Number((113.57 - 57.53).toFixed(2));
  const divergenciaEm1Agosto = Number((saldoApos31Julho - 69.75).toFixed(2));

  assert.equal(totalSaidasEsperadas, 767.03);
  assert.equal(saldoFinal, -13.71);
  assert.equal(saldoApos31Julho, 56.04);
  assert.equal(divergenciaEm1Agosto, -13.71);
  assert.equal(Number((442.37 - 96.46 - 103.84 - 242.07).toFixed(2)), 0);
});

test("mantém saldos independentes para múltiplas plataformas", () => {
  const resultado = calcularSaldosPlataformas(
    [...plataformas, { id: 2, nome: "99" }],
    [
      { plataforma_id: 1, faturamento: 80, destino_financeiro: "plataforma" },
      { plataforma_id: 2, faturamento: 45, destino_financeiro: "plataforma" },
    ],
  );

  assert.deepEqual(resultado.map((item) => item.saldo), [80, 45]);
});

test("extrato mantém saldo da carteira e relaciona taxas e conciliações ao saque e ganho", () => {
  const movimentos = montarMovimentacoesPlataforma({
    plataforma: {
      modo_recebimento: "retido",
      dia_recebimento_automatico: 1,
      ultimo_ciclo_liquidado_fim: "2026-08-02",
    },
    ganhos: [
      {
        id: 10,
        entrada_id: 20,
        faturamento: 100,
        numero_corridas: 4,
        destino_financeiro: "plataforma",
        ciclo_operacional_fim: "2026-08-09",
        entradas: { data: "2026-08-04" },
      },
      {
        id: 11,
        entrada_id: 21,
        faturamento: 40,
        destino_financeiro: "conta",
        ciclo_operacional_fim: "2026-08-02",
        created_at: "2026-08-03T22:00:00Z",
        entradas: { data: "2026-08-03" },
      },
    ],
    transferencias: [
      {
        id: 30,
        tipo: "saque_plataforma",
        data: "2026-08-05",
        valor: 26,
        valor_bruto: 30,
        tipo_saque: "instantaneo",
        conta_destino_id: 1,
      },
      {
        id: 31,
        tipo: "recebimento_direto_plataforma",
        data: "2026-08-03",
        valor: 40,
        valor_bruto: 40,
        entrada_plataforma_id: 11,
      },
    ],
    taxas: [{
      id: 40,
      saque_transferencia_id: 30,
      data_compra: "2026-08-05",
      valor_total: 4,
    }],
    contasPorId: { 1: "Inter PJ" },
  });

  assert.deepEqual(
    movimentos.map((item) => item.tipo),
    ["saque", "ganho", "ganho", "recebimento"],
  );
  assert.equal(
    calcularSaldoExtratoPlataforma(movimentos),
    70,
  );
  assert.equal(movimentos.find((item) => item.tipo === "recebimento").entradaId, 21);
  assert.equal(
    movimentos.find((item) => item.tipo === "recebimento").titulo,
    "Recebimento semanal automático",
  );
  assert.equal(movimentos.find((item) => item.tipo === "recebimento").impactoSaldo, 0);
  assert.equal(
    movimentos.find((item) => item.tipo === "recebimento").dadosOriginais.tipo,
    "recebimento_direto_plataforma",
  );
  assert.equal(movimentos.find((item) => item.tipo === "saque").titulo, "Saque Instantâneo");
  assert.equal(movimentos.find((item) => item.tipo === "saque").taxa, 4);
  assert.equal(movimentos.find((item) => item.tipo === "saque").valorLiquido, 26);
  assert.equal(movimentos.find((item) => item.tipo === "saque").statusTaxa, "lancada");
  assert.equal(filtrarMovimentacoesPlataforma(movimentos, "saque").length, 1);
  assert.equal(filtrarMovimentacoesPlataforma(movimentos, "taxa").length, 0);
  assert.equal(filtrarMovimentacoesPlataforma(movimentos, "todos").length, 4);
  assert.equal(pesquisarMovimentacoesPlataforma(movimentos, "inter pj").length, 1);
  assert.equal(pesquisarMovimentacoesPlataforma(movimentos, "05/08/2026").length, 1);
  assert.equal(pesquisarMovimentacoesPlataforma(movimentos, "30,00").length, 1);
});

test("identifica recebimento semanal e saques no extrato", () => {
  const movimentos = montarMovimentacoesPlataforma({
    transferencias: [
      { id: 1, tipo: "saque_plataforma", tipo_saque: "instantaneo", valor_bruto: 10, data: "2026-08-01" },
      { id: 2, tipo: "saque_plataforma", tipo_saque: "agendado", valor_bruto: 20, data: "2026-08-02" },
      { id: 3, tipo: "saque_plataforma", tipo_saque: "semanal", valor_bruto: 30, data: "2026-08-03" },
    ],
  });

  assert.deepEqual(
    movimentos.map((item) => item.titulo),
    ["Recebimento semanal", "Saque Agendado", "Saque Instantâneo"],
  );
  assert.equal(movimentos[0].taxa, 0);
  assert.equal(movimentos[0].valorLiquido, 30);
  assert.equal(movimentos[0].statusTaxa, null);
});

test("saque histórico sem despesa vinculada é identificado como sem taxa", () => {
  const movimentos = montarMovimentacoesPlataforma({
    plataforma: { modo_recebimento: "retido" },
    transferencias: [{
      id: 50,
      tipo: "saque_plataforma",
      data: "2026-07-20",
      valor: 100,
      valor_bruto: 100,
    }],
  });

  assert.equal(movimentos[0].statusTaxa, "sem_taxa");
  assert.equal(movimentos[0].statusTaxaTexto, "Sem taxa");
  assert.equal(movimentos[0].impactoSaldo, -100);
});
