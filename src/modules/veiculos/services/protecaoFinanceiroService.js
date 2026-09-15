import {
  calcularParcelamentoBidirecional,
  gerarParcelasContrato,
  somarValoresParcelas,
  validarAgendaMensalContrato,
} from "../../contratos/utils/contratosFinanceiros.js";
import { criarCobrancaContrato } from "../../contratos/services/cobrancasContratosService.js";

const FORMAS_CREDITO = new Set(["credito_avista", "credito_parcelado"]);

function origemPrevista(formaPagamento, contaId, cartaoId) {
  if (FORMAS_CREDITO.has(formaPagamento)) {
    return { contaPagamentoId: null, cartaoPagamentoId: Number(cartaoId) };
  }
  if (formaPagamento === "boleto") {
    return { contaPagamentoId: null, cartaoPagamentoId: null };
  }
  return { contaPagamentoId: Number(contaId), cartaoPagamentoId: null };
}

function criarPlano({
  papel,
  tipoAgendamento,
  ordem,
  valorTotal = null,
  valorCobranca,
  quantidadeCobrancas,
  primeiroVencimento,
  periodicidade = null,
  fimRecorrencia = null,
  formaPagamento,
  contaId,
  cartaoId,
  parcelas,
}) {
  const origem = origemPrevista(formaPagamento, contaId, cartaoId);
  return {
    papel,
    tipoAgendamento,
    ordem,
    valorTotal,
    valorCobranca,
    quantidadeCobrancas,
    primeiroVencimento,
    periodicidade,
    fimRecorrencia,
    formaPagamento,
    ...origem,
    parcelas,
  };
}

function montarParcelamento(dados, origemPadrao) {
  const quantidade = Number(dados.numeroParcelas);
  const origem = dados.origemCalculo || origemPadrao;
  if (!Number.isInteger(quantidade) || quantidade < 2 || !["total", "parcela"].includes(origem)) {
    throw new Error("Informe uma quantidade válida de parcelas.");
  }
  const calculo = calcularParcelamentoBidirecional({
    quantidade,
    valorTotal: dados.valorTotal,
    valorParcela: dados.valorParcela,
    origem,
  });
  if (calculo.valoresParcelas.length !== quantidade) {
    throw new Error("Informe valores válidos para o parcelamento.");
  }

  const centavos = (valor) => Math.round(Number(valor || 0) * 100);
  if (origem === "total"
    && Number(dados.valorParcela || 0) > 0
    && centavos(dados.valorParcela) !== centavos(calculo.valorParcela)) {
    throw new Error("O valor da parcela não corresponde ao total informado.");
  }
  if (origem === "parcela"
    && Number(dados.valorTotal || 0) > 0
    && centavos(dados.valorTotal) !== centavos(calculo.valorTotal)) {
    throw new Error("O valor total não corresponde às parcelas informadas.");
  }

  const parcelas = gerarParcelasContrato({
    quantidade,
    valorParcela: calculo.valorParcela,
    primeiroVencimento: dados.primeiroVencimento,
  }).map((parcela, indice) => ({
    ...parcela,
    valor: calculo.valoresParcelas[indice],
  }));
  if (parcelas.length !== quantidade) {
    throw new Error("Informe uma data válida para o primeiro vencimento.");
  }
  return { ...calculo, quantidade, parcelas };
}

export function montarPlanosCobrancaProtecao(dados) {
  if (dados.formaContratacao === "pagamento_unico") {
    const valor = Number(dados.pagamentoUnico.valor);
    if (Math.round(valor * 100) <= 0) throw new Error("Informe um valor válido para o pagamento.");
    const vencimento = dados.pagamentoUnico.dataPagamento;
    const parcelas = gerarParcelasContrato({
      quantidade: 1,
      valorContratado: valor,
      primeiroVencimento: vencimento,
    });
    if (parcelas.length !== 1) throw new Error("Informe uma data válida para o pagamento.");
    return [criarPlano({
      papel: "principal",
      tipoAgendamento: "unica",
      ordem: 1,
      valorTotal: valor,
      valorCobranca: valor,
      quantidadeCobrancas: 1,
      primeiroVencimento: vencimento,
      formaPagamento: dados.pagamentoUnico.formaPagamento,
      contaId: dados.pagamentoUnico.contaId,
      cartaoId: dados.pagamentoUnico.cartaoId,
      parcelas,
    })];
  }

  if (dados.formaContratacao === "mensal") {
    const valor = Number(dados.mensal.valorMensal);
    if (Math.round(valor * 100) <= 0) throw new Error("Informe um valor mensal válido.");
    const parcelas = validarAgendaMensalContrato({
      inicioVigencia: dados.inicioVigencia,
      fimVigencia: dados.fimVigencia,
      primeiroVencimento: dados.mensal.primeiroVencimento,
      valorPadrao: valor,
      agenda: dados.mensal.agenda,
    });
    if (!dados.mensal.dataInicioControleFinanceiro) {
      throw new Error("Informe o primeiro vencimento que será controlado pelo ControlDriver.");
    }
    if (!parcelas.some((parcela) => parcela.vencimento === dados.mensal.dataInicioControleFinanceiro)) {
      throw new Error("O início do controle financeiro deve corresponder a um vencimento da agenda mensal.");
    }
    return [criarPlano({
      papel: "mensalidade",
      tipoAgendamento: "recorrente",
      ordem: 1,
      valorTotal: somarValoresParcelas(parcelas),
      valorCobranca: valor,
      quantidadeCobrancas: null,
      primeiroVencimento: dados.mensal.primeiroVencimento,
      periodicidade: "mensal",
      fimRecorrencia: dados.fimVigencia,
      formaPagamento: dados.mensal.formaPagamento,
      contaId: dados.mensal.contaId,
      cartaoId: dados.mensal.cartaoId,
      parcelas,
    })];
  }

  if (dados.formaContratacao === "parcelado") {
    const parcelamento = montarParcelamento(dados.parcelado, "total");
    return [criarPlano({
      papel: "principal",
      tipoAgendamento: "parcelada",
      ordem: 1,
      valorTotal: parcelamento.valorTotal,
      valorCobranca: parcelamento.valorParcela,
      quantidadeCobrancas: parcelamento.quantidade,
      primeiroVencimento: dados.parcelado.primeiroVencimento,
      periodicidade: "mensal",
      formaPagamento: dados.parcelado.formaPagamento,
      contaId: dados.parcelado.contaId,
      cartaoId: dados.parcelado.cartaoId,
      parcelas: parcelamento.parcelas,
    })];
  }

  const valorEntrada = Number(dados.entrada.valor);
  if (Math.round(valorEntrada * 100) <= 0) throw new Error("Informe um valor válido para a entrada.");
  const parcelamento = montarParcelamento(dados.parcelas, "parcela");
  const parcelasEntrada = gerarParcelasContrato({
    quantidade: 1,
    valorContratado: valorEntrada,
    primeiroVencimento: dados.entrada.dataPagamento,
  });
  if (parcelasEntrada.length !== 1) throw new Error("Informe uma data válida para a entrada.");
  return [
    criarPlano({
      papel: "entrada",
      tipoAgendamento: "unica",
      ordem: 1,
      valorTotal: valorEntrada,
      valorCobranca: valorEntrada,
      quantidadeCobrancas: 1,
      primeiroVencimento: dados.entrada.dataPagamento,
      formaPagamento: dados.entrada.formaPagamento,
      contaId: dados.entrada.contaId,
      cartaoId: dados.entrada.cartaoId,
      parcelas: parcelasEntrada,
    }),
    criarPlano({
      papel: "saldo",
      tipoAgendamento: "parcelada",
      ordem: 2,
      valorTotal: parcelamento.valorTotal,
      valorCobranca: parcelamento.valorParcela,
      quantidadeCobrancas: parcelamento.quantidade,
      primeiroVencimento: dados.parcelas.primeiroVencimento,
      periodicidade: "mensal",
      formaPagamento: dados.parcelas.formaPagamento,
      contaId: dados.parcelas.contaId,
      cartaoId: dados.parcelas.cartaoId,
      parcelas: parcelamento.parcelas,
    }),
  ];
}

async function buscarCategoriaSeguroId(supabase) {
  const { data, error } = await supabase
    .from("categorias")
    .select("id")
    .eq("nome", "Seguro")
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function criarCobrancasDoPlano(supabase, {
  contrato,
  plano,
  planoId,
  veiculoId,
  nomeVeiculo,
  categoriaId,
  materializarImediatamente,
}) {
  for (const parcela of plano.parcelas) {
    const { data: parcelaCriada, error: erroParcela } = await supabase
      .from("contratos_financeiros_parcelas")
      .insert({
        contrato_id: contrato.id,
        plano_cobranca_id: planoId,
        numero: parcela.numero,
        data_vencimento: parcela.vencimento,
        valor: parcela.valor,
        valor_pago: 0,
        status: "aberta",
      })
      .select()
      .single();
    if (erroParcela) throw erroParcela;

    if (materializarImediatamente) {
      await criarCobrancaContrato(supabase, {
        contratoId: contrato.id,
        parcelaId: parcelaCriada.id,
        dataVencimento: parcela.vencimento,
        valor: parcela.valor,
        formaPagamento: plano.formaPagamento,
        contaId: plano.contaPagamentoId,
        cartaoId: plano.cartaoPagamentoId,
        categoria: "Seguro",
        categoriaId,
        descricao: `${contrato.nome} - ${nomeVeiculo} (${parcela.numero}/${plano.parcelas.length})`,
        finalidade: "trabalho",
        veiculoId: Number(veiculoId),
      });
    }
  }
}

export async function salvarProtecaoComContrato(supabase, {
  veiculoId,
  nomeVeiculo,
  protecaoAnterior = null,
  acao = "",
  dados,
}) {
  const planos = montarPlanosCobrancaProtecao(dados);
  const parcelas = planos.flatMap((plano) => plano.parcelas);
  const valorTotal = somarValoresParcelas(parcelas);
  const primeiroVencimento = [...parcelas]
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))[0]?.vencimento || null;
  const categoriaId = await buscarCategoriaSeguroId(supabase);

  if (protecaoAnterior && ["renovar", "substituir"].includes(acao)) {
    const status = acao === "renovar" ? "renovada" : "substituida";
    const encerradaEm = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("veiculos_protecoes")
      .update({ ativo: false, status, encerrada_em: encerradaEm })
      .eq("id", protecaoAnterior.id);
    if (error) throw error;
    if (protecaoAnterior.contrato_financeiro_id) {
      const { error: erroContratoAnterior } = await supabase
        .from("contratos_financeiros")
        .update({ status: "cancelado", cancelado_em: encerradaEm, updated_at: new Date().toISOString() })
        .eq("id", protecaoAnterior.contrato_financeiro_id);
      if (erroContratoAnterior) throw erroContratoAnterior;
    }
  }

  const { data: contrato, error: erroContrato } = await supabase
    .from("contratos_financeiros")
    .insert({
      tipo_contrato: dados.tipoProtecao,
      nome: dados.nomeProtecao.trim(),
      contraparte_nome: dados.nomeProtecao.trim(),
      data_inicio: dados.inicioVigencia,
      data_fim: dados.fimVigencia,
      data_inicio_controle_financeiro: dados.formaContratacao === "mensal"
        ? dados.mensal.dataInicioControleFinanceiro
        : null,
      descricao: `${dados.tipoProtecao === "seguro" ? "Seguro" : "Proteção veicular"} - ${nomeVeiculo}`,
      status: "ativo",
    })
    .select()
    .single();
  if (erroContrato) throw erroContrato;

  const planoPrincipal = planos.find((plano) => plano.papel !== "entrada") || planos[0];
  const { data: protecao, error: erroProtecao } = await supabase
    .from("veiculos_protecoes")
    .insert({
      veiculo_id: Number(veiculoId),
      contrato_financeiro_id: contrato.id,
      tipo_protecao: dados.tipoProtecao,
      nome_protecao: dados.nomeProtecao.trim(),
      inicio_vigencia: dados.inicioVigencia,
      fim_vigencia: dados.fimVigencia,
      forma_pagamento: planoPrincipal.formaPagamento,
      valor_total: Math.round(valorTotal * 100) / 100,
      valor_parcela: planoPrincipal.valorCobranca,
      numero_parcelas: parcelas.length,
      parcelas_pagas: 0,
      primeiro_vencimento_pendente: primeiroVencimento,
      conta_id: planoPrincipal.contaPagamentoId,
      cartao_id: planoPrincipal.cartaoPagamentoId,
      lancamentos_gerados: true,
      ativo: true,
      status: "ativa",
      encerrada_em: null,
      substitui_protecao_id: protecaoAnterior && ["renovar", "substituir"].includes(acao)
        ? protecaoAnterior.id
        : null,
    })
    .select()
    .single();
  if (erroProtecao) throw erroProtecao;

  for (const plano of planos) {
    const { data: planoCriado, error: erroPlano } = await supabase
      .from("contratos_financeiros_planos_cobranca")
      .insert({
        contrato_id: contrato.id,
        papel: plano.papel,
        tipo_agendamento: plano.tipoAgendamento,
        ordem: plano.ordem,
        valor_total: plano.valorTotal,
        valor_cobranca: plano.valorCobranca,
        quantidade_cobrancas: plano.quantidadeCobrancas,
        primeiro_vencimento: plano.primeiroVencimento,
        periodicidade: plano.periodicidade,
        fim_recorrencia: plano.fimRecorrencia,
        forma_pagamento_prevista: plano.formaPagamento,
        conta_pagamento_id: plano.contaPagamentoId,
        cartao_pagamento_id: plano.cartaoPagamentoId,
      })
      .select()
      .single();
    if (erroPlano) throw erroPlano;

    await criarCobrancasDoPlano(supabase, {
      contrato,
      plano,
      planoId: planoCriado.id,
      veiculoId,
      nomeVeiculo,
      categoriaId,
      materializarImediatamente: plano.tipoAgendamento !== "recorrente",
    });
  }

  return protecao;
}
