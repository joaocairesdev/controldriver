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
  const { data: saida, error: erroSaida } = await supabase
    .from("saidas")
    .insert({
      data_compra: dataVencimento,
      forma_pagamento: formaPagamento,
      conta_id: credito ? null : contaId,
      cartao_id: credito ? cartaoId : null,
      tipo_credito: credito ? "avista" : null,
      numero_parcelas: 1,
      valor_total: valor,
      valor_parcela: valor,
      categoria,
      categoria_id: categoriaId,
      descricao,
      status: "aberto",
      tipo_movimentacao: "conta_pagar",
      data_vencimento: dataVencimento,
      finalidade,
      veiculo_id: veiculoId,
      contrato_financeiro_id: contratoId,
      contrato_financeiro_parcela_id: parcelaId,
    })
    .select()
    .single();
  if (erroSaida) throw erroSaida;

  const { error: erroVinculo } = await supabase
    .from("contratos_financeiros_parcelas")
    .update({ saida_id: saida.id })
    .eq("id", parcelaId);
  if (erroVinculo) throw erroVinculo;
  return saida;
}
