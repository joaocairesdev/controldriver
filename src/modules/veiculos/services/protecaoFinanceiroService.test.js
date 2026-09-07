import test from "node:test";
import assert from "node:assert/strict";

import { montarPlanosCobrancaProtecao } from "./protecaoFinanceiroService.js";

const origem = {
  formaPagamento: "boleto",
  contaId: "",
  cartaoId: "",
};

function dadosBase() {
  return {
    fimVigencia: "2027-08-31",
    pagamentoUnico: { valor: 1200, dataPagamento: "2026-09-10", ...origem },
    mensal: { valorMensal: 100, primeiroVencimento: "2026-09-10", ...origem },
    parcelado: { valorTotal: 1200, numeroParcelas: 12, primeiroVencimento: "2026-09-10", ...origem },
    entrada: { valor: 200, dataPagamento: "2026-09-05", formaPagamento: "pix", contaId: "4", cartaoId: "" },
    parcelas: { numeroParcelas: 10, valorParcela: 100, primeiroVencimento: "2026-10-10", ...origem },
  };
}

test("pagamento único gera um plano e uma obrigação", () => {
  const planos = montarPlanosCobrancaProtecao({ ...dadosBase(), formaContratacao: "pagamento_unico" });
  assert.equal(planos.length, 1);
  assert.equal(planos[0].tipoAgendamento, "unica");
  assert.deepEqual(planos[0].parcelas, [{ numero: 1, vencimento: "2026-09-10", valor: 1200 }]);
});

test("mensal reutiliza a recorrência mensal até o fim da vigência", () => {
  const planos = montarPlanosCobrancaProtecao({
    ...dadosBase(),
    fimVigencia: "2028-08-31",
    formaContratacao: "mensal",
  });
  assert.equal(planos[0].tipoAgendamento, "recorrente");
  assert.equal(planos[0].parcelas.length, 24);
  assert.equal(planos[0].parcelas.at(-1).vencimento, "2028-08-10");
});

test("parcelado reutiliza a distribuição do motor de contratos", () => {
  const dados = dadosBase();
  dados.parcelado = { ...dados.parcelado, valorTotal: 100, numeroParcelas: 3 };
  const [plano] = montarPlanosCobrancaProtecao({ ...dados, formaContratacao: "parcelado" });
  assert.deepEqual(plano.parcelas.map((item) => item.valor), [33.33, 33.33, 33.34]);
});

test("entrada e parcelas mantêm planos e origens independentes", () => {
  const planos = montarPlanosCobrancaProtecao({ ...dadosBase(), formaContratacao: "entrada_parcelas" });
  assert.equal(planos.length, 2);
  assert.equal(planos[0].papel, "entrada");
  assert.equal(planos[0].contaPagamentoId, 4);
  assert.equal(planos[1].papel, "saldo");
  assert.equal(planos[1].parcelas.length, 10);
  assert.equal(planos[1].contaPagamentoId, null);
});
