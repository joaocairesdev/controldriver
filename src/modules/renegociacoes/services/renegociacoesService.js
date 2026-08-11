import { supabase } from "../../../services/supabase";
import {
  criarAtualizacaoItemParcela,
  normalizarParcelaContrato,
  parcelaPodeSerEditada,
} from "../../../shared/utils/parcelasContratos";
import { calcularSaldoAbertoFatura } from "../../cartoes/utils/cartoesUtils";
import {
  adicionarMeses,
  calcularValorParcelaRenegociacao,
  criarComposicaoParcelaRenegociacao,
  encontrarItemRenegociacaoPorProduto,
  MODELO_ENTRADA_INDEPENDENTE,
  usaEntradaIndependente,
} from "../utils/renegociacoesUtils";

export async function carregarRenegociacoes() {
  const [
    { data, error },
    { data: saidasAcordos, error: erroParcelas },
    { data: itensRenegociacoes, error: erroItens },
  ] = await Promise.all([
    supabase
      .from("renegociacoes")
      .select("*")
      .order("data_renegociacao", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("saidas")
      .select("*")
      .not("renegociacao_id", "is", null)
      .eq("categoria", "Renegociação"),
    supabase
      .from("renegociacoes_itens")
      .select("*"),
  ]);

  if (error) throw error;
  if (erroParcelas) throw erroParcelas;
  if (erroItens) throw erroItens;

  const cobrancasIds = (saidasAcordos || [])
    .filter((saida) => ["conta_pagar", "renegociacao_entrada"].includes(saida.tipo_movimentacao))
    .map((saida) => saida.id);
  const { data: pagamentos, error: erroPagamentos } = cobrancasIds.length
    ? await supabase.from("saidas").select("*").in("conta_pagar_origem_id", cobrancasIds).order("data_compra")
    : { data: [], error: null };
  if (erroPagamentos) throw erroPagamentos;

  const pagamentosPorCobranca = new Map();
  for (const pagamento of pagamentos || []) {
    const chave = String(pagamento.conta_pagar_origem_id);
    const lista = pagamentosPorCobranca.get(chave) || [];
    lista.push(pagamento);
    pagamentosPorCobranca.set(chave, lista);
  }

  return (data || []).map((renegociacao) => {
    const itensDoAcordo = (itensRenegociacoes || []).filter(
      (item) => String(item.renegociacao_id) === String(renegociacao.id)
    );
    const entradaIndependente = usaEntradaIndependente(itensDoAcordo);
    const valorPrevistoParcela = calcularValorParcelaRenegociacao({
      valorRenegociado: renegociacao.valor_renegociado,
      valorEntrada: renegociacao.valor_entrada,
      numeroParcelas: renegociacao.numero_parcelas,
      entradaIndependente,
    });
    const parcelasDoAcordo = (saidasAcordos || []).filter(
      (parcela) => String(parcela.renegociacao_id) === String(renegociacao.id)
    );
    const parcelasMensais = parcelasDoAcordo
      .filter((parcela) =>
        parcela.tipo_movimentacao === "conta_pagar"
        && Number(parcela.numero_parcelas || 0) !== 0
      )
      .sort((a, b) =>
        String(a.data_vencimento || "").localeCompare(String(b.data_vencimento || ""))
        || Number(a.id) - Number(b.id)
      );
    const cobrancaEntrada = parcelasDoAcordo.find(
      (parcela) => parcela.tipo_movimentacao === "renegociacao_entrada"
        || (
          parcela.tipo_movimentacao === "conta_pagar"
          && Number(parcela.numero_parcelas || 0) === 0
          && String(parcela.descricao || "").startsWith("Entrada da renegociação")
        )
    );
    const entradaNormalizada = cobrancaEntrada
      ? normalizarParcelaContrato({
          parcela: { valor: Number(renegociacao.valor_entrada || 0) },
          cobranca: cobrancaEntrada,
          numero: 0,
          pagamentos: pagamentosPorCobranca.get(String(cobrancaEntrada.id)) || [],
        })
      : null;
    const pagas = parcelasMensais.filter(
      (parcela) => parcela.status === "pago" || Number(parcela.valor_pago || 0) >= Number(parcela.valor_total || 0)
    );
    const valorPago = parcelasDoAcordo.reduce((total, parcela) => {
      const totalParcela = Number(parcela.valor_total || 0);
      if (parcela.status === "pago") return total + totalParcela;
      return total + Math.min(Number(parcela.valor_pago || 0), totalParcela);
    }, 0);
    const proxima = parcelasMensais
      .filter((parcela) => !(parcela.status === "pago" || Number(parcela.valor_pago || 0) >= Number(parcela.valor_total || 0)))
      .sort((a, b) => String(a.data_vencimento || "").localeCompare(String(b.data_vencimento || "")))[0];
    const parcelasNormalizadas = parcelasMensais.map((parcela, indice) => {
      const numero = indice + 1;
      const composicao = criarComposicaoParcelaRenegociacao({
        itens: itensDoAcordo,
        numeroParcela: numero,
        valorPrevisto: valorPrevistoParcela,
        nomePadrao: renegociacao.credor,
      });

      return {
        ...normalizarParcelaContrato({
          parcela: { valor: valorPrevistoParcela },
          cobranca: parcela,
          numero,
          pagamentos: pagamentosPorCobranca.get(String(parcela.id)) || [],
        }),
        composicao,
      };
    });

    return {
      ...renegociacao,
      parcelas_pagas: pagas.length,
      valor_pago_acordo: valorPago,
      proximo_vencimento: proxima?.data_vencimento || null,
      proxima_parcela_valor: proxima?.valor_total || null,
      saldo_devedor: parcelasNormalizadas.reduce(
        (total, parcela) => total + Math.max(parcela.valorAtualizado - parcela.valorPago, 0),
        entradaNormalizada
          ? Math.max(entradaNormalizada.valorAtualizado - entradaNormalizada.valorPago, 0)
          : 0
      ),
      entrada_independente: entradaIndependente,
      entrada: entradaNormalizada,
      parcelas: parcelasNormalizadas,
    };
  });
}

export async function atualizarParcelaRenegociacao(
  parcela,
  itemId,
  ajuste,
  itensBase,
  nomePadrao
) {
  if (!parcela?.cobranca?.id || !parcela?.renegociacaoId) {
    throw new Error("Parcela da renegociação não encontrada.");
  }
  if (!parcelaPodeSerEditada(parcela)) {
    throw new Error("Somente parcelas abertas e sem pagamento podem ser alteradas.");
  }

  const resultado = criarAtualizacaoItemParcela(
    parcela,
    itemId,
    ajuste,
    itensBase,
    nomePadrao
  );
  const itensRenegociacao = await carregarItensRenegociacao(parcela.renegociacaoId);
  const itemPersistencia = encontrarItemRenegociacaoPorProduto(itensRenegociacao, itemId);
  if (!itemPersistencia) throw new Error("Item da renegociação não encontrado.");

  const itemAtualizado = resultado.itens.find((item) => String(item.id) === String(itemId));
  const payloadAnterior = itemPersistencia.payload || {};
  const ajustesAnteriores = Object.fromEntries(
    Object.entries(payloadAnterior.ajustes_parcelas || {}).map(([numero, ajusteExistente]) => [
      numero,
      {
        valorPrevisto: ajusteExistente?.valorPrevisto,
        valorAtualizado: ajusteExistente?.valorAtualizado,
      },
    ])
  );
  const payloadAtualizado = {
    ...payloadAnterior,
    ajustes_parcelas: {
      ...ajustesAnteriores,
      [String(parcela.numero)]: {
        valorPrevisto: itemAtualizado.valorPrevisto,
        valorAtualizado: itemAtualizado.valorAtualizado,
      },
    },
  };

  const { error: erroCobranca } = await supabase
    .from("saidas")
    .update(resultado.atualizacao)
    .eq("id", parcela.cobranca.id);
  if (erroCobranca) throw erroCobranca;

  const { error: erroItem } = await supabase
    .from("renegociacoes_itens")
    .update({ payload: payloadAtualizado })
    .eq("id", itemPersistencia.id);

  if (erroItem) {
    await supabase
      .from("saidas")
      .update({
        valor_total: parcela.cobranca.valor_total,
        valor_parcela: parcela.cobranca.valor_parcela,
      })
      .eq("id", parcela.cobranca.id);
    throw erroItem;
  }

  return resultado;
}

export async function carregarItensRenegociacao(renegociacaoId) {
  const { data, error } = await supabase
    .from("renegociacoes_itens")
    .select("*")
    .eq("renegociacao_id", renegociacaoId)
    .order("id");

  if (error) throw error;
  return data || [];
}

export async function carregarContasComSaldo() {
  const { data: contasData, error } = await supabase
    .from("contas")
    .select("*")
    .eq("ativo", true)
    .order("nome");

  if (error) throw error;

  return Promise.all(
    (contasData || []).map(async (conta) => {
      const contaId = conta.id;

      const { data: entradas } = await supabase
        .from("entradas")
        .select(`
          entrada_plataformas (
            faturamento,
            valor_reembolso
          )
        `)
        .eq("conta_id", contaId);

      const totalEntradas = (entradas || []).reduce((total, entrada) => {
        const totalPlataformas = (entrada.entrada_plataformas || []).reduce(
          (soma, item) =>
            soma +
            Number(item.faturamento || 0) +
            Number(item.valor_reembolso || 0),
          0
        );

        return total + totalPlataformas;
      }, 0);

      const { data: entradasAvulsas } = await supabase
        .from("entradas_avulsas")
        .select("valor")
        .eq("conta_id", contaId);

      const totalEntradasAvulsas = (entradasAvulsas || []).reduce(
        (total, entrada) => total + Number(entrada.valor || 0),
        0
      );

      const { data: transferenciasRecebidas } = await supabase
        .from("transferencias")
        .select("valor")
        .eq("conta_destino_id", contaId);

      const totalTransferenciasRecebidas = (transferenciasRecebidas || []).reduce(
        (total, transferencia) => total + Number(transferencia.valor || 0),
        0
      );

      const { data: transferenciasEnviadas } = await supabase
        .from("transferencias")
        .select("valor")
        .eq("conta_origem_id", contaId);

      const totalTransferenciasEnviadas = (transferenciasEnviadas || []).reduce(
        (total, transferencia) => total + Number(transferencia.valor || 0),
        0
      );

      const { data: saidas } = await supabase
        .from("saidas")
        .select("valor_total, tipo_movimentacao")
        .eq("conta_id", contaId);

      const totalSaidas = (saidas || [])
        .filter((saida) => saida.tipo_movimentacao !== "conta_pagar")
        .reduce((total, saida) => total + Number(saida.valor_total || 0), 0);

      const saldoAtual =
        Number(conta.saldo_inicial || 0) +
        totalEntradas +
        totalEntradasAvulsas +
        totalTransferenciasRecebidas -
        totalSaidas -
        totalTransferenciasEnviadas;

      return {
        ...conta,
        tipo_conta: conta.tipo_conta || "banco",
        saldo_atual: saldoAtual,
      };
    })
  );
}

export async function carregarDividasDisponiveis() {
  const [contas, cartoesResposta, faturasResposta, contasPagarResposta] = await Promise.all([
    carregarContasComSaldo(),
    supabase
      .from("cartoes")
      .select("*")
      .order("nome"),
    supabase
      .from("faturas_cartao")
      .select(`
        *,
        cartoes (
          id,
          nome,
          final_cartao,
          tipo_cartao,
          limite_total
        )
      `)
      .in("status", ["aberta", "fechada", "parcial"])
      .order("data_vencimento", { ascending: true }),
    supabase
      .from("saidas")
      .select("*")
      .eq("tipo_movimentacao", "conta_pagar")
      .in("status", ["aberto", "pendente", "parcial"])
      .order("data_vencimento", { ascending: true }),
  ]);

  if (cartoesResposta.error) throw cartoesResposta.error;
  if (faturasResposta.error) throw faturasResposta.error;
  if (contasPagarResposta.error) throw contasPagarResposta.error;

  const faturas = (faturasResposta.data || [])
    .map((fatura) => {
      const valorAberto = calcularSaldoAbertoFatura(fatura);

      return {
        chave: `fatura-${fatura.id}`,
        tipo: "fatura",
        origem_id: fatura.id,
        titulo: fatura.cartoes?.nome || "Cartão",
        detalhe:
          fatura.cartoes?.tipo_cartao === "terceiro"
            ? "Cartão de terceiro"
            : fatura.cartoes?.final_cartao
            ? `Final ${fatura.cartoes.final_cartao}`
            : "Cartão de crédito",
        valor_aberto: valorAberto,
        data_referencia: fatura.data_vencimento,
        original: fatura,
      };
    })
    .filter((item) => item.valor_aberto > 0);

  const contasPagar = (contasPagarResposta.data || [])
    .map((conta) => {
      const valorAberto = Math.max(
        Number(conta.valor_total || 0) - Number(conta.valor_pago || 0),
        0
      );

      return {
        chave: `conta-${conta.id}`,
        tipo: "conta",
        origem_id: conta.id,
        titulo: conta.descricao || conta.categoria || "Conta a pagar",
        detalhe: conta.categoria || "Boleto/conta",
        valor_aberto: valorAberto,
        data_referencia: conta.data_vencimento,
        original: conta,
      };
    })
    .filter((item) => item.valor_aberto > 0);

  const contasNegativas = (contas || [])
    .filter((conta) => {
      const isTagPrePaga =
        conta.tipo_conta === "tag" && (conta.tipo_tag || "pre_paga") === "pre_paga";

      return !isTagPrePaga && Number(conta.saldo_atual || 0) < 0;
    })
    .map((conta) => ({
      chave: `conta-negativa-${conta.id}`,
      tipo: "conta_negativa",
      origem_id: conta.id,
      titulo: conta.nome || "Conta",
      detalhe: "Saldo negativo",
      valor_aberto: Math.abs(Number(conta.saldo_atual || 0)),
      data_referencia: null,
      original: conta,
    }));

  return {
    contas,
    cartoes: cartoesResposta.data || [],
    dividas: [...contasNegativas, ...faturas, ...contasPagar],
  };
}

export async function criarRenegociacao(payload) {
  const {
    credor,
    dataRenegociacao,
    formaPagamento,
    contaDebitoId,
    cartaoPagamentoId,
    contaAjusteId,
    saldoContaApos,
    valorOriginal,
    valorRenegociado,
    valorEntrada,
    numeroParcelas,
    primeiroVencimento,
    entradaIndependente = false,
    entradaVencimento,
    entradaFormaPagamento,
    entradaContaId,
    entradaCartaoId,
    itens,
  } = payload;

  const { data: renegociacao, error: erroRenegociacao } = await supabase
    .from("renegociacoes")
    .insert({
      credor,
      data_renegociacao: dataRenegociacao,
      forma_pagamento: formaPagamento,
      conta_debito_id: contaDebitoId ? Number(contaDebitoId) : null,
      conta_ajuste_id: contaAjusteId ? Number(contaAjusteId) : null,
      saldo_conta_apos: saldoContaApos,
      valor_original: valorOriginal,
      valor_renegociado: valorRenegociado,
      valor_entrada: valorEntrada,
      numero_parcelas: numeroParcelas,
      primeiro_vencimento: primeiroVencimento,
      observacoes: null,
      status: "ativa",
    })
    .select()
    .single();

  if (erroRenegociacao) throw erroRenegociacao;

  const itensParaInserir = itens.map((item) => ({
    renegociacao_id: renegociacao.id,
    tipo_origem: item.tipo,
    origem_id: item.origem_id,
    titulo: item.titulo,
    detalhe: item.detalhe,
    tipo_renegociacao: item.tipo_renegociacao,
    valor_original: Number(item.valor_aberto || 0),
    valor_renegociado: item.valor_considerado_banco === null || item.valor_considerado_banco === undefined
      ? null
      : Number(item.valor_considerado_banco),
    payload: {
      ...(item.original || {}),
      _acordo: {
        grupo: item.grupo_acordo || null,
        valor_considerado_banco: item.valor_considerado_banco,
        valor_total_acordo: item.valor_total_acordo,
        valor_parcela_acordo: item.valor_parcela_acordo,
        saldo_apos_acordo: item.saldo_apos_acordo,
        ajustar_limite: item.ajustar_limite,
        limite_anterior: item.limite_anterior,
        novo_limite_total: item.novo_limite_total,
        modelo_valores: entradaIndependente ? MODELO_ENTRADA_INDEPENDENTE : null,
      },
    },
  }));

  const { error: erroItens } = await supabase
    .from("renegociacoes_itens")
    .insert(itensParaInserir);

  if (erroItens) throw erroItens;

  await marcarDividasComoRenegociadas(itens, renegociacao.id);

  if (contaAjusteId && saldoContaApos !== null && saldoContaApos !== undefined) {
    await ajustarSaldoConta(contaAjusteId, saldoContaApos, dataRenegociacao, credor, renegociacao.id);
  }

  await criarParcelasRenegociacao({
    renegociacao,
    credor,
    valorRenegociado,
    valorEntrada,
    numeroParcelas,
    primeiroVencimento,
    formaPagamento,
    contaDebitoId,
    cartaoPagamentoId,
    entradaIndependente,
    entradaVencimento,
    entradaFormaPagamento,
    entradaContaId,
    entradaCartaoId,
    itens,
  });

  return renegociacao;
}

async function marcarDividasComoRenegociadas(itens, renegociacaoId) {
  for (const item of itens) {
    if (item.tipo === "fatura") {
      await supabase
        .from("faturas_cartao")
        .update({ status: "renegociada", renegociacao_id: renegociacaoId })
        .eq("id", item.origem_id);

      const cartao = item.original?.cartoes;
      const limiteInformado = item.novo_limite_total;

      if (item.ajustar_limite && cartao?.id && limiteInformado !== null && limiteInformado !== undefined) {
        await supabase
          .from("cartoes")
          .update({ limite_total: Number(limiteInformado || 0) })
          .eq("id", cartao.id);
      }
    }

    if (item.tipo === "conta") {
      await supabase
        .from("saidas")
        .update({ status: "renegociada", renegociacao_id: renegociacaoId })
        .eq("id", item.origem_id);
    }
  }
}

async function ajustarSaldoConta(contaId, saldoContaApos, dataRenegociacao, credor, renegociacaoId) {
  const contas = await carregarContasComSaldo();
  const conta = contas.find((item) => String(item.id) === String(contaId));
  if (!conta) return;

  const saldoAtual = Number(conta.saldo_atual || 0);
  const saldoDesejado = Number(saldoContaApos || 0);
  const diferenca = saldoDesejado - saldoAtual;

  if (Math.abs(diferenca) < 0.01) return;

  if (diferenca > 0) {
    await supabase.from("entradas_avulsas").insert({
      data: dataRenegociacao,
      conta_id: Number(contaId),
      valor: diferenca,
      descricao: `Ajuste de saldo após renegociação - ${credor}`,
      finalidade: "pessoal",
      renegociacao_id: renegociacaoId,
    });
  } else {
    await supabase.from("saidas").insert({
      data_compra: dataRenegociacao,
      data_efetivacao: dataRenegociacao,
      conta_id: Number(contaId),
      valor_total: Math.abs(diferenca),
      categoria: "Ajuste de saldo",
      descricao: `Ajuste de saldo após renegociação - ${credor}`,
      forma_pagamento: "debito_conta",
      tipo_movimentacao: "saida",
      status: "pago",
      finalidade: "pessoal",
      renegociacao_id: renegociacaoId,
    });
  }
}

async function criarParcelasRenegociacao({
  renegociacao,
  credor,
  valorRenegociado,
  valorEntrada,
  numeroParcelas,
  primeiroVencimento,
  formaPagamento,
  contaDebitoId,
  cartaoPagamentoId,
  entradaIndependente = false,
  entradaVencimento,
  entradaFormaPagamento,
  entradaContaId,
  entradaCartaoId,
  itens,
}) {
  const saldoParcelar = entradaIndependente
    ? Math.max(Number(valorRenegociado || 0), 0)
    : Math.max(Number(valorRenegociado || 0) - Number(valorEntrada || 0), 0);
  const parcelas = Math.max(Number(numeroParcelas || 1), 1);
  const valorParcela = parcelas > 0 ? saldoParcelar / parcelas : saldoParcelar;

  if (Number(valorEntrada || 0) > 0) {
    const entradaPendente = entradaIndependente;
    await supabase.from("saidas").insert({
      data_compra: renegociacao.data_renegociacao,
      data_efetivacao: entradaPendente ? null : renegociacao.data_renegociacao,
      data_vencimento: entradaVencimento || renegociacao.data_renegociacao,
      valor_total: Number(valorEntrada || 0),
      valor_pago: entradaPendente ? 0 : Number(valorEntrada || 0),
      categoria: "Renegociação",
      descricao: `Entrada da renegociação - ${credor}`,
      forma_pagamento: entradaFormaPagamento || formaPagamento,
      tipo_movimentacao: entradaPendente ? "conta_pagar" : "renegociacao_entrada",
      numero_parcelas: entradaPendente ? 0 : 1,
      status: entradaPendente ? "pendente" : "pago",
      conta_id: entradaContaId
        ? Number(entradaContaId)
        : contaDebitoId
          ? Number(contaDebitoId)
          : null,
      ...((entradaCartaoId || cartaoPagamentoId)
        ? { cartao_id: Number(entradaCartaoId || cartaoPagamentoId) }
        : {}),
      finalidade: "pessoal",
      renegociacao_id: renegociacao.id,
    });
  }

  if (saldoParcelar <= 0) return;

  const saidas = Array.from({ length: parcelas }).map((_, indice) => {
    const composicao = criarComposicaoParcelaRenegociacao({
      itens,
      numeroParcela: indice + 1,
      valorPrevisto: valorParcela,
      nomePadrao: credor,
    });
    const valorAtualizado = composicao.reduce(
      (total, item) => total + Number(item.valorAtualizado || 0),
      0
    );

    return {
      data_compra: renegociacao.data_renegociacao,
      data_vencimento: adicionarMeses(primeiroVencimento, indice),
      valor_total: valorAtualizado,
      valor_pago: 0,
      categoria: "Renegociação",
      descricao: `Renegociação ${credor} - parcela ${indice + 1}/${parcelas}`,
      forma_pagamento: formaPagamento,
      tipo_movimentacao: "conta_pagar",
      status: "pendente",
      conta_id: contaDebitoId ? Number(contaDebitoId) : null,
      ...(cartaoPagamentoId ? { cartao_id: Number(cartaoPagamentoId) } : {}),
      finalidade: "pessoal",
      numero_parcelas: parcelas,
      valor_parcela: valorAtualizado,
      renegociacao_id: renegociacao.id,
    };
  });

  const { error } = await supabase.from("saidas").insert(saidas);
  if (error) throw error;
}



export async function editarRenegociacao(renegociacaoId, payload) {
  const id = Number(renegociacaoId);
  if (!id) throw new Error("Renegociação inválida para edição.");

  const {
    credor,
    dataRenegociacao,
    formaPagamento,
    contaDebitoId,
    cartaoPagamentoId,
    valorRenegociado,
    valorEntrada,
    numeroParcelas,
    primeiroVencimento,
    entradaIndependente = false,
    entradaVencimento,
    entradaFormaPagamento,
    entradaContaId,
    entradaCartaoId,
  } = payload;

  const itens = await carregarItensRenegociacao(id);
  const saidasOriginaisIds = itens
    .filter((item) => item.tipo_origem === "conta" && item.origem_id)
    .map((item) => Number(item.origem_id));

  const { data: renegociacaoAtualizada, error: erroRenegociacao } = await supabase
    .from("renegociacoes")
    .update({
      data_renegociacao: dataRenegociacao,
      forma_pagamento: formaPagamento,
      conta_debito_id: contaDebitoId ? Number(contaDebitoId) : null,
      valor_renegociado: valorRenegociado,
      valor_entrada: valorEntrada,
      numero_parcelas: numeroParcelas,
      primeiro_vencimento: primeiroVencimento,
    })
    .eq("id", id)
    .select()
    .single();

  if (erroRenegociacao) throw erroRenegociacao;

  let querySaidasGeradas = supabase
    .from("saidas")
    .delete()
    .eq("renegociacao_id", id);

  if (saidasOriginaisIds.length > 0) {
    querySaidasGeradas = querySaidasGeradas.not("id", "in", `(${saidasOriginaisIds.join(",")})`);
  }

  const { error: erroSaidasGeradas } = await querySaidasGeradas;
  if (erroSaidasGeradas) throw erroSaidasGeradas;

  if (entradaIndependente) {
    for (const item of itens) {
      const payloadAtual = item.payload || {};
      const { error: erroModelo } = await supabase
        .from("renegociacoes_itens")
        .update({
          payload: {
            ...payloadAtual,
            _acordo: {
              ...(payloadAtual._acordo || {}),
              modelo_valores: MODELO_ENTRADA_INDEPENDENTE,
            },
          },
        })
        .eq("id", item.id);
      if (erroModelo) throw erroModelo;
    }
  }

  await criarParcelasRenegociacao({
    renegociacao: renegociacaoAtualizada,
    credor: credor || renegociacaoAtualizada.credor,
    valorRenegociado,
    valorEntrada,
    numeroParcelas,
    primeiroVencimento,
    formaPagamento,
    contaDebitoId,
    cartaoPagamentoId,
    entradaIndependente,
    entradaVencimento,
    entradaFormaPagamento,
    entradaContaId,
    entradaCartaoId,
    itens,
  });

  return renegociacaoAtualizada;
}

export async function excluirRenegociacao(renegociacaoId) {
  const id = Number(renegociacaoId);
  if (!id) throw new Error("Renegociação inválida para exclusão.");

  const { data: renegociacao, error: erroRenegociacao } = await supabase
    .from("renegociacoes")
    .select("*")
    .eq("id", id)
    .single();

  if (erroRenegociacao) throw erroRenegociacao;
  if (!renegociacao) throw new Error("Renegociação não encontrada.");

  const itens = await carregarItensRenegociacao(id);
  const saidasOriginaisIds = itens
    .filter((item) => item.tipo_origem === "conta" && item.origem_id)
    .map((item) => Number(item.origem_id));

  for (const item of itens) {
    const payload = item.payload || {};

    if (item.tipo_origem === "fatura" && item.origem_id) {
      const statusOriginal = payload.status || "aberta";

      const { error } = await supabase
        .from("faturas_cartao")
        .update({
          status: statusOriginal,
          renegociacao_id: null,
        })
        .eq("id", item.origem_id)
        .eq("renegociacao_id", id);

      if (error) throw error;

      const cartaoOriginal = payload.cartoes;
      if (cartaoOriginal?.id && cartaoOriginal.limite_total !== undefined && cartaoOriginal.limite_total !== null) {
        const { error: erroCartao } = await supabase
          .from("cartoes")
          .update({ limite_total: Number(cartaoOriginal.limite_total || 0) })
          .eq("id", cartaoOriginal.id);

        if (erroCartao) throw erroCartao;
      }
    }

    if (item.tipo_origem === "conta" && item.origem_id) {
      const statusOriginal = payload.status || "pendente";

      const { error } = await supabase
        .from("saidas")
        .update({
          status: statusOriginal,
          renegociacao_id: null,
        })
        .eq("id", item.origem_id)
        .eq("renegociacao_id", id);

      if (error) throw error;
    }
  }

  let querySaidasGeradas = supabase
    .from("saidas")
    .delete()
    .eq("renegociacao_id", id);

  if (saidasOriginaisIds.length > 0) {
    querySaidasGeradas = querySaidasGeradas.not("id", "in", `(${saidasOriginaisIds.join(",")})`);
  }

  const { error: erroSaidasGeradas } = await querySaidasGeradas;
  if (erroSaidasGeradas) throw erroSaidasGeradas;

  const { error: erroEntradasAjuste } = await supabase
    .from("entradas_avulsas")
    .delete()
    .eq("renegociacao_id", id);

  if (erroEntradasAjuste) throw erroEntradasAjuste;

  const { error: erroItens } = await supabase
    .from("renegociacoes_itens")
    .delete()
    .eq("renegociacao_id", id);

  if (erroItens) throw erroItens;

  const { error: erroExcluir } = await supabase
    .from("renegociacoes")
    .delete()
    .eq("id", id);

  if (erroExcluir) throw erroExcluir;

  return true;
}
