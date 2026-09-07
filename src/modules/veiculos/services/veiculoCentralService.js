export async function salvarDocumentoVeiculo(supabase, veiculoId, documento) {
  const payload = {
    veiculo_id: Number(veiculoId),
    tipo: documento.tipo,
    ano: Number(documento.ano),
    valor: Number(documento.valor || 0),
    status: documento.status,
    data_pagamento: documento.status === "pago" ? documento.dataPagamento : null,
    updated_at: new Date().toISOString(),
  };

  const resposta = documento.id
    ? await supabase.from("veiculos_documentos").update(payload).eq("id", documento.id).eq("veiculo_id", veiculoId).select().single()
    : await supabase.from("veiculos_documentos").insert(payload).select().single();
  if (resposta.error) throw resposta.error;
  return resposta.data;
}

export async function salvarAquisicaoVeiculo(supabase, veiculoId, aquisicao) {
  const payload = {
    veiculo_id: Number(veiculoId),
    valor_pago: aquisicao.valorPago === "" ? null : Number(aquisicao.valorPago),
    forma_aquisicao: aquisicao.formaAquisicao.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existente, error: erroBusca } = await supabase
    .from("veiculos_aquisicoes")
    .select("id")
    .eq("veiculo_id", veiculoId)
    .maybeSingle();
  if (erroBusca) throw erroBusca;

  const resposta = existente
    ? await supabase.from("veiculos_aquisicoes").update(payload).eq("id", existente.id).select().single()
    : await supabase.from("veiculos_aquisicoes").insert(payload).select().single();
  if (resposta.error) throw resposta.error;
  const { error: erroVeiculo } = await supabase
    .from("veiculos")
    .update({ situacao_aquisicao: aquisicao.situacaoPatrimonial || null })
    .eq("id", veiculoId);
  if (erroVeiculo) throw erroVeiculo;
  return resposta.data;
}
