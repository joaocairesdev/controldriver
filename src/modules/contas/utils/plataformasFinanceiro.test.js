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
