import assert from "node:assert/strict";
import test from "node:test";
import { atualizarCobrancaParcela } from "../services/parcelasContratosService.js";
import {
  calcularDiferencaParcela,
  criarAtualizacaoItemParcela,
  criarItensParcela,
  normalizarParcelaContrato,
  obterValorExibidoItemParcela,
  obterSaldoParcela,
  parcelaEstaAtrasada,
  parcelaPodeSerEditada,
} from "./parcelasContratos.js";

test("calcula o valor da parcela pela soma de diversos itens", () => {
  const parcela = {
    valorPrevisto: 365.91,
    valorAtualizado: 365.91,
    cobranca: { id: 70 },
    composicao: [
      { id: "cartao", nome: "Cartão Nubank PF", valorPrevisto: 227.8, valorAtualizado: 227.8 },
      { id: "conta", nome: "Conta Corrente", valorPrevisto: 138.11, valorAtualizado: 138.11 },
    ],
  };

  const itens = criarItensParcela(parcela);
  assert.equal(itens.reduce((total, item) => total + item.valorAtualizado, 0), 365.91);
  assert.deepEqual(itens.map((item) => item.nome), ["Cartão Nubank PF", "Conta Corrente"]);
});

test("deriva itens de contratos antigos sem exigir backfill", () => {
  const itens = criarItensParcela(
    { valorPrevisto: 100, valorAtualizado: 100, cobranca: { id: 9, valor_total: 100 } },
    [
      { id: 1, nome: "Cartão", valor: 60 },
      { id: 2, nome: "Cheque especial", valor: 40 },
    ]
  );

  assert.deepEqual(itens.map((item) => item.valorPrevisto), [60, 40]);
  assert.equal(itens.reduce((total, item) => total + item.valorAtualizado, 0), 100);
});

test("composição persistida da parcela ignora itens de outras parcelas", () => {
  const itens = criarItensParcela(
    {
      valorPrevisto: 40,
      valorAtualizado: 40,
      cobranca: { id: 2 },
      composicao: [
        { id: "parcela-2", nome: "Cartão de Crédito — Itaú", valorPrevisto: 40, valorAtualizado: 40 },
      ],
    },
    [
      { id: "parcela-1", nome: "Conta Corrente — Itaú", valor: 19.75 },
      { id: "parcela-3", nome: "Cheque Especial — Itaú", valor: 19.75 },
    ]
  );

  assert.deepEqual(itens.map((item) => item.id), ["parcela-2"]);
});

test("edição altera somente o valor atualizado do item", () => {
  const parcela = {
    valorPrevisto: 365.91,
    valorAtualizado: 365.91,
    cobranca: { id: 70 },
    composicao: [
      { id: "cartao", nome: "Cartão", valorPrevisto: 227.8, valorAtualizado: 227.8 },
      { id: "conta", nome: "Conta", valorPrevisto: 138.11, valorAtualizado: 138.11 },
    ],
  };

  const resultado = criarAtualizacaoItemParcela(
    parcela,
    "cartao",
    { valorAtualizado: 230 }
  );

  assert.equal(resultado.atualizacao.valor_total, 368.11);
  assert.equal(resultado.atualizacao.valor_parcela, 368.11);
  assert.deepEqual(Object.keys(resultado.atualizacao).sort(), ["valor_parcela", "valor_total"]);
  assert.equal(resultado.itens[0].valorPrevisto, 227.8);
  assert.equal(resultado.itens[0].valorAtualizado, 230);
});

test("cards e total resolvem valor atualizado antes do previsto", () => {
  const itens = [
    { valorPrevisto: 245.79, valorAtualizado: 260 },
    { valorPrevisto: 100 },
  ];

  assert.deepEqual(itens.map(obterValorExibidoItemParcela), [260, 100]);
  assert.deepEqual(itens.map(calcularDiferencaParcela), [14.21, 0]);
  assert.equal(itens.reduce((total, item) => total + obterValorExibidoItemParcela(item), 0), 360);
});

test("normaliza cobrança antiga e usa o pagamento efetivo", () => {
  const parcela = normalizarParcelaContrato({
    parcela: { id: 2, numero: 1, valor: 250 },
    cobranca: {
      id: 20,
      valor_total: 250,
      valor_pago: 250,
      status: "pago",
      data_vencimento: "2026-07-10",
    },
    pagamentos: [{ valor_total: 250, data_compra: "2026-07-09" }],
  });

  assert.equal(parcela.valorPrevisto, 250);
  assert.equal(parcela.valorAtualizado, 250);
  assert.equal(parcela.dataPagamento, "2026-07-09");
  assert.equal(obterSaldoParcela(parcela), 0);
});

test("serviço atualiza somente a cobrança que alimenta Contas a Pagar", async () => {
  const chamadas = [];
  const supabase = {
    from(tabela) {
      return {
        update(payload) {
          chamadas.push({ tabela, payload });
          return {
            async eq(campo, valor) {
              chamadas.push({ eq: [campo, valor] });
              return { error: null };
            },
          };
        },
      };
    },
  };
  const parcela = {
    id: 2,
    status: "aberta",
    valorPago: 0,
    valorPrevisto: 100,
    valorAtualizado: 100,
    cobranca: { id: 22 },
  };

  await atualizarCobrancaParcela(
    supabase,
    parcela,
    "origem",
    { valorAtualizado: 105 },
    [{ id: "origem", nome: "Banco", valor: 100 }],
    "Banco"
  );

  assert.equal(chamadas[0].tabela, "saidas");
  assert.equal(chamadas[0].payload.valor_total, 105);
  assert.deepEqual(chamadas[1], { eq: ["id", 22] });
});

test("bloqueia edição paga ou parcial e identifica atraso", () => {
  assert.equal(parcelaPodeSerEditada({ status: "aberta", valorPago: 0 }), true);
  assert.equal(parcelaPodeSerEditada({ status: "parcial", valorPago: 10 }), false);
  assert.equal(parcelaPodeSerEditada({ status: "pago", valorPago: 100 }), false);
  assert.equal(
    parcelaEstaAtrasada(
      { status: "aberta", valorAtualizado: 100, valorPago: 0, dataVencimento: "2026-07-01" },
      "2026-07-30"
    ),
    true
  );
});
