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
  odometroInicial = 0,
}) {
  const odometroAtual = Number(odometro || 0);
  const odometroBase = Number(anterior?.odometro ?? odometroInicial ?? 0);
  const kmPeriodo = Math.max(odometroAtual - odometroBase, 0);
  const litrosNumericos = Number(litros || 0);
  const periodoValido = kmPeriodo > 0 && litrosNumericos > 0;

  return {
    kmPeriodo,
    consumoKmLitro: periodoValido ? kmPeriodo / litrosNumericos : 0,
  };
}
