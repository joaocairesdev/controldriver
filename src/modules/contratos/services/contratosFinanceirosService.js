import { hojeBrasil } from "../../../shared/utils/data";
import { atualizarCobrancaParcela } from "../../../shared/services/parcelasContratosService";
import { normalizarParcelaContrato } from "../../../shared/utils/parcelasContratos";
import { gerarParcelasEFaturasPadrao } from "../../cartoes/utils/cartoesUtils";
import {
  calcularResumoContrato,
  gerarParcelasContrato,
} from "../utils/contratosFinanceiros";

const HOJE = hojeBrasil;

function saidaProtegida(saida) {
  return ["pago", "parcial", "cancelado", "excluido"].includes(String(saida?.status || "").toLowerCase())
    || Number(saida?.valor_pago || 0) > 0;
}

export async function buscarContratosFinanceiros(supabase, tipoContrato = "emprestimo") {
  const { data: contratos, error: erroContratos } = await supabase
    .from("contratos_financeiros")
    .select("*")
    .eq("tipo_contrato", tipoContrato)
    .order("data_contratacao", { ascending: false })
    .order("id", { ascending: false });
  if (erroContratos) throw erroContratos;
  if (!contratos?.length) return [];

  const ids = contratos.map((contrato) => contrato.id);
  const { data: parcelas, error: erroParcelas } = await supabase
    .from("contratos_financeiros_parcelas")
    .select("*")
    .in("contrato_id", ids)
    .order("numero");
  if (erroParcelas) throw erroParcelas;

  const saidaIds = (parcelas || []).map((parcela) => parcela.saida_id).filter(Boolean);
  const { data: saidas, error: erroSaidas } = saidaIds.length
    ? await supabase.from("saidas").select("*").in("id", saidaIds)
    : { data: [], error: null };
  if (erroSaidas) throw erroSaidas;

  const { data: pagamentos, error: erroPagamentos } = saidaIds.length
    ? await supabase.from("saidas").select("*").in("conta_pagar_origem_id", saidaIds).order("data_compra")
    : { data: [], error: null };
  if (erroPagamentos) throw erroPagamentos;

  const saidasPorId = new Map((saidas || []).map((saida) => [String(saida.id), saida]));
  const pagamentosPorSaida = new Map();
  for (const pagamento of pagamentos || []) {
    const chave = String(pagamento.conta_pagar_origem_id);
    const lista = pagamentosPorSaida.get(chave) || [];
    lista.push(pagamento);
    pagamentosPorSaida.set(chave, lista);
  }
  const parcelasPorContrato = new Map();
  for (const parcela of parcelas || []) {
    const saida = saidasPorId.get(String(parcela.saida_id)) || null;
    const normalizada = normalizarParcelaContrato({
      parcela,
      cobranca: saida,
      pagamentos: pagamentosPorSaida.get(String(parcela.saida_id)) || [],
    });
    const item = {
      ...parcela,
      saida,
      ...normalizada,
      valor: normalizada.valorAtualizado,
      valor_pago: normalizada.valorPago,
      status: parcela.status,
    };
    const lista = parcelasPorContrato.get(String(parcela.contrato_id)) || [];
    lista.push(item);
    parcelasPorContrato.set(String(parcela.contrato_id), lista);
  }

  return contratos.map((contrato) => ({
    ...contrato,
    parcelas: parcelasPorContrato.get(String(contrato.id)) || [],
  }));
}

export async function criarContratoFinanceiro(supabase, contrato) {
  const parcelas = gerarParcelasContrato({
    quantidade: contrato.quantidade_parcelas,
    valorContratado: contrato.valor_contratado,
    primeiroVencimento: contrato.primeiro_vencimento,
    periodicidade: "mensal",
  });
  const { data, error } = await supabase.rpc("criar_contrato_financeiro", {
    p_contrato: contrato,
    p_parcelas: parcelas,
  });
  if (error) throw error;
  return data;
}

export async function atualizarDadosContrato(supabase, contratoId, dados) {
  const permitidos = {
    tipo_credor: dados.tipo_credor,
    credor_nome: dados.credor_nome?.trim(),
    taxa_juros_percentual: Number(dados.taxa_juros_percentual || 0),
    descricao: dados.descricao?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("contratos_financeiros")
    .update(permitidos)
    .eq("id", contratoId)
    .select()
    .single();
  if (error) throw error;
  const descricaoEntrada = dados.descricao?.trim() || `Empréstimo recebido - ${dados.credor_nome?.trim()}`;
  const { error: erroEntrada } = await supabase.from("entradas_avulsas").update({
    descricao: descricaoEntrada,
  }).eq("contrato_financeiro_id", contratoId);
  if (erroEntrada) throw erroEntrada;
  return data;
}

export async function excluirContratoFinanceiro(supabase, contrato) {
  const { data, error } = await supabase.rpc("excluir_contrato_financeiro_seguro", {
    p_contrato_id: contrato.id,
  });
  if (error) throw error;
  return data;
}

export async function atualizarParcelaFutura(
  supabase,
  parcela,
  itemId,
  ajuste,
  itensBase,
  nomePadrao
) {
  return atualizarCobrancaParcela(
    supabase,
    parcela,
    itemId,
    ajuste,
    itensBase,
    nomePadrao
  );
}

export async function sincronizarParcelaContratoAposPagamento(supabase, contaPagar, valorPago, status) {
  if (!contaPagar?.contrato_financeiro_parcela_id) return;
  const { data: parcela, error: erroBuscaParcela } = await supabase
    .from("contratos_financeiros_parcelas")
    .select("valor")
    .eq("id", contaPagar.contrato_financeiro_parcela_id)
    .single();
  if (erroBuscaParcela) throw erroBuscaParcela;

  const statusParcela = status === "pago" ? "paga" : "parcial";
  const valorContratualPago = status === "pago"
    ? Number(parcela.valor || 0)
    : Math.min(Number(valorPago || 0), Number(parcela.valor || 0));
  const { error: erroParcela } = await supabase
    .from("contratos_financeiros_parcelas")
    .update({ valor_pago: valorContratualPago, status: statusParcela, updated_at: new Date().toISOString() })
    .eq("id", contaPagar.contrato_financeiro_parcela_id);
  if (erroParcela) throw erroParcela;

  if (status !== "pago" || !contaPagar.contrato_financeiro_id) return;
  const { data: pendentes, error: erroPendentes } = await supabase
    .from("contratos_financeiros_parcelas")
    .select("id")
    .eq("contrato_id", contaPagar.contrato_financeiro_id)
    .in("status", ["aberta", "parcial"])
    .limit(1);
  if (erroPendentes) throw erroPendentes;
  if (!pendentes?.length) {
    const { error } = await supabase.from("contratos_financeiros").update({
      status: "quitado",
      quitado_em: HOJE(),
      updated_at: new Date().toISOString(),
    }).eq("id", contaPagar.contrato_financeiro_id);
    if (error) throw error;
  }
}

export async function cancelarParcelasFuturas(supabase, contrato) {
  const cancelaveis = (contrato?.parcelas || []).filter((parcela) =>
    parcela.data_vencimento >= HOJE() && !saidaProtegida(parcela.saida) && parcela.status !== "cancelada"
  );
  if (!cancelaveis.length) throw new Error("Não há parcelas futuras sem pagamento para cancelar.");

  const idsParcelas = cancelaveis.map((parcela) => parcela.id);
  const idsSaidas = cancelaveis.map((parcela) => parcela.saida_id).filter(Boolean);
  const agora = new Date().toISOString();
  const { error: erroParcelas } = await supabase.from("contratos_financeiros_parcelas").update({
    status: "cancelada",
    cancelada_em: agora,
    updated_at: agora,
  }).in("id", idsParcelas);
  if (erroParcelas) throw erroParcelas;
  if (idsSaidas.length) {
    const { error: erroSaidas } = await supabase.from("saidas").update({ status: "cancelado" }).in("id", idsSaidas);
    if (erroSaidas) throw erroSaidas;
  }
  const idsCancelados = new Set(idsParcelas.map(String));
  const aindaAtivas = (contrato.parcelas || []).some((parcela) =>
    !idsCancelados.has(String(parcela.id)) && ["aberta", "parcial"].includes(parcela.status)
  );
  const { error: erroContrato } = await supabase.from("contratos_financeiros").update({
    status: aindaAtivas ? "ativo" : "cancelado",
    cancelado_em: aindaAtivas ? null : HOJE(),
    updated_at: agora,
  }).eq("id", contrato.id);
  if (erroContrato) throw erroContrato;
}

export async function quitarContratoAntecipadamente(supabase, contrato, pagamento) {
  const resumo = calcularResumoContrato(contrato);
  if (resumo.saldoDevedor <= 0) throw new Error("Este contrato não possui saldo devedor.");
  if (!pagamento?.formaPagamento) throw new Error("Escolha a forma usada na quitação.");
  const credito = ["credito_avista", "credito_parcelado"].includes(pagamento.formaPagamento);
  if (credito && (!pagamento.cartaoId || !pagamento.cartao)) throw new Error("Escolha o cartão usado na quitação.");
  if (!credito && !pagamento.contaId) throw new Error("Escolha a conta usada na quitação.");
  if (Math.round(Number(pagamento.valorPago || 0) * 100) !== Math.round(resumo.saldoDevedor * 100)) {
    throw new Error("A quitação deve registrar o saldo devedor integral.");
  }
  const hoje = pagamento.dataPagamento || HOJE();
  const parcelasPagamento = credito ? Math.max(Number(pagamento.numeroParcelas || 1), 1) : 1;
  const valorParcelaPagamento = Math.round((resumo.saldoDevedor / parcelasPagamento) * 100) / 100;
  const { data: saida, error: erroSaida } = await supabase.from("saidas").insert({
    data_compra: hoje,
    forma_pagamento: pagamento.formaPagamento,
    tipo_movimentacao: "saida",
    conta_id: credito ? null : pagamento.contaId,
    cartao_id: credito ? pagamento.cartaoId : null,
    tipo_credito: pagamento.formaPagamento === "credito_parcelado" ? "parcelado" : credito ? "avista" : null,
    numero_parcelas: parcelasPagamento,
    valor_total: resumo.saldoDevedor,
    valor_parcela: valorParcelaPagamento,
    data_efetivacao: credito ? null : hoje,
    categoria: "Empréstimo",
    finalidade: null,
    descricao: `Quitação antecipada - ${contrato.credor_nome}`,
    status: credito ? "fatura" : "pago",
    contrato_financeiro_id: contrato.id,
  }).select().single();
  if (erroSaida) throw erroSaida;

  if (credito) {
    const cartao = pagamento.cartao;
    await gerarParcelasEFaturasPadrao(supabase, {
      saidaId: saida.id,
      cartao,
      cartaoId: cartao.id,
      dataBase: hoje,
      quantidadeParcelas: parcelasPagamento,
      valorParcela: valorParcelaPagamento,
    });
  }

  const ativas = (contrato.parcelas || []).filter((parcela) => parcela.status !== "cancelada" && Number(parcela.valor || 0) > Number(parcela.valor_pago || 0));
  for (const parcela of ativas) {
    const { error: erroParcela } = await supabase.from("contratos_financeiros_parcelas").update({
      valor_pago: parcela.valor,
      status: "paga",
      updated_at: new Date().toISOString(),
    }).eq("id", parcela.id);
    if (erroParcela) throw erroParcela;
    if (parcela.saida_id) {
      const { error: erroConta } = await supabase.from("saidas").update({
        valor_pago: parcela.valor,
        status: "pago",
        data_efetivacao: hoje,
      }).eq("id", parcela.saida_id);
      if (erroConta) throw erroConta;
    }
  }

  const { error: erroContrato } = await supabase.from("contratos_financeiros").update({
    status: "quitado",
    quitado_em: hoje,
    updated_at: new Date().toISOString(),
  }).eq("id", contrato.id);
  if (erroContrato) throw erroContrato;
}
