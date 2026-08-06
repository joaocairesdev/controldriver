function arredondarMoeda(valor) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

export function calcularValorLiquidoSaque(valorBruto, taxa) {
  return arredondarMoeda(Number(valorBruto || 0) - Number(taxa || 0));
}

export function obterValorBrutoTransferencia(transferencia = {}) {
  if (transferencia.valor_bruto !== null && transferencia.valor_bruto !== undefined) {
    return Number(transferencia.valor_bruto || 0);
  }

  const valorLiquido = Number(transferencia.valor || 0);
  return transferencia.tipo === "saque_plataforma"
    ? arredondarMoeda(valorLiquido + Number(transferencia.taxa || 0))
    : valorLiquido;
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

function tituloTipoSaque(tipoSaque) {
  if (tipoSaque === "instantaneo") return "Saque Instantâneo";
  if (tipoSaque === "agendado") return "Saque Agendado";
  return "Saque";
}

function normalizarPesquisa(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizarDescricaoRecebimentoSemanal(descricao, nomePlataforma = "") {
  const texto = String(descricao || "").trim();
  if (!texto) {
    return nomePlataforma
      ? `Recebimento semanal automático da plataforma ${nomePlataforma}`
      : "Recebimento semanal automático";
  }

  return texto.replace(
    /^Recebimento automático(?: semanal)?/i,
    "Recebimento semanal automático",
  );
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
      impactoSaldo: ganho.destino_financeiro === "plataforma" ? valor : 0,
      entradaId: ganho.entrada_id,
      dadosOriginais: ganho,
    };
  });

  const movimentosTransferencias = transferencias.flatMap((transferencia) => {
    const valorBruto = obterValorBrutoTransferencia(transferencia);
    const contaDestino = contasPorId[String(transferencia.conta_destino_id)] || "Conta";

    if (transferencia.tipo === "saque_plataforma") {
      const taxaRegistrada = taxasPorSaqueId.has(String(transferencia.id));
      const taxa = Number(
        taxasPorSaqueId.get(String(transferencia.id))?.valor_total
          || transferencia.taxa
          || 0,
      );
      return [{
        id: `saque-${transferencia.id}`,
        tipo: "saque",
        data: transferencia.data,
        created_at: transferencia.created_at,
        titulo: tituloTipoSaque(transferencia.tipo_saque),
        descricao: `Para ${contaDestino}`,
        valor: valorBruto,
        sinal: "saida",
        impactoSaldo: -valorBruto,
        taxa,
        valorLiquido: calcularValorLiquidoSaque(valorBruto, taxa),
        contaDestino,
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
        titulo: "Recebimento semanal automático",
        descricao: normalizarDescricaoRecebimentoSemanal(
          transferencia.descricao,
          plataforma?.nome,
        ),
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
        id: `recebimento-direto-${transferencia.id}`,
        tipo: "recebimento",
        data: transferencia.data || dataLancamento,
        created_at: transferencia.created_at,
        titulo: "Recebimento semanal automático",
        descricao: normalizarDescricaoRecebimentoSemanal(
          transferencia.descricao,
          plataforma?.nome,
        ),
        valor: valorBruto,
        sinal: "saida",
        impactoSaldo: 0,
        entradaId: ganho?.entrada_id,
        dadosOriginais: { ...transferencia, ganho },
      }];
    }

    return [];
  });

  return [
    ...movimentosGanhos,
    ...movimentosTransferencias,
  ].sort(compararMovimentacoes);
}

export function filtrarMovimentacoesPlataforma(movimentacoes, filtro) {
  if (!filtro || filtro === "todos") return movimentacoes || [];
  return (movimentacoes || []).filter((item) => item.tipo === filtro);
}

export function pesquisarMovimentacoesPlataforma(movimentacoes, pesquisa) {
  const termo = normalizarPesquisa(pesquisa).trim();
  if (!termo) return movimentacoes || [];

  return (movimentacoes || []).filter((item) => {
    const valor = Number(item.valor || 0);
    const data = String(item.data || "");
    const [ano, mes, dia] = data.split("-");
    const conteudo = [
      item.titulo,
      item.descricao,
      item.tipo,
      item.contaDestino,
      data,
      ano && mes && dia ? `${dia}/${mes}/${ano}` : "",
      valor.toFixed(2),
      valor.toFixed(2).replace(".", ","),
    ].map(normalizarPesquisa).join(" ");

    return conteudo.includes(termo);
  });
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
        (saldos.get(chave) || 0) - obterValorBrutoTransferencia(transferencia),
      ),
    );
  });

  return plataformas.map((plataforma) => ({
    ...plataforma,
    saldo: saldos.get(String(plataforma.id)) || 0,
  }));
}
