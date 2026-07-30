import { formatarMoeda, moedaParaNumero, numeroParaMoedaInput } from "./moeda.js";

const FORMAS_CREDITO = new Set(["credito_avista", "credito_parcelado"]);

let sequenciaPagamento = 0;

function criarChavePagamento() {
  sequenciaPagamento += 1;
  return `pagamento-${Date.now()}-${sequenciaPagamento}`;
}

export function formaPagamentoEhCredito(formaPagamento) {
  return FORMAS_CREDITO.has(formaPagamento);
}

export function criarPagamentoVazio(dataVencimento = "") {
  return {
    chave: criarChavePagamento(),
    saidaId: null,
    formaPagamento: "",
    contaId: "",
    cartaoId: "",
    valor: "",
    numeroParcelas: "1",
    valorParcela: "",
    dataVencimento,
  };
}

export function normalizarSaidaComoPagamento(saida, dataVencimentoPadrao = "") {
  const valor = Number(saida?.valor_total || 0);

  return {
    chave: criarChavePagamento(),
    saidaId: saida?.id || null,
    formaPagamento: saida?.forma_pagamento || "",
    contaId: saida?.conta_id ? String(saida.conta_id) : "",
    cartaoId: saida?.cartao_id ? String(saida.cartao_id) : "",
    valor: numeroParaMoedaInput(valor),
    numeroParcelas: String(saida?.numero_parcelas || 1),
    valorParcela: numeroParaMoedaInput(saida?.valor_parcela || valor),
    dataVencimento:
      saida?.data_vencimento || dataVencimentoPadrao || saida?.data_compra || "",
  };
}

export function normalizarPagamentosEdicao(
  saidaPrincipal,
  saidasAdicionais = [],
  dataVencimentoPadrao = ""
) {
  if (!saidaPrincipal) return [criarPagamentoVazio(dataVencimentoPadrao)];

  return [saidaPrincipal, ...saidasAdicionais]
    .sort((a, b) => {
      if (a.id === saidaPrincipal.id) return -1;
      if (b.id === saidaPrincipal.id) return 1;
      return Number(a.id || 0) - Number(b.id || 0);
    })
    .map((saida) => normalizarSaidaComoPagamento(saida, dataVencimentoPadrao));
}

export function totalPagamentosEmCentavos(pagamentos) {
  return (pagamentos || []).reduce(
    (total, pagamento) =>
      total + Math.round(moedaParaNumero(pagamento.valor) * 100),
    0
  );
}

export function calcularValorRestantePagamento(valorTotal, pagamentos) {
  const totalEsperado = Math.round(moedaParaNumero(valorTotal) * 100);
  const totalInformado = totalPagamentosEmCentavos(pagamentos);
  return Math.max(totalEsperado - totalInformado, 0) / 100;
}

export function validarTotalPagamentos(valorTotal, pagamentos) {
  const totalEsperado = Math.round(moedaParaNumero(valorTotal) * 100);
  const totalInformado = totalPagamentosEmCentavos(pagamentos);
  const diferenca = totalEsperado - totalInformado;

  if (diferenca === 0) {
    return {
      valido: totalEsperado > 0,
      tipo: "completo",
      diferencaCentavos: 0,
      totalInformado: totalInformado / 100,
      mensagem: "",
    };
  }

  const valorDiferenca = Math.abs(diferenca) / 100;

  return {
    valido: false,
    tipo: diferenca > 0 ? "faltando" : "excedendo",
    diferencaCentavos: Math.abs(diferenca),
    totalInformado: totalInformado / 100,
    mensagem:
      diferenca > 0
        ? `Faltam ${formatarMoeda(valorDiferenca)} para completar o pagamento.`
        : `O valor informado excede o total em ${formatarMoeda(valorDiferenca)}.`,
  };
}

export function validarCamposPagamento(
  pagamento,
  { carteiraDisponivel = true } = {}
) {
  const erros = {};
  const credito = formaPagamentoEhCredito(pagamento?.formaPagamento);
  const boleto = pagamento?.formaPagamento === "boleto";
  const dinheiro = pagamento?.formaPagamento === "dinheiro";

  if (!pagamento?.formaPagamento) {
    erros.formaPagamento = "Selecione a forma de pagamento.";
  }
  if (moedaParaNumero(pagamento?.valor) <= 0) {
    erros.valor = "Informe o valor pago.";
  }
  if (credito && !pagamento?.cartaoId) {
    erros.cartaoId = "Selecione um cartão.";
  }
  if (!credito && !boleto && !pagamento?.contaId) {
    erros.contaId = "Selecione uma conta.";
  }
  if (boleto && !pagamento?.dataVencimento) {
    erros.dataVencimento = "Informe a data de vencimento.";
  }
  if (
    pagamento?.formaPagamento === "credito_parcelado"
    && Number(pagamento?.numeroParcelas || 0) < 2
  ) {
    erros.numeroParcelas = "Informe 2 parcelas ou mais.";
  }
  if (dinheiro && !carteiraDisponivel) {
    erros.contaId = "Cadastre uma carteira para usar dinheiro.";
  }

  return erros;
}

export function removerPagamento(pagamentos, chave) {
  if (!Array.isArray(pagamentos) || pagamentos.length <= 1) return pagamentos;
  return pagamentos.filter((pagamento) => pagamento.chave !== chave);
}

export function criarPayloadSaidaPagamento({
  pagamento,
  dataCompra,
  categoria,
  descricao,
  saidaOrigemId = null,
}) {
  const credito = formaPagamentoEhCredito(pagamento.formaPagamento);
  const boleto = pagamento.formaPagamento === "boleto";
  const parcelado = pagamento.formaPagamento === "credito_parcelado";
  const valor = moedaParaNumero(pagamento.valor);
  const parcelas = parcelado ? Number(pagamento.numeroParcelas || 2) : 1;
  const valorParcela = parcelado
    ? moedaParaNumero(pagamento.valorParcela) || valor / parcelas
    : valor;

  return {
    data_compra: dataCompra,
    forma_pagamento: pagamento.formaPagamento,
    tipo_movimentacao: boleto ? "conta_pagar" : "saida",
    conta_id: credito || boleto ? null : Number(pagamento.contaId),
    cartao_id: credito ? Number(pagamento.cartaoId) : null,
    tipo_credito: credito ? (parcelado ? "parcelado" : "avista") : null,
    numero_parcelas: parcelas,
    valor_total: valor,
    valor_parcela: valorParcela,
    data_efetivacao: boleto ? null : dataCompra,
    data_vencimento: boleto ? pagamento.dataVencimento : null,
    categoria,
    descricao,
    status: boleto ? "aberto" : credito ? "fatura" : "pago",
    saida_origem_id: saidaOrigemId,
  };
}

export function planejarPersistenciaPagamentos(
  pagamentos,
  saidaPrincipalId,
  saidasAdicionaisExistentes = []
) {
  const primeiro = pagamentos[0];
  const idsMantidos = new Set(
    pagamentos.slice(1).map((pagamento) => Number(pagamento.saidaId)).filter(Boolean)
  );

  return {
    atualizarPrincipal: { ...primeiro, saidaId: Number(saidaPrincipalId) },
    atualizarAdicionais: pagamentos
      .slice(1)
      .filter((pagamento) => pagamento.saidaId),
    inserirAdicionais: pagamentos
      .slice(1)
      .filter((pagamento) => !pagamento.saidaId),
    excluirIds: saidasAdicionaisExistentes
      .map((saida) => Number(saida.id))
      .filter((id) => !idsMantidos.has(id)),
  };
}
