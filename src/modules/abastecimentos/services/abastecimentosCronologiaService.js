import {
  abastecimentoParticipaDoConsumo,
  calcularMediaConsumoValido,
  compararAbastecimentosCronologicamente,
  localizarAbastecimentosVizinhos,
  recalcularCronologiaAbastecimentos,
  validarCrescimentoOdometro,
} from "../utils/abastecimentosCronologia.js";

const COMBUSTIVEIS_POR_MEDIA = {
  media_etanol: ["etanol", "etanol_aditivado"],
  media_gasolina: ["gasolina_comum", "gasolina_aditivada", "gasolina_podium"],
  media_gnv: ["gnv"],
  media_diesel: ["diesel"],
};

async function buscarAbastecimentosDoVeiculo(supabase, veiculoId) {
  const { data, error } = await supabase
    .from("saidas_abastecimentos")
    .select("id, saida_id, veiculo_id, odometro, litros, valor_litro, tipo_combustivel, saidas!inner(data_compra, status)")
    .eq("veiculo_id", Number(veiculoId));

  if (error) throw error;
  return data || [];
}

export async function validarCronologiaAbastecimento(supabase, {
  veiculoId,
  abastecimentoId = null,
  dataCompra,
  odometro,
}) {
  const historico = await buscarAbastecimentosDoVeiculo(supabase, veiculoId);
  const lancamento = {
    id: abastecimentoId || Number.MAX_SAFE_INTEGER,
    data_compra: dataCompra,
    odometro: Number(odometro),
  };
  const vizinhos = localizarAbastecimentosVizinhos(
    historico.filter(abastecimentoParticipaDoConsumo),
    lancamento,
    abastecimentoId
  );

  return {
    ...validarCrescimentoOdometro(odometro, vizinhos.anterior, vizinhos.posterior),
    ...vizinhos,
  };
}

function calcularMediasPorCombustivel(abastecimentos) {
  return Object.fromEntries(
    Object.entries(COMBUSTIVEIS_POR_MEDIA).map(([campo, combustiveis]) => [
      campo,
      calcularMediaConsumoValido(
        abastecimentos.filter((item) => combustiveis.includes(item.tipo_combustivel))
      ),
    ])
  );
}

export async function sincronizarCronologiaAbastecimentos(supabase, veiculoId) {
  if (!veiculoId) return { abastecimentos: [] };

  const historico = await buscarAbastecimentosDoVeiculo(supabase, veiculoId);
  const recalculados = recalcularCronologiaAbastecimentos(historico);

  for (const abastecimento of recalculados) {
    const { error } = await supabase
      .from("saidas_abastecimentos")
      .update({
        km_rodados: abastecimento.kmPeriodo,
        km_total_periodo: abastecimento.kmPeriodo,
        consumo_km_l: abastecimento.consumoKmLitro,
        custo_por_km: abastecimento.custoPorKm,
      })
      .eq("id", abastecimento.id);

    if (error) throw error;
  }

  const participantes = recalculados.filter(abastecimentoParticipaDoConsumo);
  const participantesOrdenados = [...participantes].sort(compararAbastecimentosCronologicamente);
  const ultimoComConsumo = [...participantesOrdenados]
    .reverse()
    .find((item) => item.consumoKmLitro > 0);
  const { error: erroVeiculo } = await supabase
    .from("veiculos")
    .update({
      ...calcularMediasPorCombustivel(participantes),
      custo_medio_km_combustivel: Number(ultimoComConsumo?.custoPorKm || 0),
      custo_medio_km_geral: Number(ultimoComConsumo?.custoPorKm || 0),
    })
    .eq("id", Number(veiculoId));

  if (erroVeiculo) throw erroVeiculo;
  return { abastecimentos: recalculados };
}
