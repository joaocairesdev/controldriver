function dataLocal(dataISO) {
  const [ano, mes, dia] = String(dataISO).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function dataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function adicionarMesesSeguro(dataTexto, quantidade) {
  const origem = dataLocal(dataTexto);
  const dia = origem.getDate();
  const destino = new Date(origem.getFullYear(), origem.getMonth() + quantidade, 1);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(dia, ultimoDia));
  return dataISO(destino);
}

export function adicionarFrequencia(dataTexto, frequencia) {
  if (frequencia === "mensal") return adicionarMesesSeguro(dataTexto, 1);
  if (frequencia === "anual") return adicionarMesesSeguro(dataTexto, 12);

  const dias = { diaria: 1, semanal: 7, quinzenal: 15 }[frequencia];
  if (!dias) throw new Error("Frequência de aluguel inválida.");
  const data = dataLocal(dataTexto);
  data.setDate(data.getDate() + dias);
  return dataISO(data);
}

export function gerarVencimentosAluguel({ proximoVencimento, frequencia, dataFim = null }) {
  if (!proximoVencimento) return [];
  const limiteExclusivo = adicionarMesesSeguro(proximoVencimento, 12);
  const vencimentos = [];
  let atual = proximoVencimento;
  let indice = 0;

  while (atual < limiteExclusivo && (!dataFim || atual <= dataFim)) {
    vencimentos.push(atual);
    indice += 1;
    atual = frequencia === "mensal"
      ? adicionarMesesSeguro(proximoVencimento, indice)
      : frequencia === "anual"
        ? adicionarMesesSeguro(proximoVencimento, indice * 12)
        : adicionarFrequencia(atual, frequencia);
  }

  return vencimentos;
}

export function gerarParcelasFinanciamento({
  totalParcelas,
  parcelasPagas,
  numeroProximaParcela,
  proximoVencimento,
}) {
  const total = Number(totalParcelas || 0);
  const pagas = Number(parcelasPagas || 0);
  if (!total || pagas >= total || !proximoVencimento) return [];

  const primeira = Math.max(Number(numeroProximaParcela || pagas + 1), pagas + 1);
  return Array.from({ length: Math.max(total - primeira + 1, 0) }, (_, indice) => ({
    numero: primeira + indice,
    vencimento: adicionarMesesSeguro(proximoVencimento, indice),
  }));
}

export function chaveCobranca({ financiamentoId, aluguelId, caucaoId, referencia, dataVencimento }) {
  if (financiamentoId) return `financiamento:${financiamentoId}:${referencia}`;
  if (aluguelId) return `aluguel:${aluguelId}:${dataVencimento}`;
  return `caucao:${caucaoId}`;
}

export function filtrarCobrancasFaltantes(esperadas, registradas, obterChave) {
  const existentes = new Set((registradas || []).map(obterChave));
  return (esperadas || []).filter((item) => !existentes.has(obterChave(item)));
}
