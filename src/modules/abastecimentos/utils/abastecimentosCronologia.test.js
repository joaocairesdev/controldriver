import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularMetricasConsumo,
  localizarAbastecimentosVizinhos,
  validarCrescimentoOdometro,
} from "./abastecimentosCronologia.js";

function abastecimento(id, dataCompra, odometro, createdAt = null) {
  return { id, created_at: createdAt, odometro, saidas: { data_compra: dataCompra } };
}

test("localiza os abastecimentos anterior e posterior pela data da compra", () => {
  const lista = [
    abastecimento(1, "2026-01-01", 200),
    abastecimento(2, "2026-01-03", 600),
  ];
  const vizinhos = localizarAbastecimentosVizinhos(lista, {
    id: 3,
    data_compra: "2026-01-02",
    odometro: 400,
  });

  assert.equal(vizinhos.anterior.id, 1);
  assert.equal(vizinhos.posterior.id, 2);
});

test("encaixa retroativamente pelo odômetro quando a data é igual", () => {
  const lista = [
    abastecimento(1, "2026-01-01", 200, "2026-01-01T08:00:00Z"),
    abastecimento(2, "2026-01-02", 600, "2026-01-02T08:00:00Z"),
  ];
  const vizinhos = localizarAbastecimentosVizinhos(lista, {
    id: 3,
    data_compra: "2026-01-02",
    odometro: 400,
    created_at: "2026-01-03T18:00:00Z",
  });

  assert.equal(vizinhos.anterior.id, 1);
  assert.equal(vizinhos.posterior.id, 2);
  assert.equal(validarCrescimentoOdometro(400, vizinhos.anterior, vizinhos.posterior).valido, true);
});

test("created_at não altera a posição definida pelo odômetro na mesma data", () => {
  const lista = [
    abastecimento(1, "2026-01-02", 400, "2026-01-03T20:00:00Z"),
    abastecimento(2, "2026-01-02", 600, "2026-01-02T08:00:00Z"),
  ];
  const vizinhos = localizarAbastecimentosVizinhos(lista, {
    id: 3,
    data_compra: "2026-01-02",
    odometro: 500,
    created_at: "2026-01-01T01:00:00Z",
  });

  assert.equal(vizinhos.anterior.id, 1);
  assert.equal(vizinhos.posterior.id, 2);
});

test("ignora o próprio abastecimento ao validar uma edição", () => {
  const lista = [
    abastecimento(1, "2026-01-01", 200),
    abastecimento(2, "2026-01-02", 400),
    abastecimento(3, "2026-01-03", 600),
  ];
  const vizinhos = localizarAbastecimentosVizinhos(lista, lista[1], lista[1].id);

  assert.equal(vizinhos.anterior.id, 1);
  assert.equal(vizinhos.posterior.id, 3);
});

test("rejeita edição que quebraria a sequência completa", () => {
  const lista = [
    abastecimento(1, "2026-01-01", 200),
    abastecimento(2, "2026-01-02", 400),
    abastecimento(3, "2026-01-03", 600),
  ];
  const edicao = { id: 2, data_compra: "2026-01-04", odometro: 400 };
  const vizinhos = localizarAbastecimentosVizinhos(lista, edicao, edicao.id);

  assert.equal(vizinhos.anterior.id, 3);
  assert.equal(vizinhos.posterior, null);
  assert.equal(validarCrescimentoOdometro(edicao.odometro, vizinhos.anterior, null).valido, false);
});

test("rejeita odômetro duplicado na mesma data independentemente do id", () => {
  const lista = [abastecimento(1, "2026-01-02", 400)];
  const lancamento = { id: 2, data_compra: "2026-01-02", odometro: 400 };
  const vizinhos = localizarAbastecimentosVizinhos(lista, lancamento);

  assert.equal(vizinhos.anterior.id, 1);
  assert.equal(validarCrescimentoOdometro(400, vizinhos.anterior, null).valido, false);
});

test("exige odômetro estritamente crescente entre os vizinhos", () => {
  const anterior = { odometro: 400 };
  const posterior = { odometro: 600 };

  assert.equal(validarCrescimentoOdometro(500, anterior, posterior).valido, true);
  assert.equal(validarCrescimentoOdometro(400, anterior, posterior).valido, false);
  assert.equal(validarCrescimentoOdometro(600, anterior, posterior).valido, false);
});

test("valida somente o lado existente nos extremos da sequência", () => {
  assert.equal(validarCrescimentoOdometro(300, { odometro: 200 }, null).valido, true);
  assert.equal(validarCrescimentoOdometro(200, { odometro: 200 }, null).valido, false);
  assert.equal(validarCrescimentoOdometro(300, null, { odometro: 400 }).valido, true);
  assert.equal(validarCrescimentoOdometro(400, null, { odometro: 400 }).valido, false);
});

test("calcula consumo automaticamente pela cronologia dos abastecimentos", () => {
  assert.deepEqual(
    calcularMetricasConsumo({
      odometro: 550,
      litros: 30,
      anterior: { odometro: 250 },
    }),
    { kmPeriodo: 300, consumoKmLitro: 10 }
  );
});

test("não calcula consumo sem distância ou litros válidos", () => {
  assert.equal(
    calcularMetricasConsumo({
      odometro: 250,
      litros: 30,
      anterior: { odometro: 250 },
    }).consumoKmLitro,
    0
  );
  assert.equal(
    calcularMetricasConsumo({
      odometro: 550,
      litros: 0,
      anterior: { odometro: 250 },
    }).consumoKmLitro,
    0
  );
});
