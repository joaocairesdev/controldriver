import assert from "node:assert/strict";
import test from "node:test";
import {
  adicionarMesesSeguro,
  filtrarCobrancasFaltantes,
  gerarParcelasFinanciamento,
  gerarVencimentosAluguel,
} from "./veiculosFinanceiro.js";

test("mantém doze cobranças mensais no horizonte móvel", () => {
  const datas = gerarVencimentosAluguel({ proximoVencimento: "2026-07-31", frequencia: "mensal" });
  assert.equal(datas.length, 12);
  assert.equal(datas[0], "2026-07-31");
  assert.equal(datas.at(-1), "2027-06-30");
});

test("limita frequências curtas a doze meses e respeita data final", () => {
  const semanais = gerarVencimentosAluguel({ proximoVencimento: "2026-07-16", frequencia: "semanal" });
  assert.ok(semanais.length >= 52 && semanais.length <= 53);
  assert.ok(semanais.every((data) => data < "2027-07-16"));

  assert.deepEqual(
    gerarVencimentosAluguel({ proximoVencimento: "2026-07-16", frequencia: "diaria", dataFim: "2026-07-18" }),
    ["2026-07-16", "2026-07-17", "2026-07-18"]
  );
});

test("gera somente parcelas futuras não pagas de financiamento antigo", () => {
  assert.deepEqual(
    gerarParcelasFinanciamento({
      totalParcelas: 48,
      parcelasPagas: 20,
      numeroProximaParcela: 21,
      proximoVencimento: "2026-08-10",
    }).slice(0, 2),
    [
      { numero: 21, vencimento: "2026-08-10" },
      { numero: 22, vencimento: "2026-09-10" },
    ]
  );
});

test("preserva o último dia possível ao somar meses", () => {
  assert.equal(adicionarMesesSeguro("2026-01-31", 1), "2026-02-28");
});

test("completa somente cobranças faltantes sem recriar canceladas ou excluídas", () => {
  const esperadas = ["2026-08-10", "2026-09-10", "2026-10-10"];
  const registradas = ["2026-08-10", "2026-09-10"];
  assert.deepEqual(filtrarCobrancasFaltantes(esperadas, registradas, (item) => item), ["2026-10-10"]);
  assert.deepEqual(filtrarCobrancasFaltantes(esperadas, esperadas, (item) => item), []);
});
