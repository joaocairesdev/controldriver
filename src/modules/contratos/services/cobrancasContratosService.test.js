import test from "node:test";
import assert from "node:assert/strict";

import { criarCobrancaContrato } from "./cobrancasContratosService.js";

test("cria Conta a Pagar vinculada à parcela contratual", async () => {
  let payloadSaida;
  let atualizacaoParcela;
  const supabase = {
    from(tabela) {
      if (tabela === "saidas") {
        return {
          insert(payload) {
            payloadSaida = payload;
            return { select: () => ({ single: async () => ({ data: { id: 91 }, error: null }) }) };
          },
        };
      }
      return {
        update(payload) {
          atualizacaoParcela = payload;
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };

  await criarCobrancaContrato(supabase, {
    contratoId: 10,
    parcelaId: 20,
    dataVencimento: "2026-10-10",
    valor: 125,
    formaPagamento: "boleto",
    categoria: "Seguro",
    descricao: "Proteção do veículo",
    finalidade: "trabalho",
    veiculoId: 30,
  });

  assert.equal(payloadSaida.tipo_movimentacao, "conta_pagar");
  assert.equal(payloadSaida.contrato_financeiro_id, 10);
  assert.equal(payloadSaida.contrato_financeiro_parcela_id, 20);
  assert.equal(payloadSaida.valor_total, 125);
  assert.deepEqual(atualizacaoParcela, { saida_id: 91 });
});
