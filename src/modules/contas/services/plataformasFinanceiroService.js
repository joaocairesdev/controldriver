import { supabase } from "../../../services/supabase";
import { hojeBrasil } from "../../../shared/utils/data";
import { calcularSaldosPlataformas } from "../utils/plataformasFinanceiro";

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
      .select("plataforma_id, valor_bruto, tipo")
      .in("tipo", ["saque_plataforma", "recebimento_automatico_plataforma"]),
  ]);

  if (plataformasRes.error) throw plataformasRes.error;
  if (ganhosRes.error) throw ganhosRes.error;
  if (transferenciasRes.error) throw transferenciasRes.error;

  return calcularSaldosPlataformas(
    plataformasRes.data || [],
    ganhosRes.data || [],
    transferenciasRes.data || [],
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
