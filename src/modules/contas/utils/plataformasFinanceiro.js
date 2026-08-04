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
