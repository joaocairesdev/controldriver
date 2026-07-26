import { hojeBrasil } from "../../../shared/utils/data";
import { gerarParcelasEFaturasPadrao } from "../../cartoes/utils/cartoesUtils";
import {
  calcularResumoContrato,
  calcularTaxaJurosPercentual,
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

  const saidasPorId = new Map((saidas || []).map((saida) => [String(saida.id), saida]));
  const parcelasPorContrato = new Map();
  for (const parcela of parcelas || []) {
    const item = { ...parcela, saida: saidasPorId.get(String(parcela.saida_id)) || null };
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

export async function atualizarParcelaFutura(supabase, parcela, { dataVencimento, valor }) {
  if (!parcela?.saida) throw new Error("Conta a pagar vinculada não encontrada.");
  if (parcela.data_vencimento < HOJE() || saidaProtegida(parcela.saida)) {
    throw new Error("Somente parcelas futuras sem pagamento podem ser alteradas.");
  }

  const valorNumerico = Math.round(Number(valor) * 100) / 100;
  if (!dataVencimento || dataVencimento < HOJE()) throw new Error("Informe um vencimento de hoje em diante.");
  if (valorNumerico <= 0) throw new Error("Informe um valor de parcela maior que zero.");
  const { data: contrato, error: erroContrato } = await supabase
    .from("contratos_financeiros")
    .select("valor_recebido")
    .eq("id", parcela.contrato_id)
    .single();
  if (erroContrato) throw erroContrato;
  const { data: irmas, error: erroIrmas } = await supabase
    .from("contratos_financeiros_parcelas")
    .select("id, valor, status")
    .eq("contrato_id", parcela.contrato_id);
  if (erroIrmas) throw erroIrmas;
  const novoTotal = (irmas || [])
    .filter((item) => item.status !== "cancelada")
    .reduce((total, item) => total + Number(item.id === parcela.id ? valorNumerico : item.valor || 0), 0);
  if (novoTotal < Number(contrato.valor_recebido || 0)) {
    throw new Error("A alteração deixaria o valor contratado menor que o valor recebido.");
  }

  const atualizacao = { data_vencimento: dataVencimento, valor: valorNumerico, updated_at: new Date().toISOString() };
  const { error: erroParcela } = await supabase
    .from("contratos_financeiros_parcelas")
    .update(atualizacao)
    .eq("id", parcela.id);
  if (erroParcela) throw erroParcela;

  const { error: erroSaida } = await supabase.from("saidas").update({
    data_compra: dataVencimento,
    data_vencimento: dataVencimento,
    valor_total: valorNumerico,
    valor_parcela: valorNumerico,
  }).eq("id", parcela.saida.id);
  if (erroSaida) throw erroSaida;

  const { error: erroTotal } = await supabase.from("contratos_financeiros").update({
    valor_contratado: Math.round(novoTotal * 100) / 100,
    taxa_juros_percentual: calcularTaxaJurosPercentual(contrato.valor_recebido, novoTotal),
    updated_at: new Date().toISOString(),
  }).eq("id", parcela.contrato_id);
  if (erroTotal) throw erroTotal;
}

export async function sincronizarParcelaContratoAposPagamento(supabase, contaPagar, valorPago, status) {
  if (!contaPagar?.contrato_financeiro_parcela_id) return;
  const statusParcela = status === "pago" ? "paga" : "parcial";
  const { error: erroParcela } = await supabase
    .from("contratos_financeiros_parcelas")
    .update({ valor_pago: valorPago, status: statusParcela, updated_at: new Date().toISOString() })
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
