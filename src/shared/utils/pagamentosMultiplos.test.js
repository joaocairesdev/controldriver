import test from "node:test";
import assert from "node:assert/strict";

import {
  calcularValorRestantePagamento,
  criarPagamentoVazio,
  criarPayloadSaidaPagamento,
  normalizarPagamentosEdicao,
  planejarPersistenciaPagamentos,
  removerPagamento,
  validarCamposPagamento,
  validarTotalPagamentos,
} from "./pagamentosMultiplos.js";
import { distribuirValorEntreParcelas } from "../../modules/cartoes/utils/cartoesUtils.js";

function pagamento(valor, extras = {}) {
  return {
    ...criarPagamentoVazio("2026-07-30"),
    formaPagamento: "pix",
    contaId: "1",
    valor,
    ...extras,
  };
}

test("aceita pagamento único com o valor integral", () => {
  assert.deepEqual(validarTotalPagamentos("200,00", [pagamento("200,00")]), {
    valido: true,
    tipo: "completo",
    diferencaCentavos: 0,
    totalInformado: 200,
    mensagem: "",
  });
});

test("aceita dois e três pagamentos cuja soma fecha o abastecimento", () => {
  assert.equal(
    validarTotalPagamentos("200,00", [
      pagamento("50,00"),
      pagamento("150,00", { formaPagamento: "debito", contaId: "2" }),
    ]).valido,
    true
  );
  assert.equal(
    validarTotalPagamentos("320,00", [
      pagamento("100,00"),
      pagamento("120,00", { formaPagamento: "credito_avista", cartaoId: "4" }),
      pagamento("100,00", { formaPagamento: "dinheiro", contaId: "3" }),
    ]).valido,
    true
  );
});

test("calcula automaticamente o saldo da próxima forma de pagamento", () => {
  assert.equal(
    calcularValorRestantePagamento("111,15", [pagamento("90,00")]),
    21.15
  );
  assert.equal(
    calcularValorRestantePagamento("111,15", [pagamento("120,00")]),
    0
  );
});

test("valida os campos obrigatórios antes de adicionar outro pagamento", () => {
  assert.deepEqual(
    validarCamposPagamento({
      formaPagamento: "",
      contaId: "",
      cartaoId: "",
      valor: "",
    }),
    {
      formaPagamento: "Selecione a forma de pagamento.",
      valor: "Informe o valor pago.",
      contaId: "Selecione uma conta.",
    }
  );

  assert.deepEqual(
    validarCamposPagamento(pagamento("90,00")),
    {}
  );
});

test("valida a origem correspondente à forma de pagamento", () => {
  assert.deepEqual(
    validarCamposPagamento(pagamento("90,00", {
      formaPagamento: "credito_avista",
      contaId: "",
      cartaoId: "",
    })),
    { cartaoId: "Selecione um cartão." }
  );

  assert.deepEqual(
    validarCamposPagamento(pagamento("90,00", {
      formaPagamento: "dinheiro",
      contaId: "",
    }), { carteiraDisponivel: false }),
    { contaId: "Cadastre uma carteira para usar dinheiro." }
  );
});

test("informa quanto falta ou excede em centavos", () => {
  const faltando = validarTotalPagamentos("320,00", [pagamento("318,00")]);
  const excedendo = validarTotalPagamentos("320,00", [pagamento("325,00")]);

  assert.equal(faltando.tipo, "faltando");
  assert.equal(faltando.diferencaCentavos, 200);
  assert.match(faltando.mensagem, /Faltam R\$\s2,00/);
  assert.equal(excedendo.tipo, "excedendo");
  assert.equal(excedendo.diferencaCentavos, 500);
  assert.match(excedendo.mensagem, /excede o total em R\$\s5,00/);
});

test("remove uma linha sem permitir que a lista fique vazia", () => {
  const primeiro = pagamento("50,00");
  const segundo = pagamento("150,00");

  assert.deepEqual(removerPagamento([primeiro], primeiro.chave), [primeiro]);
  assert.deepEqual(removerPagamento([primeiro, segundo], primeiro.chave), [segundo]);
});

test("normaliza abastecimento antigo como um único pagamento editável", () => {
  const pagamentos = normalizarPagamentosEdicao({
    id: 10,
    forma_pagamento: "pix",
    conta_id: 2,
    valor_total: 80,
    valor_parcela: 80,
    numero_parcelas: 1,
    data_compra: "2026-07-30",
  });

  assert.equal(pagamentos.length, 1);
  assert.equal(pagamentos[0].saidaId, 10);
  assert.equal(pagamentos[0].contaId, "2");
  assert.equal(pagamentos[0].valor, "80,00");
});

test("monta payloads financeiros com as contas e cartões de cada pagamento", () => {
  const pix = criarPayloadSaidaPagamento({
    pagamento: pagamento("50,00", { contaId: "2" }),
    dataCompra: "2026-07-30",
    categoria: "Abastecimento",
    descricao: "Compra de combustível",
  });
  const credito = criarPayloadSaidaPagamento({
    pagamento: pagamento("150,00", {
      formaPagamento: "credito_parcelado",
      contaId: "",
      cartaoId: "7",
      numeroParcelas: "3",
      valorParcela: "50,00",
    }),
    dataCompra: "2026-07-30",
    categoria: "Abastecimento",
    descricao: "Compra de combustível",
    saidaOrigemId: 10,
  });

  assert.equal(pix.conta_id, 2);
  assert.equal(pix.cartao_id, null);
  assert.equal(pix.valor_total, 50);
  assert.equal(credito.conta_id, null);
  assert.equal(credito.cartao_id, 7);
  assert.equal(credito.saida_origem_id, 10);
  assert.equal(credito.numero_parcelas, 3);
  assert.equal(credito.valor_parcela, 50);
});

test("planeja edição preservando, incluindo e removendo pagamentos adicionais", () => {
  const principal = pagamento("100,00", { saidaId: 10 });
  const mantido = pagamento("50,00", { saidaId: 11 });
  const novo = pagamento("50,00");
  const plano = planejarPersistenciaPagamentos(
    [principal, mantido, novo],
    10,
    [{ id: 11 }, { id: 12 }]
  );

  assert.equal(plano.atualizarPrincipal.saidaId, 10);
  assert.deepEqual(plano.atualizarAdicionais.map((item) => item.saidaId), [11]);
  assert.equal(plano.inserirAdicionais.length, 1);
  assert.deepEqual(plano.excluirIds, [12]);
});

test("fecha o arredondamento do crédito parcelado na última parcela", () => {
  assert.deepEqual(
    distribuirValorEntreParcelas(100, 3, 33.33),
    [33.33, 33.33, 33.34]
  );
  assert.equal(
    distribuirValorEntreParcelas(100, 3, 33.33).reduce(
      (total, valor) => total + valor,
      0
    ),
    100
  );
});
