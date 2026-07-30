import assert from "node:assert/strict";
import test from "node:test";
import { normalizarProdutosRenegociados } from "./renegociacoesUtils.js";

test("identifica o tipo e o nome dos produtos renegociados", () => {
  const produtos = normalizarProdutosRenegociados([
    {
      id: 1,
      tipo_origem: "conta_negativa",
      origem_id: 10,
      titulo: "Itaú PF",
      valor_renegociado: 100,
    },
    {
      id: 2,
      tipo_origem: "fatura",
      origem_id: 20,
      titulo: "Itaú Múltiplo PF",
      valor_renegociado: 200,
      payload: { cartoes: { nome: "Itaú Múltiplo PF" } },
    },
  ]);

  assert.deepEqual(
    produtos.map((produto) => produto.titulo),
    [
      "Cheque Especial — Itaú PF",
      "Cartão de Crédito — Itaú Múltiplo PF",
    ]
  );
});

test("agrupa registros repetidos da mesma origem", () => {
  const produtos = normalizarProdutosRenegociados([
    { tipo_origem: "fatura", origem_id: 7, titulo: "Nubank", valor_renegociado: 19.75, payload: { cartoes: { id: 3, nome: "Nubank" } } },
    { tipo_origem: "fatura", origem_id: 8, titulo: "Nubank", valor_renegociado: 19.75, payload: { cartoes: { id: 3, nome: "Nubank" } } },
  ]);

  assert.equal(produtos.length, 1);
  assert.equal(produtos[0].valor, 39.5);
});
