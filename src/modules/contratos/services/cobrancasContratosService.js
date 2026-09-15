import {
  gerarParcelasEFaturasPadrao,
  recalcularFaturaPorParcelas,
} from "../../cartoes/utils/cartoesUtils.js";

async function buscarSaidaCanonica(supabase, parcelaId) {
  const { data, error } = await supabase
    .from("saidas")
    .select("*")
    .eq("contrato_financeiro_parcela_id", parcelaId)
    .is("conta_pagar_origem_id", null)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function vincularSaidaNaParcela(supabase, parcelaId, saidaId) {
  const { error } = await supabase
    .from("contratos_financeiros_parcelas")
    .update({ saida_id: saidaId })
    .eq("id", parcelaId);
  if (error) throw error;
}

async function repararCartaoDaCobranca(supabase, saida, cartaoPrevisto = null) {
  const credito = ["credito_avista", "credito_parcelado"].includes(saida.forma_pagamento);
  if (!credito || !saida.cartao_id) return;

  let cartao = cartaoPrevisto;
  if (!cartao || Number(cartao.id) !== Number(saida.cartao_id)) {
    const { data, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("id", Number(saida.cartao_id))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Cartão da cobrança contratual não encontrado.");
    cartao = data;
  }

  const buscarParcelas = () => supabase
    .from("saidas_parcelas")
    .select("id, fatura_id")
    .eq("saida_id", Number(saida.id));
  let { data: parcelas, error: erroParcelas } = await buscarParcelas();
  if (erroParcelas) throw erroParcelas;

  if (!parcelas?.length) {
    try {
      await gerarParcelasEFaturasPadrao(supabase, {
        saidaId: saida.id,
        cartao,
        cartaoId: cartao.id,
        dataBase: saida.data_compra,
        quantidadeParcelas: 1,
        valorParcela: Number(saida.valor_total),
      });
    } catch (error) {
      if (error?.code !== "23505") throw error;
    }
    ({ data: parcelas, error: erroParcelas } = await buscarParcelas());
    if (erroParcelas) throw erroParcelas;
    if (!parcelas?.length) throw new Error("Não foi possível materializar a parcela na fatura.");
  }

  const faturaIds = [...new Set(parcelas.map((parcela) => parcela.fatura_id).filter(Boolean))];
  for (const faturaId of faturaIds) {
    await recalcularFaturaPorParcelas(supabase, faturaId);
  }
}

export async function criarCobrancaContrato(supabase, {
  contratoId,
  parcelaId,
  dataVencimento,
  valor,
  formaPagamento,
  contaId = null,
  cartaoId = null,
  categoria,
  categoriaId = null,
  descricao,
  finalidade = null,
  veiculoId = null,
}) {
  const credito = ["credito_avista", "credito_parcelado"].includes(formaPagamento);
  let saida = await buscarSaidaCanonica(supabase, parcelaId);
  let cartao = null;

  if (!saida && credito) {
    const { data, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("id", Number(cartaoId))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Cartão do contrato não encontrado.");
    cartao = data;
  }

  if (!saida) {
    const { data, error: erroSaida } = await supabase
      .from("saidas")
      .insert({
        data_compra: dataVencimento,
        forma_pagamento: formaPagamento,
        conta_id: credito ? null : contaId,
        cartao_id: credito ? Number(cartaoId) : null,
        tipo_credito: credito ? "avista" : null,
        numero_parcelas: 1,
        valor_total: valor,
        valor_parcela: valor,
        categoria,
        categoria_id: categoriaId,
        descricao,
        status: credito ? "fatura" : "aberto",
        tipo_movimentacao: credito ? "saida" : "conta_pagar",
        data_vencimento: dataVencimento,
        finalidade,
        veiculo_id: veiculoId,
        contrato_financeiro_id: contratoId,
        contrato_financeiro_parcela_id: parcelaId,
      })
      .select()
      .single();
    if (erroSaida?.code === "23505") {
      saida = await buscarSaidaCanonica(supabase, parcelaId);
    } else if (erroSaida) {
      throw erroSaida;
    } else {
      saida = data;
    }
    if (!saida) throw new Error("Não foi possível localizar a cobrança contratual materializada.");
  }

  await vincularSaidaNaParcela(supabase, parcelaId, saida.id);
  await repararCartaoDaCobranca(supabase, saida, cartao);
  return saida;
}
