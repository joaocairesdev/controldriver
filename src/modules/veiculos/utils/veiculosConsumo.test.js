import assert from "node:assert/strict";
import test from "node:test";
import { calcularConsumosPorFonte } from "./veiculosConsumo.js";

function abastecimento(id, data, tipo, odometro, litros, valorLitro, status = "pago") {
  return {
    id,
    tipo_combustivel: tipo,
    odometro,
    litros,
    valor_litro: valorLitro,
    saidas: { data_compra: data, status },
  };
}

test("calcula ciclos independentes quando etanol e gasolina se alternam", () => {
  const consumos = calcularConsumosPorFonte([
    abastecimento(1, "2026-01-01", "etanol", 1000, 10, 4),
    abastecimento(2, "2026-01-05", "gasolina_comum", 1100, 10, 6),
    abastecimento(3, "2026-01-10", "etanol_aditivado", 1200, 20, 5),
    abastecimento(4, "2026-01-15", "gasolina_aditivada", 1400, 20, 7),
  ]);

  const etanol = consumos.find((item) => item.chave === "etanol");
  const gasolina = consumos.find((item) => item.chave === "gasolina");

  assert.equal(etanol.media, 10);
  assert.equal(gasolina.media, 15);
  assert.equal(etanol.precoMedio, 14 / 3);
  assert.equal(gasolina.precoMedio, 20 / 3);
});

test("ignora registros cancelados na cronologia de cada combustível", () => {
  const [etanol] = calcularConsumosPorFonte([
    abastecimento(1, "2026-01-01", "etanol", 1000, 10, 4),
    abastecimento(2, "2026-01-05", "etanol", 1100, 10, 4, "cancelado"),
    abastecimento(3, "2026-01-10", "etanol", 1200, 20, 5),
  ]);

  assert.equal(etanol.ciclos, 1);
  assert.equal(etanol.media, 10);
});

test("calcula eletricidade com a mesma leitura por ciclos", () => {
  const consumos = calcularConsumosPorFonte([], [
    { id: 1, odometro: 2000, kwh: 20, valor_kwh: 1, saidas: { data_compra: "2026-02-01", status: "pago" } },
    { id: 2, odometro: 2100, kwh: 25, valor_kwh: 2, saidas: { data_compra: "2026-02-05", status: "pago" } },
  ]);

  assert.equal(consumos[0].chave, "eletricidade");
  assert.equal(consumos[0].media, 4);
  assert.equal(consumos[0].custoPorKm, 0.5);
});
