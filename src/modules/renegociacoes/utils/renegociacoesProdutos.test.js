import assert from "node:assert/strict";
import test from "node:test";
import {
  criarComposicaoParcelaRenegociacao,
  normalizarProdutosRenegociados,
} from "./renegociacoesUtils.js";
import { criarAtualizacaoItemParcela } from "../../../shared/utils/parcelasContratos.js";

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

test("reabre o valor atualizado da parcela persistido no item da renegociação", () => {
  const itens = [
    {
      id: 27,
      tipo_origem: "fatura",
      origem_id: 21,
      titulo: "Nubank",
      valor_renegociado: 200,
      payload: { cartoes: { id: 3, nome: "Nubank" } },
    },
    {
      id: 10,
      tipo_origem: "fatura",
      origem_id: 20,
      titulo: "Nubank",
      valor_renegociado: 200,
      payload: {
        cartoes: { id: 3, nome: "Nubank" },
        ajustes_parcelas: {
          2: {
            valorPrevisto: 100,
            valorAtualizado: 108.5,
          },
        },
      },
    },
  ];

  const parcelaEditada = criarComposicaoParcelaRenegociacao({
    itens,
    numeroParcela: 2,
    valorPrevisto: 100,
    nomePadrao: "Banco",
  });
  const parcelaSemAjuste = criarComposicaoParcelaRenegociacao({
    itens,
    numeroParcela: 1,
    valorPrevisto: 100,
    nomePadrao: "Banco",
  });

  assert.equal(parcelaEditada[0].valorAtualizado, 108.5);
  assert.equal(parcelaSemAjuste[0].valorAtualizado, 100);
});

test("resolve cartão, cheque especial e empréstimo com ajustes independentes", () => {
  const itens = [
    {
      tipo_origem: "fatura",
      origem_id: 1,
      titulo: "Cartão",
      valor_renegociado: 100,
      payload: {
        cartoes: { id: 1, nome: "Cartão" },
        ajustes_parcelas: {
          1: { valorPrevisto: 100, valorAtualizado: 110 },
        },
      },
    },
    {
      tipo_origem: "conta_negativa",
      origem_id: 2,
      titulo: "Cheque especial",
      valor_renegociado: 100,
      payload: {
        contas: { id: 2, nome: "Cheque especial" },
        ajustes_parcelas: {
          1: { valorPrevisto: 100, valorAtualizado: 95 },
        },
      },
    },
    {
      tipo_origem: "conta",
      origem_id: 3,
      titulo: "Empréstimo",
      detalhe: "Empréstimo",
      valor_renegociado: 100,
      payload: {
        ajustes_parcelas: {
          1: { valorPrevisto: 100, valorAtualizado: 120 },
        },
      },
    },
  ];

  const composicao = criarComposicaoParcelaRenegociacao({
    itens,
    numeroParcela: 1,
    valorPrevisto: 300,
    nomePadrao: "Banco",
  });

  assert.deepEqual(
    composicao.map((item) => item.valorAtualizado),
    [110, 95, 120]
  );
  assert.equal(composicao.reduce((total, item) => total + item.valorAtualizado, 0), 325);
});

test("altera cartão, cheque especial e empréstimo sem uma edição reverter a outra", () => {
  let parcela = {
    valorPrevisto: 300,
    valorAtualizado: 300,
    composicao: [
      { id: "fatura-1", nome: "Cartão", valorPrevisto: 100, valorAtualizado: 100 },
      { id: "conta_negativa-2", nome: "Cheque especial", valorPrevisto: 100, valorAtualizado: 100 },
      { id: "conta-3", nome: "Empréstimo", valorPrevisto: 100, valorAtualizado: 100 },
    ],
  };

  for (const [itemId, valorAtualizado] of [
    ["fatura-1", 110],
    ["conta_negativa-2", 95],
    ["conta-3", 120],
  ]) {
    const resultado = criarAtualizacaoItemParcela(parcela, itemId, { valorAtualizado });
    parcela = {
      ...parcela,
      valorAtualizado: resultado.atualizacao.valor_total,
      composicao: resultado.itens,
    };
  }

  assert.deepEqual(
    parcela.composicao.map((item) => item.valorAtualizado),
    [110, 95, 120]
  );
  assert.equal(parcela.valorAtualizado, 325);
});
