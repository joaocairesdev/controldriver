import { adicionarFrequencia, adicionarMesesSeguro } from "../../../shared/utils/recorrencia.js";

export const TIPOS_CREDOR = [
  { valor: "banco", titulo: "Banco" },
  { valor: "financeira", titulo: "Financeira" },
  { valor: "pessoa_fisica", titulo: "Pessoa Física" },
  { valor: "empresa", titulo: "Empresa" },
  { valor: "outro", titulo: "Outro" },
];

export const PERIODICIDADES_CONTRATO = [
  { valor: "diaria", titulo: "Diária" },
  { valor: "semanal", titulo: "Semanal" },
  { valor: "quinzenal", titulo: "Quinzenal" },
  { valor: "mensal", titulo: "Mensal" },
];

export const FORMAS_PAGAMENTO_CONTRATO = [
  { valor: "pix", titulo: "Pix" },
  { valor: "debito", titulo: "Débito" },
  { valor: "debito_conta", titulo: "Débito em conta" },
  { valor: "dinheiro", titulo: "Dinheiro" },
  { valor: "boleto", titulo: "Boleto" },
  { valor: "credito_avista", titulo: "Cartão de crédito" },
];

function paraCentavos(valor) {
  return Math.round(Number(valor || 0) * 100);
}

export function calcularTaxaJurosPercentual(valorRecebido, valorContratado) {
  const recebidoCentavos = paraCentavos(valorRecebido);
  const contratadoCentavos = paraCentavos(valorContratado);
  if (recebidoCentavos <= 0 || contratadoCentavos < recebidoCentavos) return 0;
  return Math.round((((contratadoCentavos - recebidoCentavos) / recebidoCentavos) * 100) * 10000) / 10000;
}

export function dividirValorEmParcelas(valorContratado, quantidade) {
  const totalCentavos = paraCentavos(valorContratado);
  const totalParcelas = Math.max(Math.trunc(Number(quantidade || 0)), 0);
  if (totalCentavos <= 0 || totalParcelas <= 0) return [];

  const baseCentavos = Math.floor(totalCentavos / totalParcelas);
  if (baseCentavos <= 0) return [];

  return Array.from({ length: totalParcelas }, (_, indice) => (
    indice === totalParcelas - 1
      ? (totalCentavos - baseCentavos * (totalParcelas - 1)) / 100
      : baseCentavos / 100
  ));
}

export function gerarParcelasContrato({
  quantidade,
  valorContratado,
  valorParcela,
  primeiroVencimento,
  periodicidade = "mensal",
}) {
  const quantidadeNumerica = Number(quantidade || 0);
  if (!Number.isInteger(quantidadeNumerica)) return [];
  const total = Math.max(quantidadeNumerica, 0);
  const valores = valorContratado !== undefined
    ? dividirValorEmParcelas(valorContratado, total)
    : Array.from({ length: total }, () => Math.round(Number(valorParcela || 0) * 100) / 100);
  if (!total || valores.length !== total || !primeiroVencimento || !periodicidade) return [];

  const parcelas = [];
  let proximoVencimento = primeiroVencimento;
  for (let indice = 0; indice < total; indice += 1) {
    const vencimento = periodicidade === "mensal"
      ? adicionarMesesSeguro(primeiroVencimento, indice)
      : proximoVencimento;
    parcelas.push({ numero: indice + 1, vencimento, valor: valores[indice] });
    if (periodicidade !== "mensal") proximoVencimento = adicionarFrequencia(vencimento, periodicidade);
  }

  return parcelas;
}

export function rotuloEntradaAvulsa(entrada) {
  if (entrada?.contrato_financeiro_id) return "Empréstimo";
  if (entrada?.finalidade === "pessoal") return "Entrada Avulsa Pessoal";
  if (entrada?.finalidade === "trabalho") return "Entrada Avulsa Trabalho";
  return "Entrada Avulsa";
}

export function contratoPossuiHistoricoProtegido(contrato) {
  return (contrato?.parcelas || []).some((parcela) => {
    const statusParcela = String(parcela?.status || "").toLowerCase();
    const statusSaida = String(parcela?.saida?.status || "").toLowerCase();
    return Number(parcela?.valor_pago || parcela?.saida?.valor_pago || 0) > 0
      || ["paga", "parcial", "cancelada"].includes(statusParcela)
      || ["pago", "parcial", "cancelado", "excluido"].includes(statusSaida);
  });
}

export function valorPagoParcela(parcela) {
  const valor = Number(parcela?.valor || 0);
  const saida = parcela?.saida;
  if (String(saida?.status || parcela?.status || "").toLowerCase() === "pago") return valor;
  return Math.min(Number(saida?.valor_pago ?? parcela?.valor_pago ?? 0), valor);
}

export function calcularResumoContrato(contrato) {
  const parcelas = contrato?.parcelas || [];
  const consideradas = parcelas.filter((parcela) => parcela.status !== "cancelada");
  const totalPago = consideradas.reduce((total, parcela) => total + valorPagoParcela(parcela), 0);
  const totalDevido = consideradas.reduce((total, parcela) => total + Number(parcela.valor || 0), 0);
  const saldoDevedor = Math.max(Math.round((totalDevido - totalPago) * 100) / 100, 0);
  const proxima = consideradas
    .filter((parcela) => Number(parcela.valor || 0) - valorPagoParcela(parcela) > 0)
    .sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)))[0] || null;

  return {
    totalPago: Math.round(totalPago * 100) / 100,
    totalDevido: Math.round(totalDevido * 100) / 100,
    saldoDevedor,
    proximoVencimento: proxima?.data_vencimento || null,
    proximaParcela: proxima,
    parcelasPagas: consideradas.filter((parcela) => valorPagoParcela(parcela) >= Number(parcela.valor || 0)).length,
    parcelasAtivas: consideradas.length,
  };
}

export function planoConfereComValorContratado(valorContratado, quantidade, valorParcela) {
  const totalPlano = Math.round(Number(quantidade || 0) * Number(valorParcela || 0) * 100);
  const totalContrato = Math.round(Number(valorContratado || 0) * 100);
  return totalPlano === totalContrato;
}
