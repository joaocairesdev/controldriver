import assert from "node:assert/strict";
import test from "node:test";
import { compararMovimentosFinanceiros } from "./extratoFinanceiro.js";

test("ordena extrato financeiro por data, horário e id", () => {
  const movimentos = [
    { idOrdenacao: 9, data: "2026-08-10", horario: "09:00:00" },
    { idOrdenacao: 2, data: "2026-08-11", horario: "08:00:00" },
    { idOrdenacao: 1, data: "2026-08-11", horario: "10:00:00" },
    { idOrdenacao: 3, data: "2026-08-11", horario: "10:00:00" },
  ].sort(compararMovimentosFinanceiros);

  assert.deepEqual(movimentos.map((item) => item.idOrdenacao), [3, 1, 2, 9]);
});

test("created_at não interfere na ordenação financeira", () => {
  const movimentos = [
    { idOrdenacao: 1, data: "2026-08-11", created_at: "2026-08-12T23:00:00Z" },
    { idOrdenacao: 2, data: "2026-08-11", created_at: "2026-08-10T01:00:00Z" },
  ].sort(compararMovimentosFinanceiros);

  assert.deepEqual(movimentos.map((item) => item.idOrdenacao), [2, 1]);
});
