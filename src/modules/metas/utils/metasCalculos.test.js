import assert from "node:assert/strict";
import test from "node:test";
import { distribuirSaldoMensalRestante } from "./metasCalculos.js";

test("distribui o saldo anual sem acumular projeções anteriores", () => {
  const distribuicao = distribuirSaldoMensalRestante(57698.21, 12);
  assert.equal(distribuicao.length, 12);
  assert.equal(Math.round(distribuicao.reduce((soma, valor) => soma + valor, 0) * 100), 5769821);
  assert.ok(distribuicao.every((valor) => valor < 5000));
});

test("a última parcela absorve somente a diferença de arredondamento", () => {
  assert.deepEqual(distribuirSaldoMensalRestante(100, 3), [33.33, 33.33, 33.34]);
});

test("recalcula do zero e trata saldo encerrado", () => {
  assert.deepEqual(distribuirSaldoMensalRestante(0, 4), [0, 0, 0, 0]);
  assert.deepEqual(distribuirSaldoMensalRestante(60, 2), [30, 30]);
});
