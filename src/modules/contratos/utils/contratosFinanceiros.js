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

function deCentavos(valor) {
  return Number(valor || 0) / 100;
}

export function somarValoresParcelas(parcelas = []) {
  return deCentavos(
    parcelas.reduce((total, parcela) => total + paraCentavos(parcela?.valor), 0),
  );
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
  if (!total || valores.length !== total || !dataISOValida(primeiroVencimento) || !periodicidade) return [];

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

function criarErroAgendaMensal(campo, mensagem) {
  const erro = new RangeError(mensagem);
  erro.campo = campo;
  return erro;
}

function dataISOValida(data) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))
    && adicionarMesesSeguro(data, 0) === data;
}

export function gerarAgendaMensalContrato({
  inicioVigencia,
  fimVigencia,
  primeiroVencimento,
  valorPadrao,
}) {
  if (!dataISOValida(inicioVigencia) || !dataISOValida(fimVigencia)) {
    throw criarErroAgendaMensal("fimVigencia", "Informe uma vigência válida.");
  }
  if (inicioVigencia >= fimVigencia) {
    throw criarErroAgendaMensal(
      "fimVigencia",
      "O fim da vigência deve ser posterior ao início.",
    );
  }
  if (!dataISOValida(primeiroVencimento)
    || primeiroVencimento < inicioVigencia
    || primeiroVencimento >= fimVigencia) {
    throw criarErroAgendaMensal(
      "primeiroVencimento",
      "O primeiro vencimento deve estar dentro da vigência.",
    );
  }

  const valor = Math.round(Number(valorPadrao || 0) * 100) / 100;
  const agenda = [];
  let indice = 0;
  let vencimento = primeiroVencimento;

  while (vencimento < fimVigencia) {
    agenda.push({ numero: indice + 1, vencimento, valor });
    indice += 1;
    vencimento = adicionarMesesSeguro(primeiroVencimento, indice);
  }

  return agenda;
}

export function aplicarValoresIndividuaisAgenda(agenda = [], valoresIndividuais = {}) {
  return agenda.map((parcela) => {
    if (!Object.hasOwn(valoresIndividuais, parcela.vencimento)) return parcela;
    return {
      ...parcela,
      valor: deCentavos(paraCentavos(valoresIndividuais[parcela.vencimento])),
    };
  });
}

export function validarAgendaMensalContrato({
  inicioVigencia,
  fimVigencia,
  primeiroVencimento,
  valorPadrao,
  agenda,
}) {
  const esperada = gerarAgendaMensalContrato({
    inicioVigencia,
    fimVigencia,
    primeiroVencimento,
    valorPadrao,
  });
  if (agenda === undefined || agenda === null) return esperada;
  if (!Array.isArray(agenda) || agenda.length !== esperada.length) {
    throw new Error("A agenda mensal não corresponde à vigência informada.");
  }

  return esperada.map((parcela, indice) => {
    const recebida = agenda[indice];
    const valorCentavos = paraCentavos(recebida?.valor);
    if (recebida?.numero !== parcela.numero
      || recebida?.vencimento !== parcela.vencimento
      || valorCentavos <= 0) {
      throw criarErroAgendaMensal(
        `agenda.${parcela.vencimento}`,
        "A agenda mensal contém uma parcela inválida.",
      );
    }
    return { ...parcela, valor: deCentavos(valorCentavos) };
  });
}

export function calcularParcelamentoBidirecional({
  quantidade,
  valorTotal,
  valorParcela,
  origem = "total",
}) {
  const totalParcelas = Number(quantidade || 0);
  if (!Number.isInteger(totalParcelas) || totalParcelas <= 0) {
    return { valorTotal: 0, valorParcela: 0, valoresParcelas: [] };
  }

  if (origem === "parcela") {
    const parcelaCentavos = paraCentavos(valorParcela);
    if (parcelaCentavos <= 0) {
      return { valorTotal: 0, valorParcela: 0, valoresParcelas: [] };
    }
    const valoresParcelas = Array.from(
      { length: totalParcelas },
      () => deCentavos(parcelaCentavos),
    );
    return {
      valorTotal: deCentavos(parcelaCentavos * totalParcelas),
      valorParcela: deCentavos(parcelaCentavos),
      valoresParcelas,
    };
  }

  const valoresParcelas = dividirValorEmParcelas(valorTotal, totalParcelas);
  if (valoresParcelas.length !== totalParcelas) {
    return { valorTotal: 0, valorParcela: 0, valoresParcelas: [] };
  }
  return {
    valorTotal: somarValoresParcelas(valoresParcelas.map((valor) => ({ valor }))),
    valorParcela: valoresParcelas[0],
    valoresParcelas,
  };
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
