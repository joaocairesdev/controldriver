import {
  gerarParcelasEFaturasPadrao,
  recalcularFaturaPorParcelas,
  removerParcelasDaSaidaERecalcularFaturas,
} from "../../cartoes/utils/cartoesUtils";
import {
  adicionarFrequencia,
  gerarParcelasFinanciamento,
  gerarVencimentosAluguel,
  chaveCobranca,
} from "../utils/veiculosFinanceiro";

const FORMAS_CREDITO = new Set(["credito_avista", "credito_parcelado"]);

function origemPagamento(formaPagamento, contaId, cartaoId) {
  const credito = FORMAS_CREDITO.has(formaPagamento);
  return {
    credito,
    conta_id: credito ? null : Number(contaId) || null,
    cartao_id: credito ? Number(cartaoId) || null : null,
  };
}

async function criarSaidaContrato(supabase, {
  veiculoId,
  financiamentoId = null,
  aluguelId = null,
  caucaoId = null,
  referencia = null,
  vencimento,
  valor,
  formaPagamento,
  contaId,
  cartaoId,
  cartoes,
  categoria,
  descricao,
  finalidade = "trabalho",
  pago = false,
}) {
  const origem = origemPagamento(formaPagamento, contaId, cartaoId);
  const payload = {
    data_compra: vencimento,
    forma_pagamento: formaPagamento || "desconto_plataforma",
    tipo_movimentacao: origem.credito || pago ? "saida" : "conta_pagar",
    conta_id: origem.conta_id,
    cartao_id: origem.cartao_id,
    tipo_credito: origem.credito ? "avista" : null,
    numero_parcelas: 1,
    valor_total: Number(valor),
    valor_parcela: Number(valor),
    data_efetivacao: !origem.credito && pago ? vencimento : null,
    data_vencimento: vencimento,
    categoria,
    finalidade,
    descricao,
    status: origem.credito ? "fatura" : pago ? "pago" : "aberto",
    veiculo_id: Number(veiculoId),
    financiamento_id: financiamentoId,
    aluguel_id: aluguelId,
    caucao_id: caucaoId,
    referencia_contrato: referencia,
  };

  const { data: saida, error } = await supabase.from("saidas").insert(payload).select().single();
  if (error) throw error;

  if (origem.credito) {
    const cartao = cartoes.find((item) => String(item.id) === String(origem.cartao_id));
    if (!cartao) throw new Error("Cartão do contrato não encontrado.");
    await gerarParcelasEFaturasPadrao(supabase, {
      saidaId: saida.id,
      cartao,
      cartaoId: cartao.id,
      dataBase: vencimento,
      quantidadeParcelas: 1,
      valorParcela: Number(valor),
    });
  }

  return saida;
}

async function buscarCobrancasGeradas(supabase, filtros) {
  let consulta = supabase.from("veiculos_cobrancas_geradas").select("*");
  for (const [campo, valor] of Object.entries(filtros)) consulta = consulta.eq(campo, valor);
  const { data, error } = await consulta;
  if (error) throw error;
  return data || [];
}

async function registrarCobrancaGerada(supabase, payload) {
  const { error } = await supabase.from("veiculos_cobrancas_geradas").insert(payload);
  if (error) throw error;
}

async function buscarSaidaOrfa(supabase, filtros) {
  let consulta = supabase.from("saidas").select("id");
  for (const [campo, valor] of Object.entries(filtros)) consulta = consulta.eq(campo, valor);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw error;
  return data || null;
}

function saidaProtegida(saida) {
  return ["pago", "parcial", "cancelado", "excluido"].includes(String(saida?.status || "").toLowerCase())
    || Number(saida?.valor_pago || 0) > 0;
}

async function cancelarCobrancasFuturasObsoletas(supabase, registradas, chavesEsperadas, montarChave) {
  const hoje = new Date().toISOString().split("T")[0];
  for (const registro of registradas) {
    if (chavesEsperadas.has(montarChave(registro)) || !registro.saida_id || registro.data_vencimento < hoje) continue;
    const { data: saida, error } = await supabase.from("saidas").select("*").eq("id", registro.saida_id).maybeSingle();
    if (error) throw error;
    if (!saida || saidaProtegida(saida)) continue;
    if (saida.cartao_id) await removerParcelasDaSaidaERecalcularFaturas(supabase, saida.id);
    const { error: erroCancelamento } = await supabase.from("saidas").update({ status: "cancelado" }).eq("id", saida.id);
    if (erroCancelamento) throw erroCancelamento;
  }
}

async function atualizarCobrancaFuturaExistente(supabase, registro, { valor, descricao }) {
  if (!registro?.saida_id) return;
  const hoje = new Date().toISOString().split("T")[0];
  if (registro.data_vencimento < hoje) return;
  const { data: saida, error } = await supabase.from("saidas").select("*").eq("id", registro.saida_id).maybeSingle();
  if (error) throw error;
  if (!saida || saidaProtegida(saida)) return;

  const novoValor = Number(valor);
  const { error: erroSaida } = await supabase.from("saidas").update({
    valor_total: novoValor,
    valor_parcela: novoValor,
    descricao,
  }).eq("id", saida.id);
  if (erroSaida) throw erroSaida;

  if (saida.cartao_id) {
    const { data: parcelas, error: erroParcelas } = await supabase.from("saidas_parcelas").select("id, fatura_id").eq("saida_id", saida.id);
    if (erroParcelas) throw erroParcelas;
    const { error: erroAtualizacao } = await supabase.from("saidas_parcelas").update({ valor_parcela: novoValor }).eq("saida_id", saida.id);
    if (erroAtualizacao) throw erroAtualizacao;
    for (const faturaId of new Set((parcelas || []).map((item) => item.fatura_id).filter(Boolean))) {
      await recalcularFaturaPorParcelas(supabase, faturaId);
    }
  }
}

async function reconciliarCobrancasAluguel(supabase, contrato, cartoes) {
  const registradas = await buscarCobrancasGeradas(supabase, { aluguel_id: contrato.id });
  const vencimentos = gerarVencimentosAluguel({
    proximoVencimento: contrato.proximo_vencimento,
    frequencia: contrato.frequencia,
    dataFim: contrato.data_fim,
  });
  const chavesEsperadas = new Set(vencimentos.map((item) => chaveCobranca({ aluguelId: contrato.id, dataVencimento: item })));
  await cancelarCobrancasFuturasObsoletas(
    supabase,
    registradas,
    chavesEsperadas,
    (item) => chaveCobranca({ aluguelId: contrato.id, dataVencimento: item.data_vencimento })
  );
  const porChave = new Map(registradas.map((item) => [chaveCobranca({ aluguelId: contrato.id, dataVencimento: item.data_vencimento }), item]));

  for (const vencimento of vencimentos) {
    const chave = chaveCobranca({ aluguelId: contrato.id, dataVencimento: vencimento });
    if (porChave.has(chave)) {
      await atualizarCobrancaFuturaExistente(supabase, porChave.get(chave), {
        valor: contrato.valor,
        descricao: `Aluguel do veículo - ${contrato.locador}`,
      });
      continue;
    }
    const saidaOrfa = await buscarSaidaOrfa(supabase, { aluguel_id: contrato.id, data_vencimento: vencimento });
    if (saidaOrfa) {
      await registrarCobrancaGerada(supabase, {
        veiculo_id: Number(contrato.veiculo_id), aluguel_id: contrato.id, saida_id: saidaOrfa.id, data_vencimento: vencimento,
      });
      continue;
    }
    const saida = await criarSaidaContrato(supabase, {
      veiculoId: contrato.veiculo_id,
      aluguelId: contrato.id,
      vencimento,
      valor: contrato.valor,
      formaPagamento: contrato.desconto_plataforma ? null : contrato.forma_pagamento,
      contaId: contrato.conta_id,
      cartaoId: contrato.cartao_id,
      cartoes,
      categoria: "Aluguel de veículo",
      descricao: `Aluguel do veículo - ${contrato.locador}`,
    });
    await registrarCobrancaGerada(supabase, {
      veiculo_id: Number(contrato.veiculo_id), aluguel_id: contrato.id, saida_id: saida.id, data_vencimento: vencimento,
    });
  }
}

async function avancarAluguelPago(supabase, contrato) {
  let proximo = contrato.proximo_vencimento;

  for (let tentativas = 0; tentativas < 400; tentativas += 1) {
    const { data: registro, error: erroRegistro } = await supabase
      .from("veiculos_cobrancas_geradas")
      .select("saida_id")
      .eq("aluguel_id", contrato.id)
      .eq("data_vencimento", proximo)
      .maybeSingle();
    if (erroRegistro) throw erroRegistro;
    if (!registro?.saida_id) break;

    const { data: saida, error: erroSaida } = await supabase.from("saidas").select("id, cartao_id, status, valor_pago, valor_total").eq("id", registro.saida_id).maybeSingle();
    if (erroSaida) throw erroSaida;
    if (!saida) break;

    let paga = String(saida.status || "").toLowerCase() === "pago" || Number(saida.valor_pago || 0) >= Number(saida.valor_total || 0);
    if (saida.cartao_id) {
      const { data: parcelas, error: erroParcelas } = await supabase.from("saidas_parcelas").select("fatura_id, status").eq("saida_id", saida.id);
      if (erroParcelas) throw erroParcelas;
      const idsFaturas = [...new Set((parcelas || []).map((item) => item.fatura_id).filter(Boolean))];
      const { data: faturas, error: erroFaturas } = idsFaturas.length
        ? await supabase.from("faturas_cartao").select("id, status, valor_total, valor_pago").in("id", idsFaturas)
        : { data: [], error: null };
      if (erroFaturas) throw erroFaturas;
      paga = idsFaturas.length > 0 && (faturas || []).every((fatura) =>
        String(fatura.status || "").toLowerCase() === "paga" || Number(fatura.valor_pago || 0) >= Number(fatura.valor_total || 0)
      );
    }
    if (!paga) break;
    proximo = adicionarFrequencia(proximo, contrato.frequencia);
  }

  if (proximo !== contrato.proximo_vencimento) {
    const { data, error } = await supabase.from("veiculos_alugueis").update({ proximo_vencimento: proximo, updated_at: new Date().toISOString() }).eq("id", contrato.id).select().single();
    if (error) throw error;
    return data;
  }
  return contrato;
}

export async function salvarFinanciamentoVeiculo(supabase, {
  veiculoId,
  financiamento,
  cartoes,
}) {
  const payload = {
    veiculo_id: Number(veiculoId),
    instituicao_financeira: financiamento.instituicaoFinanceira.trim(),
    valor_veiculo: Number(financiamento.valorVeiculo),
    valor_financiado: Number(financiamento.valorFinanciado),
    valor_entrada: Number(financiamento.entrada || 0),
    total_parcelas: Number(financiamento.totalParcelas),
    parcelas_pagas: Number(financiamento.parcelasPagas || 0),
    numero_proxima_parcela: Number(financiamento.parcelasPagas || 0) < Number(financiamento.totalParcelas)
      ? Number(financiamento.numeroProximaParcela)
      : null,
    valor_parcela: Number(financiamento.valorParcela),
    proximo_vencimento: Number(financiamento.parcelasPagas || 0) < Number(financiamento.totalParcelas)
      ? financiamento.proximoVencimento
      : null,
    dia_vencimento: Number(financiamento.diaVencimento),
    observacoes: financiamento.observacoes.trim() || null,
    forma_pagamento: financiamento.formaPagamento,
    conta_id: FORMAS_CREDITO.has(financiamento.formaPagamento) ? null : Number(financiamento.contaId),
    cartao_id: FORMAS_CREDITO.has(financiamento.formaPagamento) ? Number(financiamento.cartaoId) : null,
    ativo: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existente, error: erroBusca } = await supabase
    .from("veiculos_financiamentos")
    .select("*")
    .eq("veiculo_id", veiculoId)
    .eq("ativo", true)
    .maybeSingle();
  if (erroBusca) throw erroBusca;

  const resposta = existente
    ? await supabase.from("veiculos_financiamentos").update(payload).eq("id", existente.id).select().single()
    : await supabase.from("veiculos_financiamentos").insert(payload).select().single();
  if (resposta.error) throw resposta.error;
  const contrato = resposta.data;

  const registradas = await buscarCobrancasGeradas(supabase, { financiamento_id: contrato.id });
  const parcelas = gerarParcelasFinanciamento({
    totalParcelas: contrato.total_parcelas,
    parcelasPagas: contrato.parcelas_pagas,
    numeroProximaParcela: contrato.numero_proxima_parcela,
    proximoVencimento: contrato.proximo_vencimento,
  });
  const chavesEsperadas = new Set(parcelas.map((item) => chaveCobranca({ financiamentoId: contrato.id, referencia: item.numero })));
  await cancelarCobrancasFuturasObsoletas(
    supabase,
    registradas,
    chavesEsperadas,
    (item) => chaveCobranca({ financiamentoId: contrato.id, referencia: item.referencia })
  );
  const porChave = new Map(registradas.map((item) => [chaveCobranca({ financiamentoId: contrato.id, referencia: item.referencia }), item]));

  for (const parcela of parcelas) {
    const chave = chaveCobranca({ financiamentoId: contrato.id, referencia: parcela.numero });
    if (porChave.has(chave)) {
      await atualizarCobrancaFuturaExistente(supabase, porChave.get(chave), {
        valor: contrato.valor_parcela,
        descricao: `Financiamento - ${contrato.instituicao_financeira} (${parcela.numero}/${contrato.total_parcelas})`,
      });
      continue;
    }
    const saidaOrfa = await buscarSaidaOrfa(supabase, { financiamento_id: contrato.id, referencia_contrato: parcela.numero });
    if (saidaOrfa) {
      await registrarCobrancaGerada(supabase, {
        veiculo_id: Number(veiculoId), financiamento_id: contrato.id, saida_id: saidaOrfa.id,
        referencia: parcela.numero, data_vencimento: parcela.vencimento,
      });
      continue;
    }
    const saida = await criarSaidaContrato(supabase, {
      veiculoId,
      financiamentoId: contrato.id,
      referencia: parcela.numero,
      vencimento: parcela.vencimento,
      valor: contrato.valor_parcela,
      formaPagamento: contrato.forma_pagamento,
      contaId: contrato.conta_id,
      cartaoId: contrato.cartao_id,
      cartoes,
      categoria: "Financiamento de veículo",
      descricao: `Financiamento - ${contrato.instituicao_financeira} (${parcela.numero}/${contrato.total_parcelas})`,
    });
    await registrarCobrancaGerada(supabase, {
      veiculo_id: Number(veiculoId),
      financiamento_id: contrato.id,
      saida_id: saida.id,
      referencia: parcela.numero,
      data_vencimento: parcela.vencimento,
    });
  }

  return contrato;
}

export async function salvarAluguelVeiculo(supabase, {
  veiculoId,
  aluguel,
  caucao,
  cartoes,
}) {
  const payload = {
    veiculo_id: Number(veiculoId),
    locador: aluguel.locador.trim(),
    frequencia: aluguel.frequencia,
    valor: Number(aluguel.valor),
    data_inicio: aluguel.dataInicio,
    proximo_vencimento: aluguel.proximoVencimento,
    dia_cobranca: Number(aluguel.diaCobranca),
    data_fim: aluguel.dataFim || null,
    observacoes: aluguel.observacoes.trim() || null,
    forma_pagamento: aluguel.descontoPlataforma ? null : aluguel.formaPagamento,
    conta_id: aluguel.descontoPlataforma || FORMAS_CREDITO.has(aluguel.formaPagamento) ? null : Number(aluguel.contaId),
    cartao_id: !aluguel.descontoPlataforma && FORMAS_CREDITO.has(aluguel.formaPagamento) ? Number(aluguel.cartaoId) : null,
    desconto_plataforma: Boolean(aluguel.descontoPlataforma),
    plataforma_id: aluguel.descontoPlataforma ? Number(aluguel.plataformaId) : null,
    ativo: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existente, error: erroBusca } = await supabase
    .from("veiculos_alugueis")
    .select("*")
    .eq("veiculo_id", veiculoId)
    .eq("ativo", true)
    .maybeSingle();
  if (erroBusca) throw erroBusca;
  const resposta = existente
    ? await supabase.from("veiculos_alugueis").update(payload).eq("id", existente.id).select().single()
    : await supabase.from("veiculos_alugueis").insert(payload).select().single();
  if (resposta.error) throw resposta.error;
  const contrato = resposta.data;

  await reconciliarCobrancasAluguel(supabase, contrato, cartoes);

  if (!caucao?.houve) {
    const { error } = await supabase.from("veiculos_caucoes").update({ ativo: false, updated_at: new Date().toISOString() }).eq("aluguel_id", contrato.id).eq("ativo", true);
    if (error) throw error;
    return { contrato, caucao: null };
  }

  const payloadCaucao = {
    veiculo_id: Number(veiculoId),
    aluguel_id: contrato.id,
    valor: Number(caucao.valor),
    data_pagamento: caucao.data,
    forma_pagamento: caucao.formaPagamento,
    conta_id: FORMAS_CREDITO.has(caucao.formaPagamento) ? null : Number(caucao.contaId),
    cartao_id: FORMAS_CREDITO.has(caucao.formaPagamento) ? Number(caucao.cartaoId) : null,
    devolvivel: Boolean(caucao.devolvivel),
    previsao_devolucao: caucao.devolvivel && caucao.previsaoDevolucao ? caucao.previsaoDevolucao : null,
    observacoes: caucao.observacoes.trim() || null,
    ativo: true,
    updated_at: new Date().toISOString(),
  };
  const { data: caucaoExistente, error: erroCaucaoBusca } = await supabase
    .from("veiculos_caucoes")
    .select("*")
    .eq("aluguel_id", contrato.id)
    .eq("ativo", true)
    .maybeSingle();
  if (erroCaucaoBusca) throw erroCaucaoBusca;
  const respostaCaucao = caucaoExistente
    ? await supabase.from("veiculos_caucoes").update(payloadCaucao).eq("id", caucaoExistente.id).select().single()
    : await supabase.from("veiculos_caucoes").insert(payloadCaucao).select().single();
  if (respostaCaucao.error) throw respostaCaucao.error;
  const registroCaucao = respostaCaucao.data;

  const cobrancasCaucao = await buscarCobrancasGeradas(supabase, { caucao_id: registroCaucao.id });
  if (!cobrancasCaucao.length) {
    const saidaOrfa = await buscarSaidaOrfa(supabase, { caucao_id: registroCaucao.id });
    if (saidaOrfa) {
      await registrarCobrancaGerada(supabase, {
        veiculo_id: Number(veiculoId), caucao_id: registroCaucao.id, saida_id: saidaOrfa.id,
        data_vencimento: registroCaucao.data_pagamento,
      });
      return { contrato, caucao: registroCaucao };
    }
    const saida = await criarSaidaContrato(supabase, {
      veiculoId,
      caucaoId: registroCaucao.id,
      vencimento: registroCaucao.data_pagamento,
      valor: registroCaucao.valor,
      formaPagamento: registroCaucao.forma_pagamento,
      contaId: registroCaucao.conta_id,
      cartaoId: registroCaucao.cartao_id,
      cartoes,
      categoria: registroCaucao.devolvivel ? "Caução devolvível" : "Caução não devolvível",
      descricao: `Caução do aluguel - ${contrato.locador}`,
      finalidade: registroCaucao.devolvivel ? "caucao_devolvivel" : "trabalho",
      pago: true,
    });
    await registrarCobrancaGerada(supabase, {
      veiculo_id: Number(veiculoId),
      caucao_id: registroCaucao.id,
      saida_id: saida.id,
      data_vencimento: registroCaucao.data_pagamento,
    });
  }

  return { contrato, caucao: registroCaucao };
}

export async function desativarContratoIncompativel(supabase, veiculoId, tipoPosse, situacaoAquisicao) {
  if (!(tipoPosse === "proprio" && situacaoAquisicao === "financiado")) {
    const { data: contratos, error: erroContratos } = await supabase.from("veiculos_financiamentos").select("id").eq("veiculo_id", veiculoId).eq("ativo", true);
    if (erroContratos) throw erroContratos;
    for (const contrato of contratos || []) {
      const registradas = await buscarCobrancasGeradas(supabase, { financiamento_id: contrato.id });
      await cancelarCobrancasFuturasObsoletas(supabase, registradas, new Set(), (item) => chaveCobranca({ financiamentoId: contrato.id, referencia: item.referencia }));
    }
    const { error } = await supabase.from("veiculos_financiamentos").update({ ativo: false, updated_at: new Date().toISOString() }).eq("veiculo_id", veiculoId).eq("ativo", true);
    if (error) throw error;
  }
  if (tipoPosse !== "alugado") {
    const { data: contratos, error: erroContratos } = await supabase.from("veiculos_alugueis").select("id").eq("veiculo_id", veiculoId).eq("ativo", true);
    if (erroContratos) throw erroContratos;
    for (const contrato of contratos || []) {
      const registradas = await buscarCobrancasGeradas(supabase, { aluguel_id: contrato.id });
      await cancelarCobrancasFuturasObsoletas(supabase, registradas, new Set(), (item) => chaveCobranca({ aluguelId: contrato.id, dataVencimento: item.data_vencimento }));
    }
    const { error } = await supabase.from("veiculos_alugueis").update({ ativo: false, updated_at: new Date().toISOString() }).eq("veiculo_id", veiculoId).eq("ativo", true);
    if (error) throw error;
  }
}

export async function completarHorizontesAlugueis(supabase, cartoes) {
  const { data: contratos, error } = await supabase.from("veiculos_alugueis").select("*").eq("ativo", true);
  if (error) throw error;
  for (const contrato of contratos || []) {
    const atualizado = await avancarAluguelPago(supabase, contrato);
    await reconciliarCobrancasAluguel(supabase, atualizado, cartoes);
  }
}
