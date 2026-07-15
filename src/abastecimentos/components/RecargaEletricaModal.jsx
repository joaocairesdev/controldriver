import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";

import ModalBase from "../../components/modals/ModalBase";
import DatePickerModal from "../../components/modals/DatePickerModal";
import FeedbackModal from "../../components/modals/FeedbackModal";
import SelecionarVeiculoModal from "../../components/modals/SelecionarVeiculoModal";
import SelecionarFormaPagamentoModal from "../../components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../../components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../../components/modals/SelecionarCartaoModal";
import SelecionarParcelasModal from "../../components/modals/SelecionarParcelasModal";
import {
  ajustarVencimentoFimDeSemana,
  buscarFaturaPorCompetencia,
  calcularCompetenciaFaturaPorCompra,
  criarFaturaPadrao,
  dataComDiaSeguro,
  nomeCartaoComFinal,
  somarMesesData,
} from "../../cartoes/cartoesUtils";

export default function RecargaEletricaModal({
  aberto,
  onClose,
  veiculosPermitidos = null,
  edicao = null,
  onSalvo = null,
}) {
  const hoje = new Date().toISOString().split("T")[0];

  const formasPagamento = [
    { valor: "dinheiro", titulo: "Dinheiro", descricao: "Sai da carteira" },
    { valor: "pix", titulo: "Pix", descricao: "Sai direto da conta" },
    { valor: "debito", titulo: "Débito", descricao: "Sai direto da conta" },
    { valor: "credito_avista", titulo: "Crédito à Vista", descricao: "Entra na próxima fatura do cartão" },
    { valor: "credito_parcelado", titulo: "Crédito Parcelado", descricao: "Divide em 2x ou mais no cartão" },
    { valor: "boleto", titulo: "Boleto", descricao: "Registra uma conta a pagar" },
  ];

  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);

  const [dataCompra, setDataCompra] = useState(hoje);
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [dataVencimento, setDataVencimento] = useState(hoje);

  const [valorTotal, setValorTotal] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState("1");
  const [valorParcela, setValorParcela] = useState("");
  const [ultimoCampoEditado, setUltimoCampoEditado] = useState("total");

  const [veiculoId, setVeiculoId] = useState("");
  const [kwh, setKwh] = useState("");
  const [valorKwh, setValorKwh] = useState("");
  const [modoKm, setModoKm] = useState("trip");
  const [kmRodados, setKmRodados] = useState("");
  const [odometro, setOdometro] = useState("");
  const [localRecarga, setLocalRecarga] = useState("");

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalVencimentoAberto, setModalVencimentoAberto] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [modalVeiculoAberto, setModalVeiculoAberto] = useState(false);
  const [modalParcelasAberto, setModalParcelasAberto] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
    fecharDepois: false,
  });

  const isCredito =
    formaPagamento === "credito_avista" ||
    formaPagamento === "credito_parcelado";
  const isCreditoParcelado = formaPagamento === "credito_parcelado";
  const isBoleto = formaPagamento === "boleto";
  const isDinheiro = formaPagamento === "dinheiro";

  const veiculoSelecionado = useMemo(
    () => veiculos.find((v) => String(v.id) === String(veiculoId)),
    [veiculos, veiculoId]
  );

  const contaSelecionada = useMemo(
    () => contas.find((c) => String(c.id) === String(contaId)),
    [contas, contaId]
  );

  const carteiraSelecionada = useMemo(
    () => contas.find((c) => c.tipo_conta === "carteira"),
    [contas]
  );

  const contasBancarias = useMemo(
    () => contas.filter((c) => (c.tipo_conta || "banco") === "banco"),
    [contas]
  );

  const cartaoSelecionado = useMemo(
    () => cartoes.find((c) => String(c.id) === String(cartaoId)),
    [cartoes, cartaoId]
  );

  useEffect(() => {
    if (!aberto) return;
    carregarDados();
    if (!edicao) limparFormulario(false);
  }, [aberto, veiculosPermitidos, edicao?.id]);

  useEffect(() => {
    if (!aberto || !edicao?.id || !edicao?.recargaEletrica) return;
    const r = edicao.recargaEletrica;
    setDataCompra(edicao.data_compra || hoje);
    setDataVencimento(edicao.data_vencimento || edicao.data_compra || hoje);
    setFormaPagamento(edicao.forma_pagamento || "pix");
    setContaId(edicao.conta_id ? String(edicao.conta_id) : "");
    setCartaoId(edicao.cartao_id ? String(edicao.cartao_id) : "");
    setValorTotal(numeroParaMoedaInput(edicao.valor_total || 0));
    setValorParcela(numeroParaMoedaInput(edicao.valor_parcela || edicao.valor_total || 0));
    setNumeroParcelas(String(edicao.numero_parcelas || 1));
    setVeiculoId(r.veiculo_id ? String(r.veiculo_id) : "");
    setKwh(numeroParaMoedaInput(r.kwh || 0));
    setValorKwh(numeroParaMoedaInput(r.valor_kwh || 0));
    setModoKm("trip");
    setKmRodados(String(Number(r.km_rodados || 0)));
    setOdometro(String(Number(r.odometro || 0)));
    setLocalRecarga(r.local_recarga || "");
  }, [aberto, edicao?.id, edicao?.recargaEletrica?.id]);

  useEffect(() => {
    if (isDinheiro && carteiraSelecionada) {
      setContaId(String(carteiraSelecionada.id));
      setCartaoId("");
    }
  }, [isDinheiro, carteiraSelecionada]);

  useEffect(() => {
    if (!isCreditoParcelado) return;

    const total = moedaParaNumero(valorTotal);
    const parcelas = Number(numeroParcelas || 1);

    if (ultimoCampoEditado === "total" && total > 0 && parcelas > 0) {
      setValorParcela(numeroParaMoedaInput(total / parcelas));
    }
  }, [valorTotal, numeroParcelas, isCreditoParcelado, ultimoCampoEditado]);

  useEffect(() => {
    if (!isCreditoParcelado) return;

    const parcela = moedaParaNumero(valorParcela);
    const parcelas = Number(numeroParcelas || 1);

    if (ultimoCampoEditado === "parcela" && parcela > 0 && parcelas > 0) {
      setValorTotal(numeroParaMoedaInput(parcela * parcelas));
    }
  }, [valorParcela, numeroParcelas, isCreditoParcelado, ultimoCampoEditado]);

  useEffect(() => {
    const total = moedaParaNumero(valorTotal);
    const quantidadeKwh = decimalParaNumero(kwh);

    if (total > 0 && quantidadeKwh > 0) {
      setValorKwh(numeroParaMoedaInput(total / quantidadeKwh));
    }
  }, [valorTotal, kwh]);

  async function carregarContasComSaldo(contasBase) {
    return Promise.all(
      (contasBase || []).map(async (conta) => {
        const contaIdAtual = conta.id;

        const { data: entradas } = await supabase
          .from("entradas")
          .select(`entrada_plataformas (faturamento, valor_reembolso)`)
          .eq("conta_id", contaIdAtual);

        const totalEntradas = (entradas || []).reduce(
          (total, entrada) =>
            total +
            (entrada.entrada_plataformas || []).reduce(
              (soma, item) =>
                soma +
                Number(item.faturamento || 0) +
                Number(item.valor_reembolso || 0),
              0
            ),
          0
        );

        const { data: entradasAvulsas } = await supabase
          .from("entradas_avulsas")
          .select("valor")
          .eq("conta_id", contaIdAtual);

        const totalEntradasAvulsas = (entradasAvulsas || []).reduce(
          (total, entrada) => total + Number(entrada.valor || 0),
          0
        );

        const { data: recebidas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_destino_id", contaIdAtual);

        const totalRecebidas = (recebidas || []).reduce(
          (total, item) => total + Number(item.valor || 0),
          0
        );

        const { data: enviadas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_origem_id", contaIdAtual);

        const totalEnviadas = (enviadas || []).reduce(
          (total, item) => total + Number(item.valor || 0),
          0
        );

        const { data: saidas } = await supabase
          .from("saidas")
          .select("valor_total, tipo_movimentacao")
          .eq("conta_id", contaIdAtual);

        const totalSaidas = (saidas || [])
          .filter((saida) => saida.tipo_movimentacao !== "conta_pagar")
          .reduce((total, saida) => total + Number(saida.valor_total || 0), 0);

        return {
          ...conta,
          tipo_conta: conta.tipo_conta || "banco",
          saldo_atual:
            Number(conta.saldo_inicial || 0) +
            totalEntradas +
            totalEntradasAvulsas +
            totalRecebidas -
            totalSaidas -
            totalEnviadas,
        };
      })
    );
  }

  async function carregarDados() {
    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const { data: cartoesData } = await supabase
      .from("cartoes")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const { data: veiculosData } = await supabase
      .from("veiculos")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const contasComSaldo = await carregarContasComSaldo(contasData || []);
    const cartoesComUso = await carregarUsoDosCartoes(cartoesData || []);
    const listaVeiculos = (veiculosPermitidos || veiculosData || []).filter(
      (veiculo) => veiculo.aceita_recarga_eletrica
    );

    setContas(contasComSaldo);
    setCartoes(cartoesComUso);
    setVeiculos(listaVeiculos);

    const carteira = contasComSaldo.find((c) => c.tipo_conta === "carteira");
    const principal = contasComSaldo.find((c) => c.principal);
    const veiculoPrincipal =
      listaVeiculos.find((v) => v.principal) || listaVeiculos[0];

    if (formaPagamento === "dinheiro" && carteira) setContaId(String(carteira.id));
    else if (principal) setContaId(String(principal.id));

    if (veiculoPrincipal) setVeiculoId(String(veiculoPrincipal.id));
  }

  async function carregarUsoDosCartoes(listaCartoes) {
    if (!listaCartoes.length) return [];

    const ids = listaCartoes.map((cartao) => cartao.id);

    const { data: faturasData } = await supabase
      .from("faturas_cartao")
      .select("cartao_id, valor_total, status")
      .in("cartao_id", ids)
      .in("status", ["aberta", "fechada"]);

    return listaCartoes.map((cartao) => ({
      ...cartao,
      usado: (faturasData || [])
        .filter((fatura) => Number(fatura.cartao_id) === Number(cartao.id))
        .reduce((total, fatura) => total + Number(fatura.valor_total || 0), 0),
    }));
  }

  function limparFormulario(limparTudo = true) {
    setDataCompra(hoje);
    setDataVencimento(hoje);
    setFormaPagamento("pix");
    setValorTotal("");
    setNumeroParcelas("1");
    setValorParcela("");
    setUltimoCampoEditado("total");
    setKwh("");
    setValorKwh("");
    setModoKm("trip");
    setKmRodados("");
    setOdometro("");
    setLocalRecarga("");
    setCartaoId("");

    if (limparTudo) {
      setContaId("");
      setVeiculoId("");
    }
  }

  function formatarDataBR(dataISO) {
    if (!dataISO) return "";
    const [ano, mes, dia] = String(dataISO).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarMoedaDigitada(valor) {
    const somenteDigitos = String(valor || "").replace(/\D/g, "");
    const centavos = Number(somenteDigitos || 0);

    return (centavos / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatarDecimalDigitado(valor, casas = 3) {
    return String(valor)
      .replace(/[^\d,]/g, "")
      .replace(/,+/g, ",")
      .replace(/^,/, "")
      .replace(new RegExp(`(,\\d{${casas}}).+`), "$1");
  }

  function moedaParaNumero(valor) { if (!valor) return 0; return Number(String(valor).replace(/\./g, "").replace(",", ".")); }

  function decimalParaNumero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(",", "."));
  }

  function numeroParaMoedaInput(valor) {
    return Number(valor || 0).toFixed(2).replace(".", ",");
  }

  function numeroParaDecimalInput(valor, casas = 2) {
    if (!Number.isFinite(Number(valor))) return "";
    return Number(valor || 0).toFixed(casas).replace(".", ",");
  }

  function somenteNumeros(valor) {
    return String(valor).replace(/\D/g, "");
  }

  function textoFormaPagamento() {
    return formasPagamento.find((f) => f.valor === formaPagamento)?.titulo || "Selecionar";
  }

  function textoContaCartao() {
    if (isCredito) {
      return cartaoSelecionado
        ? nomeCartaoComFinal(cartaoSelecionado)
        : "Selecionar cartão";
    }

    if (isDinheiro) return carteiraSelecionada?.nome || "Carteira";

    return contaSelecionada?.nome || "Selecionar conta";
  }

  function atualizarValorTotal(valor) {
    setUltimoCampoEditado("total");
    setValorTotal(formatarMoedaDigitada(valor));
  }

  function atualizarKmRodados(valor) {
    const km = somenteNumeros(valor);
    setKmRodados(km);

    if (modoKm === "trip" && veiculoSelecionado) {
      setOdometro(
        String(Number(veiculoSelecionado.odometro_atual || 0) + Number(km || 0))
      );
    }
  }

  function atualizarOdometro(valor) {
    const novo = somenteNumeros(valor);
    setOdometro(novo);

    if (modoKm === "odometro" && veiculoSelecionado) {
      setKmRodados(
        String(
          Math.max(
            Number(novo || 0) - Number(veiculoSelecionado.odometro_atual || 0),
            0
          )
        )
      );
    }
  }

  function custoPorKwh() {
    const total = moedaParaNumero(valorTotal);
    const quantidadeKwh = decimalParaNumero(kwh);
    return total > 0 && quantidadeKwh > 0 ? total / quantidadeKwh : 0;
  }

  function kmPorKwh() {
    const km = Number(kmRodados || 0);
    const quantidadeKwh = decimalParaNumero(kwh);
    return km > 0 && quantidadeKwh > 0 ? km / quantidadeKwh : 0;
  }

  function custoPorKm() {
    const km = Number(kmRodados || 0);
    const total = moedaParaNumero(valorTotal);
    return km > 0 && total > 0 ? total / km : 0;
  }

  function abrirFeedback(tipo, titulo, mensagem, fecharDepois = false) {
    setFeedback({ aberto: true, tipo, titulo, mensagem, fecharDepois });
  }

  async function fecharFeedback() {
    const fechar = feedback.fecharDepois;

    setFeedback({
      aberto: false,
      tipo: "sucesso",
      titulo: "",
      mensagem: "",
      fecharDepois: false,
    });

    if (fechar) {
      if (edicao?.id) await onSalvo?.();
      onClose();
    }
  }

  function definirContaBancariaPadrao() {
    const conta = contasBancarias.find((c) => c.principal) || contasBancarias[0];
    if (conta) setContaId(String(conta.id));
  }

  function definirStatus() {
    if (isBoleto) return "aberto";
    if (isCredito) return "fatura";
    return "pago";
  }

  function definirTipoMovimentacao() {
    if (isBoleto) return "conta_pagar";
    return "saida";
  }

  async function buscarOuCriarFatura({ cartao, dataBase }) {
    const comp = calcularCompetenciaFaturaPorCompra(dataBase, cartao);

    const dataFechamento = ajustarVencimentoFimDeSemana(
      dataComDiaSeguro(
        comp.anoFechamento,
        comp.mesFechamento,
        cartao.dia_fechamento
      )
    );

    const dataVencimento = dataComDiaSeguro(
      comp.ano,
      comp.mes,
      cartao.dia_vencimento
    );

    const { data: existente, error: erroBusca } = await buscarFaturaPorCompetencia(
      supabase,
      Number(cartao.id),
      comp.mes,
      comp.ano
    );

    if (erroBusca) throw erroBusca;
    if (existente) return existente;

    const { data, error } = await criarFaturaPadrao(supabase, {
      cartao_id: Number(cartao.id),
      mes: comp.mes,
      ano: comp.ano,
      data_fechamento: dataFechamento,
      data_vencimento: dataVencimento,
    });

    if (error) throw error;
    return data;
  }

  
  async function recalcularFaturaPorParcelas(faturaId) {
    if (!faturaId) return;

    const idFatura = Number(faturaId);

    const { data: parcelas, error: erroParcelas } = await supabase
      .from("saidas_parcelas")
      .select("valor_parcela")
      .eq("fatura_id", idFatura);

    if (erroParcelas) throw erroParcelas;

    const total = Math.round(
      (parcelas || []).reduce((soma, parcela) => soma + Number(parcela.valor_parcela || 0), 0) * 100
    ) / 100;

    const { data: fatura, error: erroFatura } = await supabase
      .from("faturas_cartao")
      .select("valor_pago, status")
      .eq("id", idFatura)
      .maybeSingle();

    if (erroFatura) throw erroFatura;
    if (!fatura) return;

    if (total <= 0) {
      const { error: erroDelete } = await supabase
        .from("faturas_cartao")
        .delete()
        .eq("id", idFatura);

      if (erroDelete) throw erroDelete;
      return;
    }

    const valorPago = Math.min(Number(fatura.valor_pago || 0), total);
    const statusAnterior = String(fatura.status || "aberta").toLowerCase();
    const novoStatus =
      valorPago >= total
        ? "paga"
        : valorPago > 0
        ? "parcial"
        : statusAnterior === "fechada"
        ? "fechada"
        : "aberta";

    const { error: erroUpdate } = await supabase
      .from("faturas_cartao")
      .update({
        valor_total: total,
        valor_pago: valorPago,
        status: novoStatus,
      })
      .eq("id", idFatura);

    if (erroUpdate) throw erroUpdate;
  }

  async function recalcularFaturasDaSaida(saidaId) {
    if (!saidaId) return;

    const { data: parcelas, error } = await supabase
      .from("saidas_parcelas")
      .select("fatura_id")
      .eq("saida_id", Number(saidaId));

    if (error) throw error;

    const ids = [...new Set((parcelas || []).map((parcela) => parcela.fatura_id).filter(Boolean))];

    for (const faturaId of ids) {
      await recalcularFaturaPorParcelas(faturaId);
    }
  }

async function atualizarValorFatura(faturaId, valorSomar) {
    const { data, error } = await supabase
      .from("faturas_cartao")
      .select("valor_total")
      .eq("id", faturaId)
      .single();

    if (error) throw error;

    const { error: erroUpdate } = await supabase
      .from("faturas_cartao")
      .update({
        valor_total: Number(data.valor_total || 0) + Number(valorSomar || 0),
      })
      .eq("id", faturaId);

    if (erroUpdate) throw erroUpdate;
  }

    async function ajustarFaturasAoRemoverParcelasDaSaida(saidaId) {
    const { data: parcelas, error: erroParcelasBusca } = await supabase
      .from("saidas_parcelas")
      .select("fatura_id")
      .eq("saida_id", Number(saidaId));

    if (erroParcelasBusca) throw erroParcelasBusca;

    const faturasAfetadas = [
      ...new Set((parcelas || []).map((parcela) => parcela.fatura_id).filter(Boolean)),
    ];

    const { error: erroExcluirParcelas } = await supabase
      .from("saidas_parcelas")
      .delete()
      .eq("saida_id", Number(saidaId));

    if (erroExcluirParcelas) throw erroExcluirParcelas;

    for (const faturaId of faturasAfetadas) {
      await recalcularFaturaPorParcelas(faturaId);
    }
  }

  async function gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas) {
    if (!isCredito || !cartaoSelecionado) return;

    const payload = [];

    for (let i = 0; i < parcelas; i++) {
      const dataBase = somarMesesData(dataCompra, i).toISOString().split("T")[0];

      const fatura = await buscarOuCriarFatura({
        cartao: cartaoSelecionado,
        dataBase,
      });

      await atualizarValorFatura(fatura.id, parcelaValor);

      payload.push({
        saida_id: saidaId,
        cartao_id: Number(cartaoId),
        fatura_id: fatura.id,
        numero_parcela: i + 1,
        total_parcelas: parcelas,
        valor_parcela: parcelaValor,
        data_vencimento: fatura.data_vencimento,
        status: "pendente",
      });
    }

    if (payload.length) {
      const { error } = await supabase.from("saidas_parcelas").insert(payload);
      if (error) throw error;
      await recalcularFaturasDaSaida(saidaId);
    }
  }

  async function verificarLimiteCartao(total) {
    if (!cartaoSelecionado) return true;

    const { data, error } = await supabase
      .from("faturas_cartao")
      .select("valor_total")
      .eq("cartao_id", Number(cartaoId))
      .in("status", ["aberta", "fechada"]);

    if (error) throw error;

    const usado = (data || []).reduce(
      (totalAtual, fatura) => totalAtual + Number(fatura.valor_total || 0),
      0
    );

    const disponivel = Number(cartaoSelecionado.limite_total || 0) - usado;

    if (Number(cartaoSelecionado.limite_total || 0) > 0 && total > disponivel) {
      return window.confirm(
        "⚠ Esta recarga ultrapassará o limite do cartão.\n\nDeseja continuar mesmo assim?"
      );
    }

    return true;
  }

  function validar() {
    if (!dataCompra || !valorTotal || !veiculoId || !kwh) {
      abrirFeedback(
        "erro",
        "Campos obrigatórios",
        "Preencha data, veículo, valor total e kWh carregado."
      );
      return false;
    }

    if (isCredito && !cartaoId) {
      abrirFeedback("erro", "Cartão obrigatório", "Selecione um cartão.");
      return false;
    }

    if (isDinheiro && !carteiraSelecionada) {
      abrirFeedback(
        "erro",
        "Carteira não encontrada",
        "Cadastre uma carteira antes de lançar dinheiro."
      );
      return false;
    }

    if (!isCredito && !isBoleto && !contaId) {
      abrirFeedback("erro", "Conta obrigatória", "Selecione uma conta.");
      return false;
    }

    if (isBoleto && !dataVencimento) {
      abrirFeedback("erro", "Vencimento obrigatório", "Informe a data de vencimento.");
      return false;
    }

    if (isCreditoParcelado && Number(numeroParcelas || 0) < 2) {
      abrirFeedback("erro", "Parcelamento inválido", "Crédito parcelado precisa começar em 2x.");
      return false;
    }

    if (!kmRodados && !odometro) {
      abrirFeedback("erro", "KM obrigatório", "Informe o KM rodado ou o odômetro.");
      return false;
    }

    if (
      modoKm === "odometro" &&
      veiculoSelecionado &&
      Number(odometro || 0) < Number(veiculoSelecionado.odometro_atual || 0)
    ) {
      abrirFeedback(
        "erro",
        "Odômetro inválido",
        `O odômetro não pode ser menor que ${Number(
          veiculoSelecionado.odometro_atual || 0
        ).toLocaleString("pt-BR")} km.`
      );
      return false;
    }

    return true;
  }

  async function salvar() {
    if (!validar()) return;

    const total = moedaParaNumero(valorTotal);
    const parcelas = isCreditoParcelado ? Number(numeroParcelas || 2) : 1;
    const parcelaValor = isCreditoParcelado
      ? moedaParaNumero(valorParcela)
      : total;

    if (isCredito && !(await verificarLimiteCartao(total))) return;

    setSalvando(true);

    try {
      const dadosSaida = {
          data_compra: dataCompra,
          forma_pagamento: formaPagamento,
          tipo_movimentacao: definirTipoMovimentacao(),
          conta_id: isCredito || isBoleto ? null : Number(contaId),
          cartao_id: isCredito ? Number(cartaoId) : null,
          tipo_credito: isCredito
            ? isCreditoParcelado
              ? "parcelado"
              : "avista"
            : null,
          numero_parcelas: parcelas,
          valor_total: total,
          valor_parcela: parcelaValor,
          data_efetivacao: isBoleto ? null : dataCompra,
          data_vencimento: isBoleto ? dataVencimento : null,
          categoria: "Recarga Elétrica",
          descricao: `Recarga elétrica - ${veiculoSelecionado?.nome || "Veículo"}`,
          status: definirStatus(),
        };
      let saidaId = edicao?.id || null;
      if (saidaId) {
        await ajustarFaturasAoRemoverParcelasDaSaida(saidaId);

        const { error: erroSaida } = await supabase.from("saidas").update(dadosSaida).eq("id", saidaId);
        if (erroSaida) throw erroSaida;

        if (isCredito) await gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas);

        await supabase.from("saidas_recargas_eletricas").delete().eq("saida_id", saidaId);
      } else {
        const { data: saidaCriada, error: erroSaida } = await supabase
          .from("saidas")
          .insert(dadosSaida)
          .select()
          .single();
        if (erroSaida) throw erroSaida;
        saidaId = saidaCriada.id;
        if (isCredito) {
          await gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas);
        }
      }

      await salvarDetalhesRecarga(saidaId);

      abrirFeedback(
        "sucesso",
        edicao?.id ? "Recarga atualizada" : isBoleto ? "Conta registrada" : "Recarga salva",
        isBoleto
          ? "Conta a pagar registrada com sucesso."
          : "Recarga elétrica lançada com sucesso.",
        true
      );

      limparFormulario(false);
    } catch (error) {
      console.error(error);
      abrirFeedback(
        "erro",
        "Erro ao salvar",
        error.message || "Erro ao salvar recarga elétrica."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function salvarDetalhesRecarga(saidaId) {
    const odometroFinal = Number(odometro || 0);
    const quantidadeKwh = decimalParaNumero(kwh);
    const kmPeriodo = Number(kmRodados || 0);

    const { error } = await supabase.from("saidas_recargas_eletricas").insert({
      saida_id: saidaId,
      veiculo_id: Number(veiculoId),
      odometro: odometroFinal,
      km_rodados: kmPeriodo,
      kwh: quantidadeKwh,
      valor_kwh: custoPorKwh(),
      custo_por_km: custoPorKm(),
      km_por_kwh: kmPorKwh(),
      local_recarga: localRecarga.trim() || null,
    });

    if (error) throw error;

    if (odometroFinal > Number(veiculoSelecionado?.odometro_atual || 0)) {
      await supabase
        .from("veiculos")
        .update({ odometro_atual: odometroFinal })
        .eq("id", Number(veiculoId));
    }
  }

  if (!aberto) return null;

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo="Recarga Elétrica"
        descricao="Registre recargas de veículos elétricos ou híbridos plug-in."
        onClose={onClose}
        largura="max-w-5xl"
      
        confirmarAoFecharSeAlterado>
        <div className="max-h-[72vh] overflow-y-auto pr-1 scrollbar-hide">
          <section className="bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
            <h3 className="font-bold text-lg">Dados principais</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              <Campo label="Data da recarga">
                <ButtonField onClick={() => setModalDataAberto(true)}>
                  {formatarDataBR(dataCompra)}
                </ButtonField>
              </Campo>

              <Campo label="Forma de pagamento">
                <ButtonField onClick={() => setModalPagamentoAberto(true)}>
                  {textoFormaPagamento()}
                </ButtonField>
              </Campo>

              {!isBoleto && (
                <Campo label={isCredito ? "Cartão" : isDinheiro ? "Carteira" : "Conta"}>
                  <ButtonField
                    onClick={() => {
                      if (isDinheiro) return;
                      isCredito
                        ? setModalCartaoAberto(true)
                        : setModalContaAberto(true);
                    }}
                  >
                    {textoContaCartao()}
                  </ButtonField>
                </Campo>
              )}

              {isBoleto && (
                <Campo label="Vencimento do boleto">
                  <ButtonField onClick={() => setModalVencimentoAberto(true)}>
                    {formatarDataBR(dataVencimento)}
                  </ButtonField>
                </Campo>
              )}

              <Campo label="Valor total">
                <MoneyInput
                  value={valorTotal}
                  onChange={atualizarValorTotal}
                  prefix="R$"
                  placeholder=""
                />
              </Campo>

              {isCreditoParcelado && (
                <>
                  <Campo label="Quantidade de parcelas">
                    <ButtonField onClick={() => setModalParcelasAberto(true)}>
                      {numeroParcelas}x
                    </ButtonField>
                  </Campo>

                  <Campo label="Valor da parcela">
                    <MoneyInput
                      value={valorParcela}
                      onChange={(valor) => {
                        setUltimoCampoEditado("parcela");
                        setValorParcela(formatarMoedaDigitada(valor));
                      }}
                      prefix="R$"
                      placeholder=""
                    />
                  </Campo>
                </>
              )}
            </div>
          </section>

          <section className="mt-5 bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
            <h3 className="font-bold text-lg">Dados da recarga</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              <Campo label="Veículo">
                <ButtonField onClick={() => setModalVeiculoAberto(true)}>
                  {veiculoSelecionado?.nome || "Selecionar veículo"}
                </ButtonField>
              </Campo>

              <Campo label="kWh carregado">
                <MoneyInput
                  value={kwh}
                  onChange={(valor) => setKwh(formatarDecimalDigitado(valor, 3))}
                  suffix="kWh"
                  placeholder="0,000"
                />
              </Campo>

              <Campo label="Preço por kWh">
                <MoneyInput
                  value={valorKwh}
                  onChange={(valor) => setValorKwh(formatarMoedaDigitada(valor))}
                  prefix="R$"
                  placeholder=""
                />
              </Campo>

              <Campo label="Local da recarga">
                <input
                  value={localRecarga}
                  onChange={(e) => setLocalRecarga(e.target.value)}
                  placeholder="Ex: Eletroposto, shopping, casa..."
                  className="input-base"
                />
              </Campo>

              <Campo label="Informar por">
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Toggle ativo={modoKm === "trip"} onClick={() => setModoKm("trip")}>
                    KM rodados
                  </Toggle>

                  <Toggle
                    ativo={modoKm === "odometro"}
                    onClick={() => setModoKm("odometro")}
                  >
                    Odômetro
                  </Toggle>
                </div>
              </Campo>

              {modoKm === "trip" ? (
                <Campo label="KM rodados">
                  <MoneyInput
                    value={kmRodados}
                    onChange={atualizarKmRodados}
                    suffix="km"
                    placeholder="0"
                  />
                </Campo>
              ) : (
                <Campo label="Odômetro atual">
                  <MoneyInput
                    value={odometro}
                    onChange={atualizarOdometro}
                    suffix="km"
                    placeholder="0"
                  />
                </Campo>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <ResumoItem
                titulo="Custo por kWh"
                valor={custoPorKwh() > 0 ? formatarMoeda(custoPorKwh()) : "-"}
              />

              <ResumoItem
                titulo="Eficiência estimada"
                valor={kmPorKwh() > 0 ? `${numeroParaDecimalInput(kmPorKwh(), 2)} km/kWh` : "-"}
              />

              <ResumoItem
                titulo="Custo por km"
                valor={custoPorKm() > 0 ? formatarMoeda(custoPorKm()) : "-"}
              />
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            {salvando ? "Salvando..." : "Salvar Recarga"}
          </button>
        </div>
      </ModalBase>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={dataCompra}
        onChange={setDataCompra}
        onClose={() => setModalDataAberto(false)}
        titulo="Selecionar data"
        descricao="Escolha a data da recarga."
      />

      <DatePickerModal
        aberto={modalVencimentoAberto}
        valor={dataVencimento}
        onChange={setDataVencimento}
        onClose={() => setModalVencimentoAberto(false)}
        titulo="Vencimento do boleto"
        descricao="Escolha a data em que esta conta precisa ser paga."
      />

      <SelecionarFormaPagamentoModal
        aberto={modalPagamentoAberto}
        formasPagamento={formasPagamento}
        formaPagamento={formaPagamento}
        onSelecionar={(valor) => {
          setFormaPagamento(valor);

          if (valor === "credito_parcelado") {
            setContaId("");
            setNumeroParcelas((atual) =>
              Number(atual || 0) < 2 ? "2" : atual
            );
          }

          if (valor === "credito_avista") {
            setContaId("");
            setNumeroParcelas("1");
            setValorParcela("");
          }

          if (valor === "boleto") {
            setContaId("");
            setCartaoId("");
            setNumeroParcelas("1");
            setValorParcela("");
          }

          if (valor === "dinheiro") {
            setCartaoId("");
            setNumeroParcelas("1");
            setValorParcela("");
            if (carteiraSelecionada) setContaId(String(carteiraSelecionada.id));
          }

          if (!["credito_avista", "credito_parcelado", "boleto"].includes(valor)) {
            setCartaoId("");
            setNumeroParcelas("1");
            setValorParcela("");

            if (valor !== "dinheiro") definirContaBancariaPadrao();
          }
        }}
        onClose={() => setModalPagamentoAberto(false)}
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contasBancarias}
        contaId={contaId}
        onSelecionar={setContaId}
        onClose={() => setModalContaAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartaoAberto}
        cartoes={cartoes}
        cartaoId={cartaoId}
        onSelecionar={setCartaoId}
        onClose={() => setModalCartaoAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarVeiculoModal
        aberto={modalVeiculoAberto}
        veiculos={veiculos}
        veiculoId={veiculoId}
        onSelecionar={setVeiculoId}
        onClose={() => setModalVeiculoAberto(false)}
      />

      <SelecionarParcelasModal
        aberto={modalParcelasAberto}
        numeroParcelas={numeroParcelas}
        onSelecionar={setNumeroParcelas}
        onClose={() => setModalParcelasAberto(false)}
      />

      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={fecharFeedback}
      />
    </>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>
      {children}
    </div>
  );
}

function ButtonField({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-cyan-400 rounded-xl p-3 text-left font-semibold"
    >
      {children}
    </button>
  );
}

function MoneyInput({ value, onChange, prefix, suffix, placeholder }) {
  return (
    <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
      {prefix && <span className="px-3 text-gray-400">{prefix}</span>}

      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent p-3 outline-none"
      />

      {suffix && <span className="px-3 text-gray-400">{suffix}</span>}
    </div>
  );
}

function Toggle({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 font-bold ${
        ativo
          ? "border-cyan-400 bg-cyan-500/10 text-cyan-400"
          : "border-gray-700 text-gray-300 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function ResumoItem({ titulo, valor }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400">{titulo}</p>
      <p className="text-xl font-bold mt-1">{valor}</p>
    </div>
  );
}
