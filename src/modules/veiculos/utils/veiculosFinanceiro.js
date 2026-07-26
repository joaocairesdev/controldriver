import { adicionarFrequencia, adicionarMesesSeguro } from "../../../shared/utils/recorrencia.js";

export { adicionarFrequencia, adicionarMesesSeguro };

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
