import test from "node:test";
import assert from "node:assert/strict";

import {
  atualizarFormaContratacaoProtecao,
  resolverInicioControleFinanceiroMensal,
} from "./protecaoFormulario.js";

const agenda = [
  { numero: 1, vencimento: "2026-08-24", valor: 178.46 },
  { numero: 2, vencimento: "2026-09-24", valor: 356.91 },
  { numero: 3, vencimento: "2026-10-24", valor: 356.91 },
];

test("proteção nova deriva início de controle da primeira mensalidade", () => {
  assert.equal(resolverInicioControleFinanceiroMensal({
    protecaoEmAndamento: "nao",
    agenda,
    dataInicioControleFinanceiro: "",
  }), "2026-08-24");
});

test("proteção em andamento aceita somente mensalidade existente na agenda", () => {
  assert.equal(resolverInicioControleFinanceiroMensal({
    protecaoEmAndamento: "sim",
    agenda,
    dataInicioControleFinanceiro: "2026-10-24",
  }), "2026-10-24");
  assert.equal(resolverInicioControleFinanceiroMensal({
    protecaoEmAndamento: "sim",
    agenda,
    dataInicioControleFinanceiro: "2026-10-25",
  }), "");
});

test("alterar modalidade limpa somente o controle específico do mensal", () => {
  const formulario = {
    formaContratacao: "mensal",
    mensal: {
      valorMensal: "356,91",
      primeiroVencimento: "2026-08-24",
      protecaoEmAndamento: "sim",
      dataInicioControleFinanceiro: "2026-10-24",
      valoresIndividuais: { "2026-08-24": 178.46 },
    },
    parcelado: { valorTotal: "4.200,00" },
  };

  const atualizado = atualizarFormaContratacaoProtecao(formulario, "parcelado");
  assert.equal(atualizado.formaContratacao, "parcelado");
  assert.equal(atualizado.mensal.protecaoEmAndamento, "");
  assert.equal(atualizado.mensal.dataInicioControleFinanceiro, "");
  assert.equal(atualizado.mensal.valorMensal, "356,91");
  assert.deepEqual(atualizado.mensal.valoresIndividuais, { "2026-08-24": 178.46 });
  assert.deepEqual(atualizado.parcelado, formulario.parcelado);
});
