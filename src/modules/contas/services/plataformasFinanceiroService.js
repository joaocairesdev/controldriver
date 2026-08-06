import { supabase } from "../../../services/supabase";
import { hojeBrasil } from "../../../shared/utils/data";
import {
  calcularSaldosPlataformas,
  montarMovimentacoesPlataforma,
  obterProximoRecebimentoAutomatico,
} from "../utils/plataformasFinanceiro";

export async function processarRecebimentosAutomaticos(dataReferencia = hojeBrasil()) {
  const { data, error } = await supabase.rpc("processar_recebimentos_automaticos", {
    p_data_referencia: dataReferencia,
  });

  if (error) throw error;
  return Number(data || 0);
}

export async function carregarPlataformasFinanceiras() {
  await processarRecebimentosAutomaticos();

  const [plataformasRes, ganhosRes, transferenciasRes] = await Promise.all([
    supabase.from("plataformas").select("*").order("nome"),
    supabase.from("entrada_plataformas").select(`
      plataforma_id,
      faturamento,
      valor_reembolso,
      destino_financeiro
    `),
    supabase
      .from("transferencias")
      .select("id, plataforma_id, valor, valor_bruto, tipo")
      .in("tipo", ["saque_plataforma", "recebimento_automatico_plataforma"]),
  ]);

  if (plataformasRes.error) throw plataformasRes.error;
  if (ganhosRes.error) throw ganhosRes.error;
  if (transferenciasRes.error) throw transferenciasRes.error;

  const transferencias = transferenciasRes.data || [];
  const idsSaques = transferencias
    .filter((item) => item.tipo === "saque_plataforma")
    .map((item) => item.id);
  let taxasPorSaque = {};

  if (idsSaques.length > 0) {
    const { data: taxas, error } = await supabase
      .from("saidas")
      .select("saque_transferencia_id, valor_total")
      .in("saque_transferencia_id", idsSaques);

    if (error) throw error;
    taxasPorSaque = Object.fromEntries(
      (taxas || []).map((taxa) => [
        String(taxa.saque_transferencia_id),
        Number(taxa.valor_total || 0),
      ]),
    );
  }

  return calcularSaldosPlataformas(
    plataformasRes.data || [],
    ganhosRes.data || [],
    transferencias.map((transferencia) => ({
      ...transferencia,
      taxa: taxasPorSaque[String(transferencia.id)] || 0,
    })),
  );
}

export async function carregarContasDestinoSaque() {
  const { data, error } = await supabase
    .from("contas")
    .select("id, nome, tipo_conta")
    .eq("ativo", true)
    .eq("tipo_conta", "banco")
    .order("nome");

  if (error) throw error;
  return data || [];
}

export async function carregarExtratoPlataforma(plataformaId) {
  await processarRecebimentosAutomaticos();

  const [plataformaRes, ganhosRes, transferenciasRes, contasRes] = await Promise.all([
    supabase.from("plataformas").select("*").eq("id", plataformaId).single(),
    supabase
      .from("entrada_plataformas")
      .select(`
        id,
        entrada_id,
        plataforma_id,
        faturamento,
        valor_reembolso,
        numero_corridas,
        houve_pedagio,
        destino_financeiro,
        conta_destino_id,
        ciclo_operacional_inicio,
        ciclo_operacional_fim,
        created_at,
        entradas!inner ( id, data, created_at )
      `)
      .eq("plataforma_id", plataformaId),
    supabase
      .from("transferencias")
      .select(`
        id,
        data,
        created_at,
        conta_destino_id,
        valor,
        valor_bruto,
        descricao,
        tipo,
        tipo_saque,
        plataforma_id,
        entrada_plataforma_id,
        ciclo_operacional_inicio,
        ciclo_operacional_fim
      `)
      .eq("plataforma_id", plataformaId),
    supabase.from("contas").select("id, nome"),
  ]);

  if (plataformaRes.error) throw plataformaRes.error;
  if (ganhosRes.error) throw ganhosRes.error;
  if (transferenciasRes.error) throw transferenciasRes.error;
  if (contasRes.error) throw contasRes.error;

  const transferencias = transferenciasRes.data || [];
  const idsSaques = transferencias
    .filter((item) => item.tipo === "saque_plataforma")
    .map((item) => item.id);
  let taxas = [];

  if (idsSaques.length > 0) {
    const { data, error } = await supabase
      .from("saidas")
      .select(`
        id,
        data_compra,
        data_efetivacao,
        created_at,
        valor_total,
        descricao,
        saque_transferencia_id
      `)
      .in("saque_transferencia_id", idsSaques);

    if (error) throw error;
    taxas = data || [];
  }

  const contasPorId = Object.fromEntries(
    (contasRes.data || []).map((conta) => [String(conta.id), conta.nome]),
  );
  const taxaPorSaqueId = Object.fromEntries(
    taxas.map((taxa) => [String(taxa.saque_transferencia_id), Number(taxa.valor_total || 0)]),
  );
  const transferenciasComTaxa = transferencias.map((transferencia) => ({
    ...transferencia,
    taxa: taxaPorSaqueId[String(transferencia.id)] || 0,
  }));
  const plataforma = plataformaRes.data;
  const movimentacoes = montarMovimentacoesPlataforma({
    plataforma,
    ganhos: ganhosRes.data || [],
    transferencias: transferenciasComTaxa,
    taxas,
    contasPorId,
  });
  const saldo = calcularSaldosPlataformas(
    [plataforma],
    ganhosRes.data || [],
    transferenciasComTaxa,
  )[0]?.saldo || 0;
  const recebimentosAutomaticos = transferenciasComTaxa.filter(
    (item) => item.tipo === "recebimento_automatico_plataforma",
  );
  const ultimaLiquidacao = recebimentosAutomaticos
    .sort((a, b) => String(b.ciclo_operacional_fim || b.data || "")
      .localeCompare(String(a.ciclo_operacional_fim || a.data || "")))[0] || null;

  return {
    plataforma,
    saldo,
    movimentacoes,
    ultimaLiquidacao,
    proximoRecebimento: obterProximoRecebimentoAutomatico(plataforma, hojeBrasil()),
    contasPorId,
  };
}

export async function carregarEntradaPlataformaParaEdicao(entradaId) {
  const { data, error } = await supabase
    .from("entradas")
    .select(`
      id,
      data,
      created_at,
      km_rodados,
      horas_trabalhadas,
      veiculo_id,
      custo_estimado_combustivel,
      entrada_plataformas (
        id,
        plataforma_id,
        faturamento,
        valor_reembolso,
        numero_corridas,
        houve_pedagio,
        plataformas ( id, nome )
      )
    `)
    .eq("id", entradaId)
    .single();

  if (error) throw error;
  return data;
}

export async function salvarConfiguracaoPlataforma(plataformaId, configuracao) {
  const { error } = await supabase.rpc("configurar_financeiro_plataforma", {
    p_plataforma_id: Number(plataformaId),
    p_modo_recebimento: configuracao.modoRecebimento,
    p_conta_destino_id: Number(configuracao.contaDestinoId),
    p_dia_recebimento_automatico:
      configuracao.modoRecebimento === "retido"
        ? Number(configuracao.diaRecebimentoAutomatico)
        : null,
    p_taxa_saque_instantaneo: Number(configuracao.taxaSaqueInstantaneo || 0),
    p_taxa_saque_agendado: Number(configuracao.taxaSaqueAgendado || 0),
    p_tipos_saque_disponiveis: configuracao.tiposSaqueDisponiveis || [],
    p_tipo_saque_padrao: configuracao.tipoSaquePadrao || "instantaneo",
  });

  if (error) throw error;
}

export async function salvarExibicaoPlataformaNasContas(plataformaId, exibir) {
  const { error } = await supabase
    .from("plataformas")
    .update({ exibir_nas_contas: Boolean(exibir) })
    .eq("id", Number(plataformaId));

  if (error) throw error;
}

export async function excluirRecebimentoAutomaticoPlataforma(transferenciaId) {
  const { error } = await supabase.rpc("excluir_recebimento_semanal_plataforma", {
    p_transferencia_id: Number(transferenciaId),
  });

  if (error) throw error;
}

export async function editarRecebimentoSemanalPlataforma({
  transferenciaId,
  contaDestinoId,
  data,
  descricao,
}) {
  const { error } = await supabase.rpc("editar_recebimento_semanal_plataforma", {
    p_transferencia_id: Number(transferenciaId),
    p_conta_destino_id: Number(contaDestinoId),
    p_data: data,
    p_descricao: String(descricao || "").trim() || null,
  });

  if (error) throw error;
}

export async function registrarSaquePlataforma({
  plataformaId,
  contaDestinoId,
  valorBruto,
  tipoSaque,
  taxa,
  data,
}) {
  const { data: transferenciaId, error } = await supabase.rpc(
    "registrar_saque_plataforma",
    {
      p_plataforma_id: Number(plataformaId),
      p_conta_destino_id: Number(contaDestinoId),
      p_valor_bruto: Number(valorBruto),
      p_tipo_saque: tipoSaque,
      p_taxa: Number(taxa || 0),
      p_data: data,
    },
  );

  if (error) throw error;
  return transferenciaId;
}

export async function editarSaquePlataforma({
  transferenciaId,
  contaDestinoId,
  valorBruto,
  tipoSaque,
  taxa,
  data,
}) {
  const { error } = await supabase.rpc("editar_saque_plataforma", {
    p_transferencia_id: Number(transferenciaId),
    p_conta_destino_id: Number(contaDestinoId),
    p_valor_bruto: Number(valorBruto),
    p_tipo_saque: tipoSaque,
    p_taxa: Number(taxa || 0),
    p_data: data,
  });

  if (error) throw error;
}

export async function excluirSaquePlataforma(transferenciaId) {
  const { error } = await supabase.rpc("excluir_saque_plataforma", {
    p_transferencia_id: Number(transferenciaId),
  });

  if (error) throw error;
}
