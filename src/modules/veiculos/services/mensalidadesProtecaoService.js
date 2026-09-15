import { criarCobrancaContrato } from "../../contratos/services/cobrancasContratosService.js";

const credito = (forma) => ["credito_avista", "credito_parcelado"].includes(forma);
const centavos = (valor) => Math.round(Number(valor || 0) * 100);
const FORMAS_MENSAIS = new Set(["pix", "debito", "dinheiro", "credito_avista", "boleto"]);

function dataISOValida(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "")) return false;
  const dataUTC = new Date(`${data}T00:00:00Z`);
  return Number.isFinite(dataUTC.getTime()) && dataUTC.toISOString().slice(0, 10) === data;
}

export function mensalidadePodeSerLancada({ protecao, contrato, plano, parcela, saida }) {
  return Boolean(protecao?.ativo && protecao?.status === "ativa"
    && contrato?.status === "ativo"
    && contrato?.data_inicio_controle_financeiro
    && plano?.ativo && plano?.tipo_agendamento === "recorrente"
    && parcela?.status === "aberta"
    && parcela?.data_vencimento >= contrato.data_inicio_controle_financeiro
    && !parcela?.saida_id && !saida);
}

export function resumirMensalidadesProtecao({ contrato, parcelas = [], saidas = [], pagamentos = [], parcelasCartao = [] }) {
  const saidasPorParcela = new Map(saidas.map((saida) => [String(saida.contrato_financeiro_parcela_id), saida]));
  const pagamentosPorSaida = new Map();
  for (const pagamento of pagamentos) {
    const chave = String(pagamento.conta_pagar_origem_id);
    pagamentosPorSaida.set(chave, (pagamentosPorSaida.get(chave) || 0) + centavos(pagamento.valor_total));
  }
  const linhasPorSaida = new Map();
  for (const linha of parcelasCartao) {
    const chave = String(linha.saida_id);
    const lista = linhasPorSaida.get(chave) || [];
    lista.push(linha);
    linhasPorSaida.set(chave, lista);
  }
  const itens = parcelas.map((parcela) => {
    const saida = saidasPorParcela.get(String(parcela.id)) || null;
    const historica = Boolean(contrato?.data_inicio_controle_financeiro
      && parcela.data_vencimento < contrato.data_inicio_controle_financeiro);
    const linhas = linhasPorSaida.get(String(saida?.id)) || [];
    const pagoCartao = Boolean(saida && credito(saida.forma_pagamento)
      && linhas.length && linhas.every((linha) => linha.status === "paga"));
    const pago = saida && !credito(saida.forma_pagamento)
      ? Math.min(centavos(saida.valor_total), Math.max(centavos(saida.valor_pago), pagamentosPorSaida.get(String(saida.id)) || 0))
      : pagoCartao ? centavos(saida.valor_total) : 0;
    return {
      ...parcela,
      saida,
      statusVisual: parcela.status === "cancelada" || saida?.status === "cancelado" ? "Cancelada"
        : historica ? "Histórica"
          : pago >= centavos(saida?.valor_total) && saida ? "Paga"
            : saida ? "Lançada" : "A lançar",
      valorPagoEfetivo: pago / 100,
    };
  });
  return {
    itens,
    previsto: itens.reduce((soma, item) => soma + centavos(item.valor), 0) / 100,
    lancado: itens.reduce((soma, item) => soma + centavos(item.saida?.valor_total), 0) / 100,
    pago: itens.reduce((soma, item) => soma + centavos(item.valorPagoEfetivo), 0) / 100,
    restantePrevisto: itens.reduce((soma, item) => soma + (item.saida ? 0 : centavos(item.valor)), 0) / 100,
  };
}

async function consultar(supabase, tabela, filtro, valor, campos = "*") {
  const { data, error } = await supabase.from(tabela).select(campos).eq(filtro, valor);
  if (error) throw error;
  return data || [];
}

export async function carregarMensalidadesProtecao(supabase, protecao) {
  if (!protecao?.contrato_financeiro_id) return null;
  const contrato = (await consultar(supabase, "contratos_financeiros", "id", protecao.contrato_financeiro_id))[0];
  if (!contrato) return null;
  const planos = await consultar(supabase, "contratos_financeiros_planos_cobranca", "contrato_id", contrato.id);
  const plano = planos.find((item) => item.tipo_agendamento === "recorrente");
  if (!plano) return null;
  const parcelas = (await consultar(supabase, "contratos_financeiros_parcelas", "plano_cobranca_id", plano.id))
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const saidas = parcelas.length
    ? await supabase.from("saidas").select("*").in("contrato_financeiro_parcela_id", parcelas.map((item) => item.id)).is("conta_pagar_origem_id", null)
    : { data: [], error: null };
  if (saidas.error) throw saidas.error;
  const ids = (saidas.data || []).map((item) => item.id);
  const pagamentos = ids.length
    ? await supabase.from("saidas").select("*").in("conta_pagar_origem_id", ids)
    : { data: [], error: null };
  if (pagamentos.error) throw pagamentos.error;
  const parcelasCartao = ids.length
    ? await supabase.from("saidas_parcelas").select("saida_id, status").in("saida_id", ids)
    : { data: [], error: null };
  if (parcelasCartao.error) throw parcelasCartao.error;
  return {
    contrato,
    plano,
    ...resumirMensalidadesProtecao({ contrato, parcelas, saidas: saidas.data || [], pagamentos: pagamentos.data || [], parcelasCartao: parcelasCartao.data || [] }),
  };
}

export async function lancarMensalidadeProtecao(supabase, { protecao, parcelaId, valor, dataEfetiva, formaPagamento, contaId, cartaoId, nomeVeiculo, materializar = criarCobrancaContrato }) {
  const protecaoAtual = (await consultar(supabase, "veiculos_protecoes", "id", protecao.id))[0];
  if (!protecaoAtual) throw new Error("Proteção não encontrada.");
  const agenda = await carregarMensalidadesProtecao(supabase, protecaoAtual);
  const parcela = agenda?.itens.find((item) => Number(item.id) === Number(parcelaId));
  if (!parcela) throw new Error("Mensalidade não encontrada.");
  if (parcela.saida) return { saida: parcela.saida, recuperada: true };
  if (!mensalidadePodeSerLancada({ protecao: protecaoAtual, contrato: agenda.contrato, plano: agenda.plano, parcela, saida: parcela.saida })) {
    throw new Error("Esta mensalidade não pode mais ser lançada.");
  }
  if (!dataISOValida(dataEfetiva) || !Number.isFinite(centavos(valor)) || centavos(valor) <= 0 || !FORMAS_MENSAIS.has(formaPagamento)
    || (credito(formaPagamento) && !cartaoId)
    || (!credito(formaPagamento) && formaPagamento !== "boleto" && !contaId)) {
    throw new Error("Confira os dados efetivos da cobrança.");
  }
  const { data: categoria, error: erroCategoria } = await supabase.from("categorias").select("id").eq("nome", "Seguro").maybeSingle();
  if (erroCategoria) throw erroCategoria;
  const saida = await materializar(supabase, {
    contratoId: agenda.contrato.id,
    parcelaId: parcela.id,
    dataVencimento: dataEfetiva,
    valor: centavos(valor) / 100,
    formaPagamento,
    contaId: credito(formaPagamento) ? null : contaId || null,
    cartaoId: credito(formaPagamento) ? cartaoId : null,
    categoria: "Seguro",
    categoriaId: categoria?.id || null,
    descricao: `${agenda.contrato.nome} - ${nomeVeiculo || "Veículo"} (${parcela.numero}/${agenda.itens.length})`,
    finalidade: "trabalho",
    veiculoId: protecaoAtual.veiculo_id,
  });
  return { saida, recuperada: false };
}
