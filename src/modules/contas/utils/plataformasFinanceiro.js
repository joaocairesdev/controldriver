function arredondarMoeda(valor) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

export function calcularValorLiquidoSaque(valorBruto, taxa) {
  return arredondarMoeda(Number(valorBruto || 0) - Number(taxa || 0));
}

export function obterTaxaPadraoSaque(plataforma, tipoSaque) {
  if (tipoSaque === "instantaneo") {
    return Number(plataforma?.taxa_saque_instantaneo || 0);
  }

  if (tipoSaque === "agendado") {
    return Number(plataforma?.taxa_saque_agendado || 0);
  }

  return 0;
}

export function obterTiposSaqueDisponiveis(plataforma) {
  const tipos = Array.isArray(plataforma?.tipos_saque_disponiveis)
    ? plataforma.tipos_saque_disponiveis
    : [];

  return [...new Set(tipos)].filter((tipo) =>
    ["instantaneo", "agendado", "outro"].includes(tipo),
  );
}

export function obterTipoSaquePadrao(plataforma) {
  const tipos = obterTiposSaqueDisponiveis(plataforma);
  if (tipos.includes(plataforma?.tipo_saque_padrao)) {
    return plataforma.tipo_saque_padrao;
  }
  return tipos[0] || "";
}

function dataUTC(data) {
  const [ano, mes, dia] = String(data || "").split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function dataISO(data) {
  return data.toISOString().slice(0, 10);
}

function adicionarDias(data, quantidade) {
  const resultado = new Date(data.getTime());
  resultado.setUTCDate(resultado.getUTCDate() + quantidade);
  return resultado;
}

function compararMovimentacoes(a, b) {
  const diferencaData = String(b.data || "1900-01-01")
    .localeCompare(String(a.data || "1900-01-01"));
  if (diferencaData !== 0) return diferencaData;
  return String(b.created_at || "").localeCompare(String(a.created_at || ""));
}

function diaSemanaISO(data) {
  return data.getUTCDay() || 7;
}

export function obterCicloOperacional(data) {
  const referencia = dataUTC(data);
  const diaSemana = diaSemanaISO(referencia);
  return {
    inicio: dataISO(adicionarDias(referencia, -(diaSemana - 1))),
    fim: dataISO(adicionarDias(referencia, 7 - diaSemana)),
  };
}

export function obterUltimoCicloDevido(dataReferencia, diaPagamento) {
  const referencia = dataUTC(dataReferencia);
  const diaSemana = diaSemanaISO(referencia);
  const dia = Math.min(Math.max(Number(diaPagamento || 1), 1), 7);
  const dataPagamento = adicionarDias(
    referencia,
    -((diaSemana - dia + 7) % 7),
  );
  const fim = adicionarDias(dataPagamento, -dia);

  return {
    inicio: dataISO(adicionarDias(fim, -6)),
    fim: dataISO(fim),
    dataPagamento: dataISO(dataPagamento),
  };
}

export function obterProximoRecebimentoAutomatico(plataforma, dataReferencia) {
  if (
    plataforma?.modo_recebimento !== "retido"
    || !plataforma?.dia_recebimento_automatico
  ) return null;

  const diaPagamento = Math.min(
    Math.max(Number(plataforma.dia_recebimento_automatico), 1),
    7,
  );
  const referencia = dataUTC(dataReferencia);

  if (plataforma.ultimo_ciclo_liquidado_fim) {
    let proximo = adicionarDias(
      dataUTC(plataforma.ultimo_ciclo_liquidado_fim),
      7 + diaPagamento,
    );
    while (proximo < referencia) proximo = adicionarDias(proximo, 7);
    return dataISO(proximo);
  }

  const diferenca = (diaPagamento - diaSemanaISO(referencia) + 7) % 7;
  return dataISO(adicionarDias(referencia, diferenca));
}

export function obterDataPagamentoCiclo(cicloFim, diaPagamento) {
  if (!cicloFim || !diaPagamento) return null;
  return dataISO(adicionarDias(dataUTC(cicloFim), Number(diaPagamento)));
}

export function montarMovimentacoesPlataforma({
  plataforma,
  ganhos = [],
  transferencias = [],
  taxas = [],
  contasPorId = {},
}) {
  const ganhosPorId = new Map(ganhos.map((ganho) => [String(ganho.id), ganho]));
  const saquesPorId = new Map(
    transferencias
      .filter((transferencia) => transferencia.tipo === "saque_plataforma")
      .map((transferencia) => [String(transferencia.id), transferencia]),
  );
  const taxasPorSaqueId = new Map(
    taxas.map((taxa) => [String(taxa.saque_transferencia_id), taxa]),
  );

  const movimentosGanhos = ganhos.map((ganho) => {
    const valor = arredondarMoeda(
      Number(ganho.faturamento || 0) + Number(ganho.valor_reembolso || 0),
    );

    return {
      id: `ganho-${ganho.id}`,
      tipo: "ganho",
      data: ganho.entradas?.data,
      created_at: ganho.created_at || ganho.entradas?.created_at,
      titulo: "Ganhos",
      descricao: `${Number(ganho.numero_corridas || 0)} corrida(s)`,
      valor,
      sinal: "entrada",
      impactoSaldo: valor,
      entradaId: ganho.entrada_id,
      dadosOriginais: ganho,
    };
  });

  const movimentosTransferencias = transferencias.flatMap((transferencia) => {
    const valorBruto = Number(transferencia.valor_bruto || transferencia.valor || 0);
    const contaDestino = contasPorId[String(transferencia.conta_destino_id)] || "Conta";

    if (transferencia.tipo === "saque_plataforma") {
      const taxaRegistrada = taxasPorSaqueId.has(String(transferencia.id));
      return [{
        id: `saque-${transferencia.id}`,
        tipo: "saque",
        data: transferencia.data,
        created_at: transferencia.created_at,
        titulo: "Saque",
        descricao: `Para ${contaDestino}`,
        valor: valorBruto,
        sinal: "saida",
        impactoSaldo: -valorBruto,
        statusTaxa: taxaRegistrada ? "lancada" : "sem_taxa",
        statusTaxaTexto: taxaRegistrada ? "Taxa lançada" : "Sem taxa",
        saqueId: transferencia.id,
        dadosOriginais: transferencia,
      }];
    }

    if (transferencia.tipo === "recebimento_automatico_plataforma") {
      return [{
        id: `recebimento-${transferencia.id}`,
        tipo: "recebimento",
        data: transferencia.data,
        created_at: transferencia.created_at,
        titulo: "Recebimento automático",
        descricao: `Para ${contaDestino}`,
        valor: valorBruto,
        sinal: "saida",
        impactoSaldo: -valorBruto,
        dadosOriginais: transferencia,
      }];
    }

    if (transferencia.tipo === "recebimento_direto_plataforma") {
      const ganho = ganhosPorId.get(String(transferencia.entrada_plataforma_id));
      const dataPagamentoCiclo = obterDataPagamentoCiclo(
        ganho?.ciclo_operacional_fim,
        plataforma?.dia_recebimento_automatico,
      );
      const dataLancamento = String(ganho?.created_at || "").slice(0, 10);
      const cicloLiquidado = Boolean(
        ganho?.ciclo_operacional_fim
        && plataforma?.ultimo_ciclo_liquidado_fim
        && ganho.ciclo_operacional_fim <= plataforma.ultimo_ciclo_liquidado_fim
        && dataPagamentoCiclo
        && dataLancamento
        && dataLancamento >= dataPagamentoCiclo,
      );
      if (!cicloLiquidado || plataforma?.modo_recebimento !== "retido") return [];

      return [{
        id: `conciliacao-${transferencia.id}`,
        tipo: "conciliacao",
        data: dataLancamento,
        created_at: transferencia.created_at,
        titulo: "Conciliação automática",
        descricao: "Ganho de ciclo já liquidado",
        valor: valorBruto,
        sinal: "saida",
        impactoSaldo: -valorBruto,
        entradaId: ganho?.entrada_id,
        dadosOriginais: { ...transferencia, ganho },
      }];
    }

    return [];
  });

  const movimentosTaxas = taxas.map((taxa) => {
    const saque = saquesPorId.get(String(taxa.saque_transferencia_id));
    return {
      id: `taxa-${taxa.id}`,
      tipo: "taxa",
      data: taxa.data_efetivacao || taxa.data_compra,
      created_at: taxa.created_at,
      titulo: "Taxa de saque",
      descricao: taxa.descricao || "Taxa vinculada ao saque",
      valor: Number(taxa.valor_total || 0),
      sinal: "saida",
      impactoSaldo: 0,
      saqueId: taxa.saque_transferencia_id,
      dadosOriginais: saque
        ? { ...saque, taxa: Number(taxa.valor_total || 0) }
        : taxa,
    };
  });

  return [
    ...movimentosGanhos,
    ...movimentosTransferencias,
    ...movimentosTaxas,
  ].sort(compararMovimentacoes);
}

export function filtrarMovimentacoesPlataforma(movimentacoes, filtro) {
  if (!filtro || filtro === "todos") return movimentacoes || [];
  return (movimentacoes || []).filter((item) => item.tipo === filtro);
}

export function calcularSaldoExtratoPlataforma(movimentacoes) {
  return arredondarMoeda(
    (movimentacoes || []).reduce(
      (total, item) => total + Number(item.impactoSaldo || 0),
      0,
    ),
  );
}

export function calcularSaldosPlataformas(
  plataformas = [],
  ganhos = [],
  transferencias = [],
) {
  const saldos = new Map(
    plataformas.map((plataforma) => [String(plataforma.id), 0]),
  );

  ganhos.forEach((ganho) => {
    const plataforma = plataformas.find(
      (item) => String(item.id) === String(ganho.plataforma_id),
    );
    if (!plataforma || ganho.destino_financeiro !== "plataforma") return;

    const valor =
      Number(ganho.faturamento || 0) + Number(ganho.valor_reembolso || 0);
    const chave = String(plataforma.id);
    saldos.set(chave, arredondarMoeda((saldos.get(chave) || 0) + valor));
  });

  transferencias.forEach((transferencia) => {
    if (
      !["saque_plataforma", "recebimento_automatico_plataforma"].includes(
        transferencia.tipo,
      )
    ) return;
    const chave = String(transferencia.plataforma_id);
    if (!saldos.has(chave)) return;

    saldos.set(
      chave,
      arredondarMoeda(
        (saldos.get(chave) || 0) - Number(transferencia.valor_bruto || 0),
      ),
    );
  });

  return plataformas.map((plataforma) => ({
    ...plataforma,
    saldo: saldos.get(String(plataforma.id)) || 0,
  }));
}
