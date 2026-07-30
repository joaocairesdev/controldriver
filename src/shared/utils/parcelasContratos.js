export function arredondarMoeda(valor) {
  return Math.round(Number(valor || 0) * 100) / 100;
}

export function obterValorPrevistoParcela(parcela) {
  return arredondarMoeda(
    parcela?.valorPrevisto
      ?? parcela?.valor_previsto
      ?? parcela?.valor
      ?? parcela?.valor_total
      ?? 0
  );
}

export function obterValorAtualizadoParcela(parcela) {
  return arredondarMoeda(
    parcela?.valorAtualizado
      ?? parcela?.valor_total
      ?? parcela?.valor
      ?? obterValorPrevistoParcela(parcela)
  );
}

export function calcularDiferencaParcela(parcela) {
  return arredondarMoeda(
    obterValorAtualizadoParcela(parcela) - obterValorPrevistoParcela(parcela)
  );
}

export function obterSaldoParcela(parcela) {
  return Math.max(
    arredondarMoeda(
      obterValorAtualizadoParcela(parcela) - Number(parcela?.valorPago ?? parcela?.valor_pago ?? 0)
    ),
    0
  );
}

export function parcelaEstaPaga(parcela) {
  const status = String(parcela?.status || "").toLowerCase();
  return ["paga", "pago"].includes(status) || obterSaldoParcela(parcela) <= 0;
}

export function parcelaEstaAtrasada(parcela, hoje = new Date().toISOString().split("T")[0]) {
  return !parcelaEstaPaga(parcela)
    && !["cancelada", "cancelado"].includes(String(parcela?.status || "").toLowerCase())
    && Boolean(parcela?.dataVencimento)
    && parcela.dataVencimento < hoje;
}

export function parcelaPodeSerEditada(parcela) {
  const status = String(parcela?.status || "").toLowerCase();
  const valorPago = Number(parcela?.valorPago ?? parcela?.valor_pago ?? 0);
  return ["aberta", "aberto", "pendente"].includes(status) && valorPago <= 0;
}

export function parcelaPodeSerPaga(parcela) {
  const status = String(parcela?.status || "").toLowerCase();
  return !["cancelada", "cancelado"].includes(status)
    && !parcelaEstaPaga(parcela)
    && obterSaldoParcela(parcela) > 0;
}

function distribuirCentavos(total, pesos) {
  const totalCentavos = Math.round(Number(total || 0) * 100);
  const pesosValidos = pesos.map((peso) => Math.max(Number(peso || 0), 0));
  const somaPesos = pesosValidos.reduce((soma, peso) => soma + peso, 0);
  const divisor = somaPesos > 0 ? somaPesos : Math.max(pesos.length, 1);
  let acumulado = 0;

  return pesosValidos.map((peso, indice) => {
    if (indice === pesosValidos.length - 1) return (totalCentavos - acumulado) / 100;
    const base = somaPesos > 0 ? peso : 1;
    const centavos = Math.round((totalCentavos * base) / divisor);
    acumulado += centavos;
    return centavos / 100;
  });
}

export function criarItensParcela(parcela, itensBase = [], nomePadrao = "Contrato financeiro") {
  const persistidos = parcela?.cobranca?.itens_parcela;
  if (Array.isArray(persistidos) && persistidos.length > 0) {
    return persistidos.map((item, indice) => ({
      id: String(item.id ?? indice + 1),
      nome: item.nome || nomePadrao,
      valorPrevisto: arredondarMoeda(item.valor_previsto),
      valorAtualizado: arredondarMoeda(item.valor_atualizado ?? item.valor_previsto),
      observacao: item.observacao || "",
    }));
  }

  const bases = itensBase.length > 0
    ? itensBase
    : [{ id: "origem", nome: nomePadrao, valor: obterValorPrevistoParcela(parcela) }];
  const pesos = bases.map((item) => item.valor ?? item.valor_renegociado ?? item.valor_original ?? 0);
  const previstos = distribuirCentavos(obterValorPrevistoParcela(parcela), pesos);
  const atualizados = distribuirCentavos(obterValorAtualizadoParcela(parcela), pesos);

  return bases.map((item, indice) => ({
    id: String(item.id ?? item.origem_id ?? indice + 1),
    nome: item.nome || item.titulo || nomePadrao,
    valorPrevisto: previstos[indice],
    valorAtualizado: atualizados[indice],
    observacao: "",
  }));
}

export function criarAtualizacaoItemParcela(parcela, itemId, { valorAtualizado, observacao }, itensBase, nomePadrao) {
  const valorNovo = arredondarMoeda(valorAtualizado);
  if (valorNovo <= 0) throw new Error("Informe um valor atualizado maior que zero.");

  const itens = criarItensParcela(parcela, itensBase, nomePadrao).map((item) =>
    String(item.id) === String(itemId)
      ? { ...item, valorAtualizado: valorNovo, observacao: String(observacao || "").trim() }
      : item
  );
  const encontrou = itens.some((item) => String(item.id) === String(itemId));
  if (!encontrou) throw new Error("Item da parcela não encontrado.");

  const valorParcela = arredondarMoeda(
    itens.reduce((total, item) => total + Number(item.valorAtualizado || 0), 0)
  );

  return {
    itens,
    atualizacao: {
      itens_parcela: itens.map((item) => ({
        id: item.id,
        nome: item.nome,
        valor_previsto: item.valorPrevisto,
        valor_atualizado: item.valorAtualizado,
        observacao: item.observacao || null,
      })),
      valor_total: valorParcela,
      valor_parcela: valorParcela,
    },
  };
}

export function normalizarParcelaContrato({
  parcela,
  cobranca,
  numero,
  pagamentos = [],
}) {
  const pagamentosOrdenados = [...pagamentos].sort((a, b) =>
    String(a.data_compra || a.created_at || "").localeCompare(String(b.data_compra || b.created_at || ""))
  );
  const ultimoPagamento = pagamentosOrdenados.at(-1);
  const valorPrevisto = obterValorPrevistoParcela({
    valorPrevisto: parcela?.valor ?? cobranca?.valor_previsto ?? cobranca?.valor_total,
  });

  return {
    id: parcela?.id ?? cobranca?.id,
    numero: numero ?? parcela?.numero ?? 1,
    dataVencimento: cobranca?.data_vencimento || parcela?.data_vencimento || null,
    valorPrevisto,
    valorAtualizado: obterValorAtualizadoParcela(cobranca || parcela),
    valorPago: arredondarMoeda(cobranca?.valor_pago ?? parcela?.valor_pago ?? 0),
    dataPagamento: ultimoPagamento?.data_compra || cobranca?.data_efetivacao || null,
    status: cobranca?.status || parcela?.status || "pendente",
    cobranca: cobranca || null,
    origem: parcela || null,
    pagamentos: pagamentosOrdenados,
  };
}
