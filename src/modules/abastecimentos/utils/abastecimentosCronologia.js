function obterDataCompra(abastecimento) {
  const saida = Array.isArray(abastecimento?.saidas)
    ? abastecimento.saidas[0]
    : abastecimento?.saidas;

  return saida?.data_compra || abastecimento?.data_compra || "";
}

function compararIdentificadores(a, b) {
  const idA = Number(a?.id);
  const idB = Number(b?.id);

  if (Number.isFinite(idA) && Number.isFinite(idB)) return idA - idB;
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function compararAbastecimentosCronologicamente(a, b) {
  const comparacaoData = obterDataCompra(a).localeCompare(obterDataCompra(b));
  if (comparacaoData !== 0) return comparacaoData;

  const comparacaoOdometro = Number(a?.odometro || 0) - Number(b?.odometro || 0);
  if (comparacaoOdometro !== 0) return comparacaoOdometro;

  return compararIdentificadores(a, b);
}

export function localizarAbastecimentosVizinhos(
  abastecimentos,
  lancamento,
  abastecimentoIgnoradoId = null
) {
  const ordenados = (abastecimentos || [])
    .filter(
      (item) =>
        abastecimentoIgnoradoId === null ||
        String(item.id) !== String(abastecimentoIgnoradoId)
    )
    .sort(compararAbastecimentosCronologicamente);

  const indicePosterior = ordenados.findIndex(
    (item) => compararAbastecimentosCronologicamente(item, lancamento) > 0
  );

  if (indicePosterior === -1) {
    return { anterior: ordenados.at(-1) || null, posterior: null };
  }

  return {
    anterior: ordenados[indicePosterior - 1] || null,
    posterior: ordenados[indicePosterior] || null,
  };
}

export function validarCrescimentoOdometro(odometro, anterior, posterior) {
  const valor = Number(odometro);
  const valorAnterior = anterior ? Number(anterior.odometro) : null;
  const valorPosterior = posterior ? Number(posterior.odometro) : null;

  return {
    valido:
      (valorAnterior === null || valor > valorAnterior) &&
      (valorPosterior === null || valor < valorPosterior),
    valorAnterior,
    valorPosterior,
  };
}

export function calcularMetricasConsumo({
  odometro,
  litros,
  anterior,
}) {
  const odometroAtual = Number(odometro || 0);
  if (!anterior) {
    return { kmPeriodo: 0, consumoKmLitro: 0 };
  }

  const odometroBase = Number(anterior.odometro || 0);
  const kmPeriodo = Math.max(odometroAtual - odometroBase, 0);
  const litrosNumericos = Number(litros || 0);
  const periodoValido = kmPeriodo > 0 && litrosNumericos > 0;

  return {
    kmPeriodo,
    consumoKmLitro: periodoValido ? kmPeriodo / litrosNumericos : 0,
  };
}

export function abastecimentoParticipaDoConsumo(abastecimento) {
  const saida = Array.isArray(abastecimento?.saidas)
    ? abastecimento.saidas[0]
    : abastecimento?.saidas;
  const status = String(saida?.status || abastecimento?.status || "").toLowerCase();

  return !["cancelado", "cancelada", "excluido", "excluida"].includes(status);
}

export function recalcularCronologiaAbastecimentos(abastecimentos) {
  const participantes = (abastecimentos || [])
    .filter(abastecimentoParticipaDoConsumo)
    .sort(compararAbastecimentosCronologicamente);
  const recalculadosPorId = new Map();

  participantes.forEach((abastecimento, indice) => {
    const anterior = participantes[indice - 1] || null;
    const metricas = calcularMetricasConsumo({
      odometro: abastecimento.odometro,
      litros: abastecimento.litros,
      anterior,
    });
    const custoTotal = Number(abastecimento.litros || 0) * Number(abastecimento.valor_litro || 0);

    recalculadosPorId.set(String(abastecimento.id), {
      ...abastecimento,
      anteriorId: anterior?.id || null,
      kmPeriodo: metricas.kmPeriodo,
      consumoKmLitro: metricas.consumoKmLitro,
      custoPorKm: metricas.kmPeriodo > 0 ? custoTotal / metricas.kmPeriodo : 0,
    });
  });

  return (abastecimentos || []).map((abastecimento) =>
    recalculadosPorId.get(String(abastecimento.id)) || {
      ...abastecimento,
      anteriorId: null,
      kmPeriodo: 0,
      consumoKmLitro: 0,
      custoPorKm: 0,
    }
  );
}

export function obterConsumosValidos(abastecimentos) {
  return (abastecimentos || [])
    .filter(abastecimentoParticipaDoConsumo)
    .map((item) => Number(item.consumoKmLitro ?? item.consumo_km_l ?? 0))
    .filter((consumo) => Number.isFinite(consumo) && consumo > 0);
}

export function calcularMediaConsumoValido(abastecimentos) {
  const consumos = obterConsumosValidos(abastecimentos);

  return consumos.length
    ? consumos.reduce((soma, consumo) => soma + consumo, 0) / consumos.length
    : 0;
}
