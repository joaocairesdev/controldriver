import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lancarMensalidadeProtecao, mensalidadePodeSerLancada, resumirMensalidadesProtecao } from "./mensalidadesProtecaoService.js";

const protecao = { ativo: true, status: "ativa" };
const contrato = { status: "ativo", data_inicio_controle_financeiro: "2026-10-24" };
const plano = { ativo: true, tipo_agendamento: "recorrente", forma_pagamento_prevista: "credito_avista", cartao_pagamento_id: 2 };
const parcelas = [
  { id: 1, numero: 1, data_vencimento: "2026-08-24", valor: 178.46, status: "aberta" },
  { id: 2, numero: 2, data_vencimento: "2026-10-24", valor: 356.91, status: "aberta" },
  { id: 3, numero: 3, data_vencimento: "2026-11-24", valor: 356.91, status: "aberta" },
];

test("mensalidade histórica preserva previsão e não oferece lançamento", () => {
  assert.equal(mensalidadePodeSerLancada({ protecao, contrato, plano, parcela: parcelas[0] }), false);
  const resumo = resumirMensalidadesProtecao({ contrato, parcelas });
  assert.equal(resumo.itens[0].statusVisual, "Histórica");
  assert.equal(resumo.previsto, 892.28);
  assert.equal(resumo.lancado, 0);
  assert.equal(resumo.pago, 0);
  assert.equal(resumo.restantePrevisto, 892.28);
});

test("mensalidade controlada, inclusive futura, pode ser lançada", () => {
  assert.equal(mensalidadePodeSerLancada({ protecao, contrato, plano, parcela: parcelas[1] }), true);
  assert.equal(mensalidadePodeSerLancada({ protecao, contrato, plano, parcela: parcelas[2] }), true);
});

test("cancelamento, plano inválido e saída existente bloqueiam nova ação", () => {
  assert.equal(mensalidadePodeSerLancada({ protecao: { ...protecao, ativo: false }, contrato, plano, parcela: parcelas[1] }), false);
  assert.equal(mensalidadePodeSerLancada({ protecao, contrato: { ...contrato, status: "cancelado" }, plano, parcela: parcelas[1] }), false);
  assert.equal(mensalidadePodeSerLancada({ protecao, contrato, plano: { ...plano, ativo: false }, parcela: parcelas[1] }), false);
  assert.equal(mensalidadePodeSerLancada({ protecao, contrato, plano, parcela: { ...parcelas[1], status: "cancelada" } }), false);
  assert.equal(mensalidadePodeSerLancada({ protecao, contrato, plano, parcela: { ...parcelas[1], saida_id: 91 } }), false);
  assert.equal(mensalidadePodeSerLancada({ protecao, contrato, plano, parcela: parcelas[1], saida: { id: 91 } }), false);
});

test("realizado diferente mantém previsto e mensalidades seguintes intactos", () => {
  const saida = { id: 91, contrato_financeiro_parcela_id: 2, valor_total: 400, data_compra: "2026-10-25", forma_pagamento: "pix", conta_id: 5, status: "aberto" };
  const resumo = resumirMensalidadesProtecao({ contrato, parcelas, saidas: [saida] });
  assert.equal(resumo.previsto, 892.28);
  assert.equal(resumo.lancado, 400);
  assert.equal(resumo.pago, 0);
  assert.equal(resumo.restantePrevisto, 535.37);
  assert.equal(resumo.itens[1].valor, 356.91);
  assert.equal(resumo.itens[1].data_vencimento, "2026-10-24");
  assert.equal(resumo.itens[2].saida, null);
  assert.equal(resumo.itens[1].statusVisual, "Lançada");
});

test("pagamento de Conta a Pagar soma efetivamente quitado, sem confundir com lançado", () => {
  const saida = { id: 91, contrato_financeiro_parcela_id: 2, valor_total: 400, forma_pagamento: "pix", status: "parcial", valor_pago: 100 };
  const pagamentos = [{ conta_pagar_origem_id: 91, valor_total: 100 }];
  const resumo = resumirMensalidadesProtecao({ contrato, parcelas, saidas: [saida], pagamentos });
  assert.equal(resumo.lancado, 400);
  assert.equal(resumo.pago, 100);
  assert.equal(resumo.itens[1].statusVisual, "Lançada");
});

test("cartão só conta como quitado por item quando sua linha foi paga", () => {
  const saida = { id: 92, contrato_financeiro_parcela_id: 2, valor_total: 356.91, forma_pagamento: "credito_avista", status: "fatura" };
  const pendente = resumirMensalidadesProtecao({ contrato, parcelas, saidas: [saida], parcelasCartao: [{ saida_id: 92, status: "pendente" }] });
  assert.equal(pendente.lancado, 356.91);
  assert.equal(pendente.pago, 0);
  const pago = resumirMensalidadesProtecao({ contrato, parcelas, saidas: [saida], parcelasCartao: [{ saida_id: 92, status: "paga" }] });
  assert.equal(pago.pago, 356.91);
  assert.equal(pago.itens[1].statusVisual, "Paga");
});

function criarSupabaseLeitura(registros) {
  return {
    from(tabela) {
      let linhas = registros[tabela] || [];
      const consulta = {
        select() { return consulta; },
        eq(campo, valor) { linhas = linhas.filter((item) => String(item[campo]) === String(valor)); return consulta; },
        in(campo, valores) { linhas = linhas.filter((item) => valores.some((valor) => String(item[campo]) === String(valor))); return consulta; },
        is(campo, valor) { linhas = linhas.filter((item) => item[campo] === valor || (valor === null && item[campo] === undefined)); return consulta; },
        maybeSingle() { return Promise.resolve({ data: linhas[0] || null, error: null }); },
        then(resolver, rejeitar) { return Promise.resolve({ data: linhas, error: null }).then(resolver, rejeitar); },
      };
      return consulta;
    },
  };
}

test("lançamento pontual cartão previsto para PIX usa realizado sem mudar plano ou agenda", async () => {
  const protecaoAtual = { id: 7, veiculo_id: 3, contrato_financeiro_id: 8, ...protecao };
  const contratoAtual = { id: 8, nome: "Loovi", ...contrato };
  const planoAtual = { id: 9, contrato_id: 8, ...plano };
  const registros = {
    veiculos_protecoes: [protecaoAtual],
    contratos_financeiros: [contratoAtual],
    contratos_financeiros_planos_cobranca: [planoAtual],
    contratos_financeiros_parcelas: parcelas.map((item) => ({ ...item, contrato_id: 8, plano_cobranca_id: 9 })),
    saidas: [],
    saidas_parcelas: [],
    categorias: [{ id: 4, nome: "Seguro" }],
  };
  const supabase = criarSupabaseLeitura(registros);
  let payload;
  const resultado = await lancarMensalidadeProtecao(supabase, {
    protecao: protecaoAtual,
    parcelaId: 2,
    valor: 400,
    dataEfetiva: "2026-10-25",
    formaPagamento: "pix",
    contaId: 5,
    nomeVeiculo: "Carro",
    materializar: async (_cliente, dados) => { payload = dados; return { id: 91, ...dados }; },
  });
  assert.equal(resultado.recuperada, false);
  assert.equal(payload.dataVencimento, "2026-10-25");
  assert.equal(payload.valor, 400);
  assert.equal(payload.formaPagamento, "pix");
  assert.equal(payload.contaId, 5);
  assert.equal(payload.cartaoId, null);
  assert.equal(payload.categoria, "Seguro");
  assert.equal(payload.parcelaId, 2);
  assert.equal(planoAtual.forma_pagamento_prevista, "credito_avista");
  assert.equal(registros.contratos_financeiros_parcelas[1].valor, 356.91);
  assert.equal(registros.contratos_financeiros_parcelas[2].saida_id, undefined);
});

test("lançamento manual no cartão transmite somente valor e data efetivos da mensalidade", async () => {
  const atual = { id: 7, veiculo_id: 3, contrato_financeiro_id: 8, ...protecao };
  const supabase = criarSupabaseLeitura({
    veiculos_protecoes: [atual],
    contratos_financeiros: [{ id: 8, nome: "Loovi", ...contrato }],
    contratos_financeiros_planos_cobranca: [{ id: 9, contrato_id: 8, ...plano }],
    contratos_financeiros_parcelas: parcelas.map((item) => ({ ...item, contrato_id: 8, plano_cobranca_id: 9 })),
    categorias: [{ id: 4, nome: "Seguro" }],
  });
  let payload;
  await lancarMensalidadeProtecao(supabase, {
    protecao: atual, parcelaId: 2, valor: 356.91, dataEfetiva: "2026-10-25", formaPagamento: "credito_avista", cartaoId: 2,
    materializar: async (_cliente, dados) => { payload = dados; return { id: 92 }; },
  });
  assert.equal(payload.valor, 356.91);
  assert.equal(payload.dataVencimento, "2026-10-25");
  assert.equal(payload.cartaoId, 2);
  assert.equal(payload.contaId, null);
});

test("lançamento rejeita data impossível e valor não finito antes de persistir", async () => {
  const atual = { id: 7, veiculo_id: 3, contrato_financeiro_id: 8, ...protecao };
  const supabase = criarSupabaseLeitura({
    veiculos_protecoes: [atual],
    contratos_financeiros: [{ id: 8, nome: "Loovi", ...contrato }],
    contratos_financeiros_planos_cobranca: [{ id: 9, contrato_id: 8, ...plano }],
    contratos_financeiros_parcelas: parcelas.map((item) => ({ ...item, contrato_id: 8, plano_cobranca_id: 9 })),
  });
  let chamadas = 0;
  const materializar = async () => { chamadas += 1; };
  await assert.rejects(lancarMensalidadeProtecao(supabase, { protecao: atual, parcelaId: 2, valor: 400, dataEfetiva: "2026-02-31", formaPagamento: "pix", contaId: 5, materializar }));
  await assert.rejects(lancarMensalidadeProtecao(supabase, { protecao: atual, parcelaId: 2, valor: Infinity, dataEfetiva: "2026-10-25", formaPagamento: "pix", contaId: 5, materializar }));
  assert.equal(chamadas, 0);
});

test("lançamento repetido recupera a saída canônica e não materializa de novo", async () => {
  const atual = { id: 7, veiculo_id: 3, contrato_financeiro_id: 8, ...protecao };
  const saida = { id: 92, contrato_financeiro_parcela_id: 2, conta_pagar_origem_id: null, valor_total: 356.91, forma_pagamento: "credito_avista" };
  const supabase = criarSupabaseLeitura({
    veiculos_protecoes: [atual],
    contratos_financeiros: [{ id: 8, nome: "Loovi", ...contrato }],
    contratos_financeiros_planos_cobranca: [{ id: 9, contrato_id: 8, ...plano }],
    contratos_financeiros_parcelas: parcelas.map((item) => ({ ...item, contrato_id: 8, plano_cobranca_id: 9 })),
    saidas: [saida],
  });
  const resultado = await lancarMensalidadeProtecao(supabase, {
    protecao: atual, parcelaId: 2, valor: 999, dataEfetiva: "2026-10-27", formaPagamento: "pix", contaId: 5,
    materializar: async () => { throw new Error("Não deveria criar outra saída."); },
  });
  assert.equal(resultado.recuperada, true);
  assert.equal(resultado.saida, saida);
  assert.equal(resultado.saida.valor_total, 356.91);
});

test("AppShell não materializa mensalidades na inicialização ou ao voltar ao foco", () => {
  const appShell = readFileSync(fileURLToPath(new URL("../../../app/AppShell.jsx", import.meta.url)), "utf8");
  assert.doesNotMatch(appShell, /sincronizarCobrancasRecorrentes|sincronizacaoCobrancasRecorrentesService|visibilitychange/);
});
