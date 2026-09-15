import test from "node:test";
import assert from "node:assert/strict";

import { criarCobrancaContrato } from "./cobrancasContratosService.js";

function criarSupabaseCartao({
  faturaExistente = null,
  falharVinculoUmaVez = false,
  falharInsercaoParcelaUmaVez = false,
} = {}) {
  const estado = {
    cartao: {
      id: 7,
      dia_fechamento: 5,
      dia_vencimento: 12,
    },
    fatura: faturaExistente,
    faturasCriadas: 0,
    saidas: [],
    parcelasCartao: faturaExistente ? [{
      id: 70,
      saida_id: 70,
      fatura_id: faturaExistente.id,
      numero_parcela: 1,
      valor_parcela: Number(faturaExistente.valor_total || 0),
    }] : [],
    atualizacaoParcelaContrato: null,
    falhasVinculoRestantes: falharVinculoUmaVez ? 1 : 0,
    falhasInsercaoParcelaRestantes: falharInsercaoParcelaUmaVez ? 1 : 0,
  };

  return {
    estado,
    from(tabela) {
      if (tabela === "cartoes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: estado.cartao, error: null }),
            }),
          }),
        };
      }

      if (tabela === "saidas") {
        return {
          select() {
            const filtros = {};
            const consulta = {
              eq(campo, valor) {
                filtros[campo] = valor;
                return consulta;
              },
              is(campo, valor) {
                filtros[campo] = valor;
                return consulta;
              },
              maybeSingle: async () => ({
                data: estado.saidas.find((saida) => Object.entries(filtros).every(
                  ([campo, valor]) => saida[campo] === valor,
                )) || null,
                error: null,
              }),
            };
            return consulta;
          },
          insert(payload) {
            const saida = { id: 91, conta_pagar_origem_id: null, ...payload };
            estado.saidas.push(saida);
            return {
              select: () => ({
                single: async () => ({ data: saida, error: null }),
              }),
            };
          },
        };
      }

      if (tabela === "faturas_cartao") {
        return {
          select() {
            const consulta = {
              eq: () => consulta,
              in: () => consulta,
              maybeSingle: async () => ({ data: estado.fatura, error: null }),
              single: async () => ({ data: estado.fatura, error: null }),
            };
            return consulta;
          },
          insert(payload) {
            estado.faturasCriadas += 1;
            estado.fatura = {
              id: 81,
              valor_pago: 0,
              renegociacao_id: null,
              ...payload,
            };
            return {
              select: () => ({
                single: async () => ({ data: estado.fatura, error: null }),
              }),
            };
          },
          update(payload) {
            estado.fatura = { ...estado.fatura, ...payload };
            return { eq: async () => ({ error: null }) };
          },
        };
      }

      if (tabela === "saidas_parcelas") {
        return {
          select() {
            return {
              eq: async (campo, valor) => ({
                data: estado.parcelasCartao.filter((parcela) => parcela[campo] === valor),
                error: null,
              }),
            };
          },
          insert: async (payload) => {
            if (estado.falhasInsercaoParcelaRestantes > 0) {
              estado.falhasInsercaoParcelaRestantes -= 1;
              return { error: new Error("Falha simulada ao inserir parcela") };
            }
            estado.parcelasCartao.push(...payload);
            return { error: null };
          },
        };
      }

      if (tabela === "contratos_financeiros_parcelas") {
        return {
          update(payload) {
            estado.atualizacaoParcelaContrato = payload;
            return {
              eq: async () => {
                if (estado.falhasVinculoRestantes > 0) {
                  estado.falhasVinculoRestantes -= 1;
                  return { error: new Error("Falha simulada ao vincular saída") };
                }
                return { error: null };
              },
            };
          },
        };
      }

      throw new Error(`Tabela inesperada no teste: ${tabela}`);
    },
  };
}

const dadosCobranca = {
  contratoId: 10,
  parcelaId: 20,
  dataVencimento: "2026-09-10",
  valor: 125,
  categoria: "Seguro",
  descricao: "Proteção do veículo",
  finalidade: "trabalho",
  veiculoId: 30,
};

test("cria Conta a Pagar vinculada à parcela contratual", async () => {
  const supabase = criarSupabaseCartao();

  await criarCobrancaContrato(supabase, {
    ...dadosCobranca,
    formaPagamento: "boleto",
  });

  const payloadSaida = supabase.estado.saidas[0];
  assert.equal(payloadSaida.tipo_movimentacao, "conta_pagar");
  assert.equal(payloadSaida.contrato_financeiro_id, 10);
  assert.equal(payloadSaida.contrato_financeiro_parcela_id, 20);
  assert.equal(payloadSaida.valor_total, 125);
  assert.deepEqual(supabase.estado.atualizacaoParcelaContrato, { saida_id: 91 });
});

test("cobrança no cartão reutiliza a fatura existente sem criar conta a pagar", async () => {
  const supabase = criarSupabaseCartao({
    faturaExistente: {
      id: 80,
      cartao_id: 7,
      mes: 10,
      ano: 2026,
      data_fechamento: "2026-10-05",
      data_vencimento: "2026-10-12",
      valor_total: 40,
      valor_pago: 0,
      status: "aberta",
      renegociacao_id: null,
    },
  });

  await criarCobrancaContrato(supabase, {
    ...dadosCobranca,
    formaPagamento: "credito_avista",
    cartaoId: 7,
  });

  const saida = supabase.estado.saidas[0];
  const parcelaCartao = supabase.estado.parcelasCartao.find((parcela) => parcela.saida_id === 91);
  assert.equal(saida.tipo_movimentacao, "saida");
  assert.equal(saida.status, "fatura");
  assert.equal(saida.conta_id, null);
  assert.equal(saida.cartao_id, 7);
  assert.equal(supabase.estado.faturasCriadas, 0);
  assert.equal(supabase.estado.fatura.valor_total, 165);
  assert.equal(parcelaCartao.saida_id, 91);
  assert.equal(parcelaCartao.cartao_id, 7);
  assert.equal(parcelaCartao.fatura_id, 80);
  assert.deepEqual(supabase.estado.atualizacaoParcelaContrato, { saida_id: 91 });
  assert.equal(supabase.estado.saidas.length, 1);
  assert.equal(supabase.estado.parcelasCartao.filter((parcela) => parcela.saida_id === 91).length, 1);
});

test("cobrança no cartão cria a fatura pelo fluxo padrão quando necessário", async () => {
  const supabase = criarSupabaseCartao();

  await criarCobrancaContrato(supabase, {
    ...dadosCobranca,
    formaPagamento: "credito_avista",
    cartaoId: 7,
  });

  assert.equal(supabase.estado.faturasCriadas, 1);
  assert.equal(supabase.estado.fatura.cartao_id, 7);
  assert.equal(supabase.estado.fatura.mes, 10);
  assert.equal(supabase.estado.fatura.ano, 2026);
  assert.equal(supabase.estado.fatura.data_fechamento, "2026-10-05");
  assert.equal(supabase.estado.fatura.data_vencimento, "2026-10-12");
  assert.equal(supabase.estado.fatura.valor_total, 125);
  assert.equal(supabase.estado.parcelasCartao.find((parcela) => parcela.saida_id === 91).fatura_id, 81);
});

test("segunda materialização não duplica saída, parcela nem total da fatura", async () => {
  const supabase = criarSupabaseCartao();
  const parametros = { ...dadosCobranca, formaPagamento: "credito_avista", cartaoId: 7 };

  await criarCobrancaContrato(supabase, parametros);
  await criarCobrancaContrato(supabase, parametros);

  assert.equal(supabase.estado.saidas.length, 1);
  assert.equal(supabase.estado.parcelasCartao.filter((parcela) => parcela.saida_id === 91).length, 1);
  assert.equal(supabase.estado.fatura.valor_total, 125);
});

test("recupera falha depois de criar a saída sem duplicá-la", async () => {
  const supabase = criarSupabaseCartao({ falharVinculoUmaVez: true });
  const parametros = { ...dadosCobranca, formaPagamento: "credito_avista", cartaoId: 7 };

  await assert.rejects(() => criarCobrancaContrato(supabase, parametros), /Falha simulada/);
  await criarCobrancaContrato(supabase, parametros);

  assert.equal(supabase.estado.saidas.length, 1);
  assert.equal(supabase.estado.parcelasCartao.filter((parcela) => parcela.saida_id === 91).length, 1);
  assert.equal(supabase.estado.fatura.valor_total, 125);
});

test("recupera falha após incrementar fatura por recálculo determinístico", async () => {
  const supabase = criarSupabaseCartao({ falharInsercaoParcelaUmaVez: true });
  const parametros = { ...dadosCobranca, formaPagamento: "credito_avista", cartaoId: 7 };

  await assert.rejects(() => criarCobrancaContrato(supabase, parametros), /Falha simulada/);
  assert.equal(supabase.estado.fatura.valor_total, 125);
  await criarCobrancaContrato(supabase, parametros);

  assert.equal(supabase.estado.saidas.length, 1);
  assert.equal(supabase.estado.parcelasCartao.filter((parcela) => parcela.saida_id === 91).length, 1);
  assert.equal(supabase.estado.fatura.valor_total, 125);
});

test("repara total inconsistente de fatura com parcela já existente", async () => {
  const supabase = criarSupabaseCartao({
    faturaExistente: {
      id: 80,
      cartao_id: 7,
      mes: 10,
      ano: 2026,
      data_fechamento: "2026-10-05",
      data_vencimento: "2026-10-12",
      valor_total: 40,
      valor_pago: 0,
      status: "aberta",
      renegociacao_id: null,
    },
  });
  supabase.estado.saidas.push({
    id: 91,
    conta_pagar_origem_id: null,
    contrato_financeiro_parcela_id: 20,
    forma_pagamento: "credito_avista",
    cartao_id: 7,
    data_compra: "2026-09-10",
    valor_total: 125,
  });
  supabase.estado.parcelasCartao.push({
    id: 71,
    saida_id: 91,
    fatura_id: 80,
    numero_parcela: 1,
    valor_parcela: 125,
  });
  supabase.estado.fatura.valor_total = 999;

  await criarCobrancaContrato(supabase, {
    ...dadosCobranca,
    formaPagamento: "credito_avista",
    cartaoId: 7,
  });

  assert.equal(supabase.estado.fatura.valor_total, 165);
});

test("Conta a Pagar é materializada uma única vez", async () => {
  const supabase = criarSupabaseCartao();
  const parametros = { ...dadosCobranca, formaPagamento: "boleto" };
  await criarCobrancaContrato(supabase, parametros);
  await criarCobrancaContrato(supabase, parametros);
  assert.equal(supabase.estado.saidas.length, 1);
  assert.equal(supabase.estado.saidas[0].status, "aberto");
  assert.equal(supabase.estado.saidas[0].valor_pago, undefined);
});

test("forma realizada alterada na saída não reescreve a previsão contratual", async () => {
  const supabase = criarSupabaseCartao();
  supabase.estado.saidas.push({
    id: 91,
    conta_pagar_origem_id: null,
    contrato_financeiro_parcela_id: 20,
    forma_pagamento: "pix",
    conta_id: 4,
    cartao_id: null,
    tipo_movimentacao: "saida",
    status: "pago",
    data_compra: "2026-09-10",
    valor_total: 125,
  });

  await criarCobrancaContrato(supabase, {
    ...dadosCobranca,
    formaPagamento: "credito_avista",
    cartaoId: 7,
  });

  assert.equal(supabase.estado.saidas.length, 1);
  assert.equal(supabase.estado.saidas[0].forma_pagamento, "pix");
  assert.equal(supabase.estado.saidas[0].conta_id, 4);
});
