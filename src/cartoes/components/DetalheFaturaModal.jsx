import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import {
  ajustarVencimentoFimDeSemana,
  calcularCompetenciaFaturaPorVencimento,
  calcularStatusFaturaComPagamento,
  buscarFaturaAtivaPorCompetencia,
  somarMesesDataISO,
  TIPOS_CARTAO,
} from "../cartoesUtils";

import DatePickerModal from "../../components/modals/DatePickerModal";
import SelecionarFormaPagamentoModal from "../../components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../../components/modals/SelecionarContaModal";

export default function DetalheFaturaModal({
  fatura,
  cartao,
  contas,
  fechar,
  tituloFatura,
  saldoFatura,
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
  formatarDataBR,
  abrirAviso,
  recarregar,
}) {
  const hoje = new Date().toISOString().split("T")[0];

  const [faturaLocal, setFaturaLocal] = useState(fatura);
  const faturaAtual = faturaLocal || fatura;

  const [parcelas, setParcelas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalDataPagamentoAberto, setModalDataPagamentoAberto] = useState(false);
  const [modalFormaPagamentoAberto, setModalFormaPagamentoAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [confirmarParcial, setConfirmarParcial] = useState(false);
  const [pagamentoRegistrado, setPagamentoRegistrado] = useState(false);

  const [modalEditarFaturaAberto, setModalEditarFaturaAberto] = useState(false);
  const [modalMoverParcelaAberto, setModalMoverParcelaAberto] = useState(false);
  const [modalDataFechamentoAberto, setModalDataFechamentoAberto] = useState(false);
  const [modalDataVencimentoAberto, setModalDataVencimentoAberto] = useState(false);
  const [faturasDestino, setFaturasDestino] = useState([]);
  const [parcelaMovendo, setParcelaMovendo] = useState(null);
  const [faturaDestinoId, setFaturaDestinoId] = useState("");
  const [ajustarSequenciaParcelas, setAjustarSequenciaParcelas] = useState(true);
  const [editDataFechamento, setEditDataFechamento] = useState(fatura?.data_fechamento || hoje);
  const [editDataVencimento, setEditDataVencimento] = useState(fatura?.data_vencimento || hoje);
  const [editStatus, setEditStatus] = useState(fatura?.status || "aberta");
  const [salvandoEdicaoFatura, setSalvandoEdicaoFatura] = useState(false);
  const [movendoParcela, setMovendoParcela] = useState(false);
  const [editandoLancamentos, setEditandoLancamentos] = useState(false);
  const [parcelasSelecionadasIds, setParcelasSelecionadasIds] = useState([]);
  const [modoMovimento, setModoMovimento] = useState("item");
  const [avisoLocal, setAvisoLocal] = useState({
    aberto: false,
    titulo: "",
    mensagem: "",
    tipo: "info",
    fecharDepois: false,
  });

  function abrirAvisoLocal(titulo, mensagem, tipo = "info", fecharDepois = false) {
    setAvisoLocal({ aberto: true, titulo, mensagem, tipo, fecharDepois });
  }

  function fecharAvisoLocal() {
    const deveFecharModal = avisoLocal.fecharDepois;

    setAvisoLocal({
      aberto: false,
      titulo: "",
      mensagem: "",
      tipo: "info",
      fecharDepois: false,
    });

    if (deveFecharModal) {
      fechar?.();
    }
  }

  const [dataPagamento, setDataPagamento] = useState(hoje);
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [contaId, setContaId] = useState("");
  const [valorPago, setValorPago] = useState(numeroParaMoedaInput(saldoFatura(faturaAtual)));
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  const isCartaoTerceiro = (cartao?.tipo_cartao || TIPOS_CARTAO.PROPRIO) === TIPOS_CARTAO.TERCEIRO;

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const formasPagamento = [
  { valor: "dinheiro", titulo: "Dinheiro", descricao: "Pagamento em espécie" },
  { valor: "pix", titulo: "Pix", descricao: "Sai direto da conta" },
  { valor: "debito", titulo: "Débito", descricao: "Sai direto da conta" },
];

  useEffect(() => {
    setFaturaLocal(fatura);
    setEditDataFechamento(fatura?.data_fechamento || hoje);
    setEditDataVencimento(fatura?.data_vencimento || hoje);
    setEditStatus(fatura?.status || "aberta");
    setEditandoLancamentos(false);
    setParcelasSelecionadasIds([]);
    setModoMovimento("item");
  }, [fatura.id]);

  useEffect(() => {
    carregarParcelas();
  }, [faturaAtual.id]);

  useEffect(() => {
    const contaPrincipal = contas.find((conta) => conta.principal);
    if (contaPrincipal) setContaId(String(contaPrincipal.id));
    else if (contas[0]) setContaId(String(contas[0].id));
  }, [contas]);

  async function carregarParcelas() {
    setCarregando(true);

    const { data: parcelasData, error: erroParcelas } = await supabase
      .from("saidas_parcelas")
      .select("*")
      .eq("fatura_id", faturaAtual.id)
      .order("data_vencimento", { ascending: true })
      .order("id", { ascending: true });

    if (erroParcelas) {
      console.error(erroParcelas);
      setCarregando(false);
      return;
    }

    const saidaIds = (parcelasData || []).map((parcela) => parcela.saida_id);

    const { data: saidasData, error: erroSaidas } =
      saidaIds.length > 0
        ? await supabase
            .from("saidas")
            .select("*")
            .in("id", saidaIds)
        : { data: [], error: null };

    if (erroSaidas) {
      console.error(erroSaidas);
      setCarregando(false);
      return;
    }

    const lista = (parcelasData || [])
      .map((parcela) => ({
        ...parcela,
        saida: (saidasData || []).find((saida) => saida.id === parcela.saida_id),
      }))
      .sort((a, b) => {
        const dataA = a.saida?.data_compra || a.data_vencimento || "";
        const dataB = b.saida?.data_compra || b.data_vencimento || "";
        return new Date(dataA) - new Date(dataB);
      });

    setParcelas(lista);
    setParcelasSelecionadasIds((ids) => ids.filter((id) => lista.some((parcela) => String(parcela.id) === String(id))));
    setCarregando(false);
  }

  function textoFormaPagamento() {
    return formasPagamento.find((item) => item.valor === formaPagamento)?.titulo || "Selecionar";
  }

  function textoConta() {
    return contas.find((conta) => String(conta.id) === String(contaId))?.nome || "Selecionar conta";
  }

  function descricaoPagamento(valor) {
    const total = Number(faturaAtual.valor_total || 0);
    const jaPago = Number(faturaAtual.valor_pago || 0);
    const novoPago = jaPago + Number(valor || 0);
    const pagamentoTotal = novoPago >= total;

    if (pagamentoTotal) {
      return `Pagamento da fatura ${tituloFatura(faturaAtual)} do cartão ${cartao.nome}`;
    }

    return `Pagamento parcial da fatura ${tituloFatura(faturaAtual)} do cartão ${cartao.nome}`;
  }

 async function confirmarPagamento() {
  if (salvandoPagamento) return;

  const valor =
    Math.round(moedaParaNumero(valorPago) * 100) / 100;

  if (!dataPagamento) {
    abrirAvisoLocal("Data obrigatória", "Informe a data do pagamento.", "erro");
    return;
  }

  if (!formaPagamento) {
    abrirAvisoLocal("Forma obrigatória", "Informe a forma de pagamento.", "erro");
    return;
  }

  if (!contaId) {
    abrirAvisoLocal(
      "Conta obrigatória",
      "Escolha a conta usada para marcar a fatura como paga.",
      "erro"
    );
    return;
  }

  if (valor <= 0) {
    abrirAvisoLocal("Valor inválido", "Informe um valor maior que zero.", "erro");
    return;
  }

  const { data: faturaBanco, error: erroBuscaFatura } = await supabase
    .from("faturas_cartao")
    .select("*")
    .eq("id", faturaAtual.id)
    .maybeSingle();

  if (erroBuscaFatura || !faturaBanco) {
    abrirAvisoLocal(
      "Erro",
      "Não foi possível atualizar os dados da fatura.",
      "erro"
    );
    return;
  }

  const saldoReal =
    Math.round(
      (
        Number(faturaBanco.valor_total || 0) -
        Number(faturaBanco.valor_pago || 0)
      ) * 100
    ) / 100;

  if (valor > saldoReal) {
    abrirAvisoLocal(
      "Valor maior que a fatura",
      `O valor pago não pode ser maior que o saldo em aberto de ${formatarMoeda(
        saldoReal
      )}.`,
      "erro"
    );
    setValorPago(numeroParaMoedaInput(saldoReal));
    return;
  }

  if (valor < saldoReal && !confirmarParcial) {
    setConfirmarParcial(true);
    return;
  }

  setSalvandoPagamento(true);

  try {
    const descricao = descricaoPagamento(valor);

    const { error: erroSaida } = await supabase.from("saidas").insert({
      data_compra: dataPagamento,
      forma_pagamento: formaPagamento,
      conta_id: Number(contaId),
      cartao_id: null,
      tipo_credito: null,
      numero_parcelas: 1,
      valor_total: valor,
      valor_parcela: valor,
      data_efetivacao: dataPagamento,
      categoria: "Pagamento de Fatura",
      descricao,
      status: "pago",
      fatura_pagamento_id: faturaAtual.id,
    });

    if (erroSaida) throw erroSaida;

    const novoValorPago =
      Math.round(
        (Number(faturaBanco.valor_pago || 0) + valor) * 100
      ) / 100;

    const novoSaldo =
      Math.round(
        Math.max(
          Number(faturaBanco.valor_total || 0) - novoValorPago,
          0
        ) * 100
      ) / 100;

    const novoStatus = calcularStatusFaturaComPagamento({
      valorTotal: faturaBanco.valor_total,
      valorPago: novoValorPago,
      statusAnterior: faturaBanco.status,
      renegociacaoId: faturaBanco.renegociacao_id,
      dataFechamento: faturaBanco.data_fechamento,
      dataReferencia: dataPagamento,
    });

    const { error: erroFatura } = await supabase
      .from("faturas_cartao")
      .update({
        valor_pago: novoValorPago,
        status: novoStatus,
      })
      .eq("id", faturaAtual.id);

    if (erroFatura) throw erroFatura;

    if (novoStatus === "paga") {
      const { error: erroParcelas } = await supabase
        .from("saidas_parcelas")
        .update({ status: "paga" })
        .eq("fatura_id", faturaAtual.id);

      if (erroParcelas) throw erroParcelas;
    }

    const faturaAtualizada = {
      ...faturaBanco,
      valor_pago: novoValorPago,
      status: novoStatus,
    };

    setFaturaLocal(faturaAtualizada);
    setPagamentoRegistrado(true);
    setModalPagamentoAberto(false);
    setConfirmarParcial(false);
    setValorPago(numeroParaMoedaInput(novoSaldo));

    await recarregar();
    await carregarParcelas();

    if (novoStatus === "paga") {
      abrirAvisoLocal(
        "Pagamento registrado",
        "A fatura foi quitada e a saída foi lançada no extrato.",
        "info",
        true
      );
    }
  } catch (error) {
    console.error(error);
    abrirAvisoLocal("Erro", error.message || "Erro ao pagar fatura.", "erro");
  } finally {
    setSalvandoPagamento(false);
  }
}


  async function carregarFaturasDestino() {
    const { data, error } = await supabase
      .from("faturas_cartao")
      .select("*")
      .eq("cartao_id", Number(cartao.id))
      .in("status", ["aberta", "fechada", "parcial"])
      .order("data_vencimento", { ascending: true });

    if (error) {
      console.error(error);
      abrirAvisoLocal("Erro", "Erro ao carregar faturas do cartão.", "erro");
      return;
    }

    const faturasBanco = data || [];
    const existentesPorCompetencia = new Set(
      faturasBanco.map((item) => `${item.mes}-${item.ano}`)
    );

    const sugestoes = [];
    for (let index = 1; index <= 12; index++) {
      const vencimentoSugerido = somarMesesDataISO(faturaAtual.data_vencimento, index);
      const competencia = calcularCompetenciaPorVencimento(vencimentoSugerido);
      const chave = `${competencia.mes}-${competencia.ano}`;

      if (!existentesPorCompetencia.has(chave)) {
        sugestoes.push({
          id: `nova:${competencia.dataVencimento}`,
          mes: competencia.mes,
          ano: competencia.ano,
          data_fechamento: competencia.dataFechamento,
          data_vencimento: competencia.dataVencimento,
          nova: true,
        });
      }
    }

    setFaturasDestino([...faturasBanco, ...sugestoes].sort((a, b) => {
      return new Date(`${a.data_vencimento}T00:00:00`) - new Date(`${b.data_vencimento}T00:00:00`);
    }));
  }

  function calcularCompetenciaPorVencimento(dataVencimentoEscolhida) {
    return calcularCompetenciaFaturaPorVencimento({
      dataVencimento: dataVencimentoEscolhida,
      diaFechamento: cartao.dia_fechamento,
      diaVencimento: cartao.dia_vencimento,
    });
  }


  function validarIdNumerico(valor, contexto = "registro") {
    const id = Number(valor);

    if (!Number.isFinite(id) || id <= 0) {
      throw new Error(`ID inválido para ${contexto}. A operação foi interrompida para não gravar fatura_id nulo.`);
    }

    return id;
  }

  async function obterFaturaDestinoSelecionada() {
    const destinoSelecionado = String(faturaDestinoId || "");

    if (destinoSelecionado.startsWith("nova:")) {
      const dataVencimento = destinoSelecionado.replace("nova:", "");
      const faturaCriada = await buscarOuCriarFaturaDestino(dataVencimento, 0);
      validarIdNumerico(faturaCriada?.id, "fatura destino criada");
      return faturaCriada;
    }

    const idDestino = validarIdNumerico(destinoSelecionado, "fatura destino");

    const faturaNaLista = faturasDestino.find(
      (item) => String(item.id) === String(idDestino)
    );

    if (faturaNaLista?.id) {
      return faturaNaLista;
    }

    const { data: faturaBanco, error } = await supabase
      .from("faturas_cartao")
      .select("*")
      .eq("id", idDestino)
      .eq("cartao_id", Number(cartao.id))
      .in("status", ["aberta", "fechada", "parcial"])
      .maybeSingle();

    if (error) throw error;

    if (!faturaBanco?.id) {
      throw new Error("Fatura destino não encontrada.");
    }

    return faturaBanco;
  }

  async function buscarOuCriarFaturaDestino(dataVencimento, valorSomar = 0) {
    const competencia = calcularCompetenciaPorVencimento(dataVencimento);

    const { data: faturaExistente, error: erroBusca } = await buscarFaturaAtivaPorCompetencia(
      supabase,
      Number(cartao.id),
      competencia.mes,
      competencia.ano
    );

    if (erroBusca) throw erroBusca;

    if (faturaExistente) {
      return faturaExistente;
    }

    const { data: faturaCriada, error: erroCriar } = await supabase
      .from("faturas_cartao")
      .insert({
        cartao_id: Number(cartao.id),
        mes: competencia.mes,
        ano: competencia.ano,
        data_fechamento: competencia.dataFechamento,
        data_vencimento: competencia.dataVencimento,
        valor_total: Number(valorSomar || 0),
        valor_pago: 0,
        status: "aberta",
      })
      .select()
      .single();

    if (erroCriar) throw erroCriar;
    return faturaCriada;
  }

  async function moverSequenciaParcelas(parcelaInicial, faturaDestino) {
    const { data: parcelasCompra, error: erroParcelasCompra } = await supabase
      .from("saidas_parcelas")
      .select("*")
      .eq("saida_id", Number(parcelaInicial.saida_id))
      .gte("numero_parcela", Number(parcelaInicial.numero_parcela || 1))
      .order("numero_parcela", { ascending: true });

    if (erroParcelasCompra) throw erroParcelasCompra;

    const parcelasParaMover = parcelasCompra || [];
    const faturasAfetadas = new Set([String(faturaAtual.id)]);
    const vencimentoBase = faturaDestino?.data_vencimento || parcelaInicial.data_vencimento;

    for (let index = 0; index < parcelasParaMover.length; index++) {
      const parcela = parcelasParaMover[index];
      const vencimentoParcela = ajustarVencimentoFimDeSemana(somarMesesDataISO(vencimentoBase, index));
      const faturaParcela = index === 0 ? faturaDestino : await buscarOuCriarFaturaDestino(vencimentoParcela, 0);

      if (parcela.fatura_id) faturasAfetadas.add(String(parcela.fatura_id));
      if (faturaParcela?.id) faturasAfetadas.add(String(faturaParcela.id));

      const { error: erroUpdate } = await supabase
        .from("saidas_parcelas")
        .update({
          fatura_id: validarIdNumerico(faturaParcela?.id, "fatura da parcela"),
          data_vencimento: faturaParcela.data_vencimento || vencimentoParcela,
        })
        .eq("id", Number(parcela.id));

      if (erroUpdate) throw erroUpdate;
    }

    const { error: erroSaida } = await supabase
      .from("saidas")
      .update({ data_vencimento: faturaDestino.data_vencimento || vencimentoBase })
      .eq("id", Number(parcelaInicial.saida_id));

    if (erroSaida) throw erroSaida;

    return [...faturasAfetadas];
  }

  function abrirEditarFatura() {
    setEditDataFechamento(faturaAtual?.data_fechamento || hoje);
    setEditDataVencimento(faturaAtual?.data_vencimento || hoje);
    setEditStatus(faturaAtual?.status || "aberta");
    setModalEditarFaturaAberto(true);
  }

  async function salvarEdicaoFatura() {
    if (!editDataFechamento || !editDataVencimento) {
      abrirAvisoLocal("Datas obrigatórias", "Informe fechamento e vencimento da fatura.", "erro");
      return;
    }

    setSalvandoEdicaoFatura(true);

    try {
      const data = new Date(`${editDataVencimento}T00:00:00`);

      const payload = {
        data_fechamento: editDataFechamento,
        data_vencimento: editDataVencimento,
        mes: data.getMonth() + 1,
        ano: data.getFullYear(),
        status: editStatus,
      };

      const { data: atualizada, error } = await supabase
        .from("faturas_cartao")
        .update(payload)
        .eq("id", faturaAtual.id)
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("saidas_parcelas")
        .update({ data_vencimento: editDataVencimento })
        .eq("fatura_id", faturaAtual.id);

      setFaturaLocal({ ...faturaAtual, ...atualizada });
      setModalEditarFaturaAberto(false);
      await recarregar();
      await carregarParcelas();
      abrirAvisoLocal("Fatura atualizada", "As datas e o status da fatura foram atualizados.", "info", true);
    } catch (error) {
      console.error(error);
      abrirAvisoLocal("Erro", error.message || "Erro ao editar fatura.", "erro");
    } finally {
      setSalvandoEdicaoFatura(false);
    }
  }

  async function recalcularFatura(faturaId) {
    if (!faturaId) return { deletada: false, fatura: null };

    const { data: parcelasData, error: erroParcelas } = await supabase
      .from("saidas_parcelas")
      .select("valor_parcela")
      .eq("fatura_id", Number(faturaId));

    if (erroParcelas) throw erroParcelas;

    const quantidadeLancamentos = (parcelasData || []).length;
    const total = (parcelasData || []).reduce(
      (soma, parcela) => soma + Number(parcela.valor_parcela || 0),
      0
    );

    const { data: faturaBanco, error: erroBusca } = await supabase
      .from("faturas_cartao")
      .select("*")
      .eq("id", Number(faturaId))
      .maybeSingle();

    if (erroBusca) throw erroBusca;

    if (!faturaBanco) {
      return { deletada: true, fatura: null };
    }

    if (quantidadeLancamentos === 0 && total <= 0) {
      const { error: erroDelete } = await supabase
        .from("faturas_cartao")
        .delete()
        .eq("id", Number(faturaId));

      if (erroDelete) throw erroDelete;

      return { deletada: true, fatura: null };
    }

    const pago = Math.min(Number(faturaBanco.valor_pago || 0), total);
    const status = calcularStatusFaturaComPagamento({
      valorTotal: total,
      valorPago: pago,
      statusAnterior: faturaBanco.status,
      renegociacaoId: faturaBanco.renegociacao_id,
      dataFechamento: faturaBanco.data_fechamento,
    });

    const { data: faturaAtualizada, error: erroUpdate } = await supabase
      .from("faturas_cartao")
      .update({ valor_total: total, valor_pago: pago, status })
      .eq("id", Number(faturaId))
      .select()
      .single();

    if (erroUpdate) throw erroUpdate;

    return { deletada: false, fatura: faturaAtualizada };
  }

  function alternarParcelaSelecionada(parcelaId) {
    setParcelasSelecionadasIds((ids) =>
      ids.some((id) => String(id) === String(parcelaId))
        ? ids.filter((id) => String(id) !== String(parcelaId))
        : [...ids, parcelaId]
    );
  }

  function selecionarTodasParcelas() {
    if (parcelasSelecionadasIds.length === parcelas.length) {
      setParcelasSelecionadasIds([]);
      return;
    }

    setParcelasSelecionadasIds(parcelas.map((parcela) => parcela.id));
  }

  async function abrirMoverParcela(parcela) {
    setModoMovimento("item");
    setParcelaMovendo(parcela);
    setFaturaDestinoId("");
    setAjustarSequenciaParcelas(Number(parcela.numero_parcela || 1) === 1 && Number(parcela.total_parcelas || 1) > 1);
    await carregarFaturasDestino();
    setModalMoverParcelaAberto(true);
  }

  async function abrirMoverSelecionados() {
    if (parcelasSelecionadasIds.length === 0) {
      abrirAvisoLocal("Selecione lançamentos", "Marque pelo menos um lançamento para mover.", "erro");
      return;
    }

    setModoMovimento("selecionados");
    setParcelaMovendo(null);
    setFaturaDestinoId("");
    setAjustarSequenciaParcelas(false);
    await carregarFaturasDestino();
    setModalMoverParcelaAberto(true);
  }

  async function abrirMoverFaturaInteira() {
    if (parcelas.length === 0) {
      abrirAvisoLocal("Fatura vazia", "Esta fatura não possui lançamentos para mover.", "erro");
      return;
    }

    setModoMovimento("fatura");
    setParcelaMovendo(null);
    setFaturaDestinoId("");
    setAjustarSequenciaParcelas(false);
    await carregarFaturasDestino();
    setModalMoverParcelaAberto(true);
  }

  async function confirmarMoverParcela() {
    const movendoGrupo = modoMovimento === "selecionados" || modoMovimento === "fatura";

    if (!movendoGrupo && !parcelaMovendo) {
      abrirAvisoLocal("Lançamento", "Nenhum lançamento selecionado para mover.", "erro");
      return;
    }

    if (!faturaDestinoId) {
      abrirAvisoLocal("Fatura destino", "Selecione a fatura para onde o lançamento deve ir.", "erro");
      return;
    }

    if (String(faturaDestinoId) === String(faturaAtual.id)) {
      abrirAvisoLocal("Mesma fatura", "O lançamento já está nesta fatura.", "erro");
      return;
    }

    const idsParaMover = modoMovimento === "fatura"
      ? parcelas.map((parcela) => parcela.id)
      : modoMovimento === "selecionados"
        ? parcelasSelecionadasIds
        : [parcelaMovendo?.id].filter(Boolean);

    if (idsParaMover.length === 0) {
      abrirAvisoLocal("Selecione lançamentos", "Marque pelo menos um lançamento para mover.", "erro");
      return;
    }

    setMovendoParcela(true);

    try {
      const faturaDestino = await obterFaturaDestinoSelecionada();
      const faturaDestinoIdNumerico = validarIdNumerico(faturaDestino.id, "fatura destino");

      const deveAjustarSequencia =
        modoMovimento === "item" &&
        ajustarSequenciaParcelas &&
        Number(parcelaMovendo?.total_parcelas || 1) > 1 &&
        Number(parcelaMovendo?.numero_parcela || 1) === 1;

      let faturasAfetadas = [];

      if (deveAjustarSequencia) {
        faturasAfetadas = await moverSequenciaParcelas(parcelaMovendo, faturaDestino);
      } else {
        const faturasOrigemIds = parcelas
          .filter((parcela) => idsParaMover.some((id) => String(id) === String(parcela.id)))
          .map((parcela) => parcela.fatura_id)
          .filter(Boolean)
          .map(String);

        const { error } = await supabase
          .from("saidas_parcelas")
          .update({
            fatura_id: faturaDestinoIdNumerico,
            data_vencimento: faturaDestino.data_vencimento || parcelaMovendo?.data_vencimento || faturaAtual.data_vencimento,
          })
          .in("id", idsParaMover.map(Number));

        if (error) throw error;
        faturasAfetadas = [...faturasOrigemIds, String(faturaAtual.id), String(faturaDestinoIdNumerico)];
      }

      let resultadoOrigem = null;
      for (const faturaId of [...new Set(faturasAfetadas)]) {
        const resultado = await recalcularFatura(faturaId);
        if (String(faturaId) === String(faturaAtual.id)) resultadoOrigem = resultado;
      }

      setModalMoverParcelaAberto(false);
      setParcelaMovendo(null);
      setEditandoLancamentos(false);
      setFaturaDestinoId("");
      setAjustarSequenciaParcelas(true);
      setModoMovimento("item");
      setParcelasSelecionadasIds([]);

      await recarregar();

      if (resultadoOrigem?.deletada) {
        abrirAvisoLocal(
          modoMovimento === "fatura" ? "Fatura movida" : "Lançamentos movidos",
          modoMovimento === "fatura"
            ? "Todos os lançamentos foram movidos e a fatura que ficou vazia foi removida."
            : "Os lançamentos foram movidos e a fatura que ficou vazia foi removida.",
          "info",
          true
        );
        return;
      }

      if (resultadoOrigem?.fatura) {
        setFaturaLocal(resultadoOrigem.fatura);
      }

      await carregarParcelas();
      abrirAvisoLocal(
        modoMovimento === "fatura"
          ? "Fatura movida"
          : modoMovimento === "selecionados"
            ? "Lançamentos movidos"
            : "Lançamento movido",
        deveAjustarSequencia
          ? "A primeira parcela foi movida e as próximas parcelas foram recalculadas automaticamente."
          : modoMovimento === "fatura"
            ? "Todos os lançamentos da fatura foram movidos para outra fatura."
            : modoMovimento === "selecionados"
              ? "Os lançamentos selecionados foram movidos para outra fatura."
              : "O lançamento foi movido para outra fatura.",
        "info"
      );
    } catch (error) {
      console.error(error);
      abrirAvisoLocal("Erro", error.message || "Erro ao mover lançamento.", "erro");
    } finally {
      setMovendoParcela(false);
    }
  }

  const saldo = saldoFatura(faturaAtual);
  const faturaPaga = String(faturaAtual.status || "").toLowerCase() === "paga" || saldo <= 0;
  const valorPagamentoNumero = moedaParaNumero(valorPago);
  const faltaParaQuitar = Math.max(saldo - valorPagamentoNumero, 0);
  const pagamentoParcial = valorPagamentoNumero > 0 && valorPagamentoNumero < saldo;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div
          className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Fatura {tituloFatura(faturaAtual)}
              </h2>

              <div className="flex items-center gap-3 mt-2">
                <p className="text-gray-400">
                  {isCartaoTerceiro ? cartao.nome : `${cartao.nome} final ${cartao.final_cartao || "----"}`}
                </p>

                <span
                  className={`text-xs rounded-full px-3 py-1 font-bold capitalize ${
                    String(faturaAtual.status).toLowerCase() === "paga"
                      ? "bg-green-500/10 text-green-400"
                      : String(faturaAtual.status).toLowerCase() === "parcial"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {String(faturaAtual.status).toLowerCase() === "paga"
                    ? "Fatura paga"
                    : faturaAtual.status || "aberta"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!faturaPaga && (
                <button
                  type="button"
                  onClick={abrirEditarFatura}
                  className="rounded-xl border border-gray-700 hover:bg-white/5 text-white font-bold px-4 py-2"
                >
                  Editar fatura
                </button>
              )}

              <button
                type="button"
                onClick={fechar}
                className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                ×
              </button>
            </div>
          </div>

          {pagamentoRegistrado && !faturaPaga && (
            <div className="mt-6 bg-green-500/10 border border-green-500/40 rounded-xl p-4">
              <p className="font-bold text-green-400">Pagamento registrado</p>
              <p className="text-sm text-gray-300 mt-1">
                A saída foi lançada no extrato e a fatura foi atualizada.
              </p>
            </div>
          )}

          {faturaPaga && (
            <div className="mt-6 bg-green-500/10 border border-green-500/40 rounded-xl p-4">
              <p className="font-bold text-green-400">Fatura quitada</p>
              <p className="text-sm text-gray-300 mt-1">
                Esta fatura já está paga. Para alterar algo, exclua o pagamento no Extrato para reabrir a fatura.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6">
            <ResumoFatura titulo="Valor Total" valor={formatarMoeda(faturaAtual.valor_total)} />
            <ResumoFatura titulo="Pago" valor={formatarMoeda(faturaAtual.valor_pago)} />
            <ResumoFatura titulo="Em aberto" valor={formatarMoeda(saldo)} destaque={saldo > 0 ? "red" : "gray"} />
            <ResumoFatura titulo="Vencimento" valor={formatarDataBR(faturaAtual.data_vencimento)} />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Lançamentos da fatura</h3>
              {!faturaPaga && editandoLancamentos && (
                <p className="text-xs text-yellow-400 mt-1">
                  Modo edição ativo. Use apenas para corrigir lançamento que caiu na fatura errada.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!faturaPaga && editandoLancamentos && (
                <>
                  <button
                    type="button"
                    onClick={selecionarTodasParcelas}
                    className="rounded-xl border border-gray-700 hover:bg-white/5 text-white font-bold px-4 py-2"
                  >
                    {parcelasSelecionadasIds.length === parcelas.length ? "Limpar seleção" : "Selecionar tudo"}
                  </button>

                  <button
                    type="button"
                    onClick={abrirMoverSelecionados}
                    className="rounded-xl border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 font-bold px-4 py-2"
                  >
                    Mover selecionados
                  </button>

                  <button
                    type="button"
                    onClick={abrirMoverFaturaInteira}
                    className="rounded-xl border border-green-500/40 text-green-300 hover:bg-green-500/10 font-bold px-4 py-2"
                  >
                    Mover fatura
                  </button>
                </>
              )}

              {!faturaPaga && (
                <button
                  type="button"
                  onClick={() => {
                    setEditandoLancamentos((valor) => !valor);
                    setParcelasSelecionadasIds([]);
                  }}
                  className={`rounded-xl border px-4 py-2 font-bold transition ${
                    editandoLancamentos
                      ? "border-yellow-400 bg-yellow-500/10 text-yellow-400"
                      : "border-gray-700 hover:bg-white/5 text-white"
                  }`}
                >
                  {editandoLancamentos ? "Cancelar edição" : "Editar lançamentos"}
                </button>
              )}

              {!faturaPaga && saldo > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setValorPago(numeroParaMoedaInput(saldo));
                    setConfirmarParcial(false);
                    setModalPagamentoAberto(true);
                  }}
                  className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl px-4 py-2"
                >
                  Marcar como paga
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {carregando && (
              <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400">Carregando lançamentos...</p>
              </div>
            )}

            {!carregando && parcelas.length === 0 && (
              <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400">Nenhum lançamento encontrado nesta fatura.</p>
              </div>
            )}

            {parcelas.map((parcela) => {
              const saida = parcela.saida;
              const parcelado = Number(parcela.total_parcelas || 1) > 1;

              return (
                <div
                  key={parcela.id}
                  className={`bg-[#0B1120] border rounded-xl p-4 flex items-center justify-between gap-4 ${
                    parcelasSelecionadasIds.some((id) => String(id) === String(parcela.id))
                      ? "border-green-400/70"
                      : "border-gray-800"
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    {editandoLancamentos && (
                      <button
                        type="button"
                        onClick={() => alternarParcelaSelecionada(parcela.id)}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                          parcelasSelecionadasIds.some((id) => String(id) === String(parcela.id))
                            ? "border-green-400 bg-green-500 text-black"
                            : "border-gray-600 bg-[#111827] hover:border-green-400"
                        }`}
                        aria-label="Selecionar lançamento"
                      >
                        {parcelasSelecionadasIds.some((id) => String(id) === String(parcela.id)) ? "✓" : ""}
                      </button>
                    )}

                    <p className="min-w-0 text-sm">
                    <span className="text-gray-500">
                      {formatarDataBR(saida?.data_compra || parcela.data_vencimento)}
                    </span>

                    <span className="text-gray-600 mx-2">-</span>

                    <span className="font-bold">
                      {saida?.categoria || "-"}
                    </span>

                    <span className="text-gray-400">
                      {" "}
                      {parcelado
                        ? `Parcela [${parcela.numero_parcela}/${parcela.total_parcelas}] - `
                        : ""}
                      {saida?.descricao || "Compra no cartão"}
                    </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-white">
                      {formatarMoeda(parcela.valor_parcela)}
                    </p>

                    {editandoLancamentos && (
                      <button
                        type="button"
                        onClick={() => abrirMoverParcela(parcela)}
                        className="rounded-lg border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 px-3 py-2 text-xs font-bold"
                      >
                        Mover
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalEditarFaturaAberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Editar fatura</h2>
                <p className="text-gray-400 mt-2">Corrija fechamento, vencimento ou status.</p>
              </div>

              <button
                type="button"
                onClick={() => setModalEditarFaturaAberto(false)}
                className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-6">
              <CampoFatura label="Fechamento">
                <button
                  type="button"
                  onClick={() => setModalDataFechamentoAberto(true)}
                  className="w-full bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                >
                  {formatarDataBR(editDataFechamento)}
                </button>
              </CampoFatura>

              <CampoFatura label="Vencimento">
                <button
                  type="button"
                  onClick={() => setModalDataVencimentoAberto(true)}
                  className="w-full bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                >
                  {formatarDataBR(editDataVencimento)}
                </button>
              </CampoFatura>

              <CampoFatura label="Status">
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
                >
                  <option value="aberta">Aberta</option>
                  <option value="fechada">Fechada</option>
                  <option value="parcial">Parcial</option>
                  <option value="paga">Paga</option>
                </select>
              </CampoFatura>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => setModalEditarFaturaAberto(false)}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={salvarEdicaoFatura}
                disabled={salvandoEdicaoFatura}
                className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                {salvandoEdicaoFatura ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMoverParcelaAberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]">
          <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {modoMovimento === "fatura"
                    ? "Mover fatura"
                    : modoMovimento === "selecionados"
                      ? "Mover lançamentos"
                      : "Mover lançamento"}
                </h2>
                <p className="text-gray-400 mt-2">
                  Escolha a fatura destino. Se ela ainda não existir, o ControlDriver cria automaticamente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalMoverParcelaAberto(false);
                  setModoMovimento("item");
                  setParcelaMovendo(null);
                }}
                className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                ×
              </button>
            </div>

            {modoMovimento === "item" && parcelaMovendo && (
              <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">Lançamento</p>
                <p className="font-bold mt-1">{parcelaMovendo.saida?.descricao || parcelaMovendo.saida?.categoria || "Compra no cartão"}</p>
                <p className="text-green-400 font-bold mt-2">{formatarMoeda(parcelaMovendo.valor_parcela)}</p>
              </div>
            )}

            {modoMovimento !== "item" && (
              <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">{modoMovimento === "fatura" ? "Fatura completa" : "Selecionados"}</p>
                <p className="font-bold mt-1">
                  {modoMovimento === "fatura"
                    ? `${parcelas.length} lançamento(s) desta fatura`
                    : `${parcelasSelecionadasIds.length} lançamento(s) selecionado(s)`}
                </p>
              </div>
            )}

            <div className="mt-5">
              <label className="text-sm text-gray-300">Fatura destino</label>
              <select
                value={faturaDestinoId}
                onChange={(e) => setFaturaDestinoId(e.target.value)}
                className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
              >
                <option value="">Selecionar fatura</option>
                {faturasDestino
                  .filter((item) => String(item.id) !== String(faturaAtual.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {tituloFatura(item)} • vence {formatarDataBR(item.data_vencimento)}{item.nova ? " • nova" : ""}
                    </option>
                  ))}
              </select>
            </div>

            {parcelaMovendo && Number(parcelaMovendo.total_parcelas || 1) > 1 && Number(parcelaMovendo.numero_parcela || 1) === 1 && (
              <button
                type="button"
                onClick={() => setAjustarSequenciaParcelas((valor) => !valor)}
                className={`w-full mt-4 rounded-xl border p-4 text-left transition ${
                  ajustarSequenciaParcelas
                    ? "border-green-400 bg-green-500/10"
                    : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                }`}
              >
                <p className="font-bold text-white">
                  Recalcular próximas parcelas automaticamente
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Use quando a primeira parcela veio em outra fatura. O ControlDriver move a sequência inteira sem precisar corrigir uma por uma.
                </p>
              </button>
            )}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setModalMoverParcelaAberto(false);
                  setModoMovimento("item");
                  setParcelaMovendo(null);
                }}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarMoverParcela}
                disabled={movendoParcela}
                className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                {movendoParcela
                  ? "Movendo..."
                  : modoMovimento === "fatura"
                    ? "Mover fatura"
                    : modoMovimento === "selecionados"
                      ? "Mover selecionados"
                      : "Mover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPagamentoAberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Marcar como paga</h2>
                <p className="text-gray-400 mt-2">
                  Informe como a fatura será paga.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalPagamentoAberto(false);
                  setConfirmarParcial(false);
                }}
                className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="text-sm text-gray-300 block mb-2">Data do pagamento</label>
                <button
                  type="button"
                  onClick={() => setModalDataPagamentoAberto(true)}
                  className="w-full bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                >
                  {formatarDataBR(dataPagamento)}
                </button>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">Forma de pagamento</label>
                <button
                  type="button"
                  onClick={() => setModalFormaPagamentoAberto(true)}
                  className="w-full bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                >
                  {textoFormaPagamento()}
                </button>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">Conta</label>
                <button
                  type="button"
                  onClick={() => setModalContaAberto(true)}
                  className="w-full bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                >
                  {textoConta()}
                </button>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">Valor pago</label>

                <div className="flex items-center bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
                  <span className="px-3 text-gray-400">R$</span>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={valorPago}
                    placeholder="0,00"
                    onChange={(e) => {
                      setValorPago(formatarMoedaDigitada(e.target.value));
                      setConfirmarParcial(false);
                    }}
                    className="w-full bg-transparent p-3 outline-none"
                  />
                </div>
              </div>
            </div>

            <p className={`text-xs mt-3 ${pagamentoParcial ? "text-yellow-400" : "text-gray-500"}`}>
              {pagamentoParcial
                ? `Falta ${formatarMoeda(faltaParaQuitar)} para quitar a fatura.`
                : `Saldo em aberto: ${formatarMoeda(saldo)}`}
            </p>

            {confirmarParcial && (
              <div className="mt-4 bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4">
                <p className="font-bold text-yellow-400">Pagamento parcial</p>
                <p className="text-sm text-gray-300 mt-1">
                  Você está pagando apenas parte da fatura. Ela continuará em aberto com saldo restante.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setModalPagamentoAberto(false);
                  setConfirmarParcial(false);
                }}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarPagamento}
                disabled={salvandoPagamento}
                className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                {salvandoPagamento
                  ? "Salvando..."
                  : confirmarParcial
                  ? "Confirmar parcial"
                  : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
      <DatePickerModal
        aberto={modalDataFechamentoAberto}
        valor={editDataFechamento}
        onChange={setEditDataFechamento}
        onClose={() => setModalDataFechamentoAberto(false)}
        titulo="Data de fechamento"
        descricao="Escolha a data de fechamento da fatura."
      />

      <DatePickerModal
        aberto={modalDataVencimentoAberto}
        valor={editDataVencimento}
        onChange={setEditDataVencimento}
        onClose={() => setModalDataVencimentoAberto(false)}
        titulo="Data de vencimento"
        descricao="Escolha a data de vencimento da fatura."
      />

      <DatePickerModal
        aberto={modalDataPagamentoAberto}
        valor={dataPagamento}
        onChange={setDataPagamento}
        onClose={() => setModalDataPagamentoAberto(false)}
        titulo="Data do pagamento"
        descricao="Escolha a data em que a fatura foi paga."
      />

      <SelecionarFormaPagamentoModal
        aberto={modalFormaPagamentoAberto}
        formasPagamento={formasPagamento}
        formaPagamento={formaPagamento}
        onSelecionar={setFormaPagamento}
        onClose={() => setModalFormaPagamentoAberto(false)}
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contas}
        contaId={contaId}
        onSelecionar={setContaId}
        onClose={() => setModalContaAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      {avisoLocal.aberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2
              className={`text-2xl font-bold ${
                avisoLocal.tipo === "erro" ? "text-red-400" : "text-green-400"
              }`}
            >
              {avisoLocal.titulo}
            </h2>

            <p className="text-gray-300 mt-4">{avisoLocal.mensagem}</p>

            <button
              type="button"
              onClick={fecharAvisoLocal}
              className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

    </>
  );
}

function CampoFatura({ label, children }) {
  return (
    <div>
      <label className="text-sm text-gray-300 block mb-2">{label}</label>
      {children}
    </div>
  );
}

function ResumoFatura({ titulo, valor, destaque }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p
        className={`font-bold mt-1 ${
          destaque === "green"
            ? "text-green-400"
            : destaque === "red"
            ? "text-red-400"
            : destaque === "gray"
            ? "text-gray-500"
            : "text-white"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
