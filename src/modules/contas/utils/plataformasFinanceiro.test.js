import test from "node:test";
import assert from "node:assert/strict";

import {
  calcularSaldosPlataformas,
  calcularValorLiquidoSaque,
  obterCicloOperacional,
  obterTaxaPadraoSaque,
  obterTipoSaquePadrao,
  obterTiposSaqueDisponiveis,
  obterUltimoCicloDevido,
  obterProximoRecebimentoAutomatico,
  montarMovimentacoesPlataforma,
  calcularSaldoExtratoPlataforma,
  filtrarMovimentacoesPlataforma,
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
  assert.equal(obterTaxaPadraoSaque(plataformas[0], "outro"), 0);
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

test("ciclo operacional é sempre de segunda a domingo", () => {
  assert.deepEqual(obterCicloOperacional("2026-08-05"), {
    inicio: "2026-08-03",
    fim: "2026-08-09",
  });
  assert.deepEqual(obterCicloOperacional("2026-08-09"), {
    inicio: "2026-08-03",
    fim: "2026-08-09",
  });
});

test("dia de pagamento não cria período móvel", () => {
  assert.deepEqual(obterUltimoCicloDevido("2026-08-10", 1), {
    inicio: "2026-08-03",
    fim: "2026-08-09",
    dataPagamento: "2026-08-10",
  });
  assert.deepEqual(obterUltimoCicloDevido("2026-08-12", 3), {
    inicio: "2026-08-03",
    fim: "2026-08-09",
    dataPagamento: "2026-08-12",
  });
});

test("respeita tipos disponíveis e corrige padrão incompatível", () => {
  assert.deepEqual(obterTiposSaqueDisponiveis(plataformas[0]), [
    "instantaneo",
    "agendado",
  ]);
  assert.equal(obterTipoSaquePadrao(plataformas[0]), "agendado");
  assert.equal(
    obterTipoSaquePadrao({
      tipos_saque_disponiveis: ["outro"],
      tipo_saque_padrao: "instantaneo",
    }),
    "outro",
  );
});

test("calcula o próximo recebimento pelo ciclo liquidado sem mover a semana", () => {
  assert.equal(
    obterProximoRecebimentoAutomatico({
      modo_recebimento: "retido",
      dia_recebimento_automatico: 3,
      ultimo_ciclo_liquidado_fim: "2026-08-02",
    }, "2026-08-05"),
    "2026-08-12",
  );
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
    ["saque", "taxa", "ganho", "ganho", "conciliacao"],
  );
  assert.equal(
    calcularSaldoExtratoPlataforma(movimentos),
    70,
  );
  assert.equal(movimentos.find((item) => item.tipo === "taxa").saqueId, 30);
  assert.equal(movimentos.find((item) => item.tipo === "conciliacao").entradaId, 21);
  assert.equal(movimentos.find((item) => item.tipo === "saque").statusTaxa, "lancada");
  assert.equal(filtrarMovimentacoesPlataforma(movimentos, "saque").length, 1);
  assert.equal(filtrarMovimentacoesPlataforma(movimentos, "taxa").length, 1);
  assert.equal(filtrarMovimentacoesPlataforma(movimentos, "todos").length, 5);
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
