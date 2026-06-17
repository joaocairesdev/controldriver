import { useEffect, useMemo, useState } from "react";
import { FiCreditCard, FiPlus, FiTag, FiTrash2, FiTruck, FiX } from "react-icons/fi";
import { supabase } from "../../services/supabase";

import ModalBase from "./ModalBase";
import DatePickerModal from "./DatePickerModal";
import SelecionarContaModal from "./SelecionarContaModal";
import SelecionarCategoriaModal from "./SelecionarCategoriaModal";
import SelecionarFormaPagamentoModal from "./SelecionarFormaPagamentoModal";
import SelecionarCartaoModal from "./SelecionarCartaoModal";
import SelecionarParcelasModal from "./SelecionarParcelasModal";
import FeedbackModal from "./FeedbackModal";
import ConfirmacaoModal from "./ConfirmacaoModal";

export default function TagModal({ aberto, onClose, etapaInicial = "menu", tagInicialId = "", edicao = null, onSalvo = null }) {
  const hoje = new Date().toISOString().split("T")[0];

  const categorias = [
    "Pedágio de uso a trabalho",
    "Pedágio de uso pessoal",
    "Estacionamento de uso a trabalho",
    "Estacionamento de uso pessoal",
    "Mensalidade da TAG",
  ];

  const formasRecarga = [
    { valor: "dinheiro", titulo: "Dinheiro", descricao: "Sai da carteira" },
    { valor: "pix", titulo: "Pix", descricao: "Sai direto de uma conta" },
    { valor: "debito", titulo: "Débito", descricao: "Sai direto de uma conta" },
    { valor: "credito_avista", titulo: "Crédito à Vista", descricao: "Entra na fatura do cartão" },
    { valor: "credito_parcelado", titulo: "Crédito Parcelado", descricao: "Divide em 2x ou mais no cartão" },
  ];

  const usoPadrao = {
    categoria: "Pedágio de uso a trabalho",
    valor: "",
    descricao: "",
  };

  const criarGrupo = (data = hoje) => ({
    id: crypto.randomUUID(),
    data,
    usos: [{ ...usoPadrao, id: crypto.randomUUID() }],
  });

  const [etapa, setEtapa] = useState("menu");
  const [contasTag, setContasTag] = useState([]);
  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [contaTagId, setContaTagId] = useState("");
  const [grupos, setGrupos] = useState([criarGrupo()]);

  const [modalData, setModalData] = useState({
    aberto: false,
    grupoIndex: null,
  });

  const [modalCategoria, setModalCategoria] = useState({
    aberto: false,
    grupoIndex: null,
    usoIndex: null,
  });

  const [modalContaAberto, setModalContaAberto] = useState(false);

  const [dataRecarga, setDataRecarga] = useState(hoje);
  const [tagRecargaId, setTagRecargaId] = useState("");
  const [formaRecarga, setFormaRecarga] = useState("pix");
  const [contaOrigemRecargaId, setContaOrigemRecargaId] = useState("");
  const [cartaoRecargaId, setCartaoRecargaId] = useState("");
  const [valorRecarga, setValorRecarga] = useState("");
  const [numeroParcelasRecarga, setNumeroParcelasRecarga] = useState("1");
  const [valorParcelaRecarga, setValorParcelaRecarga] = useState("");
  const [ultimoCampoRecarga, setUltimoCampoRecarga] = useState("total");

  const [modalDataRecargaAberto, setModalDataRecargaAberto] = useState(false);
  const [modalTagRecargaAberto, setModalTagRecargaAberto] = useState(false);
  const [modalFormaRecargaAberto, setModalFormaRecargaAberto] = useState(false);
  const [modalContaOrigemRecargaAberto, setModalContaOrigemRecargaAberto] = useState(false);
  const [modalCartaoRecargaAberto, setModalCartaoRecargaAberto] = useState(false);
  const [modalParcelasRecargaAberto, setModalParcelasRecargaAberto] = useState(false);

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
    fecharDepois: false,
  });
  const [carregando, setCarregando] = useState(false);

  const [confirmacaoAcao, setConfirmacaoAcao] = useState({
    aberto: false,
    titulo: "",
    mensagem: "",
    onConfirmar: null,
  });
  const [salvando, setSalvando] = useState(false);
  const [confirmacaoRecarga, setConfirmacaoRecarga] = useState({
    aberto: false,
    saldoPrevisto: 0,
    gatilho: 0,
    valorRecarga: 0,
  });

  const contaTagSelecionada = useMemo(
    () => contasTag.find((conta) => String(conta.id) === String(contaTagId)),
    [contasTag, contaTagId]
  );

  const tagRecargaSelecionada = useMemo(
    () => contasTag.find((conta) => String(conta.id) === String(tagRecargaId)),
    [contasTag, tagRecargaId]
  );

  const contaOrigemRecarga = useMemo(
    () => contas.find((conta) => String(conta.id) === String(contaOrigemRecargaId)),
    [contas, contaOrigemRecargaId]
  );

  const carteiraRecarga = useMemo(
    () => contas.find((conta) => conta.tipo_conta === "carteira"),
    [contas]
  );

  const cartaoRecargaSelecionado = useMemo(
    () => cartoes.find((cartao) => String(cartao.id) === String(cartaoRecargaId)),
    [cartoes, cartaoRecargaId]
  );

  const existeTagPrePaga = contasTag.some(
    (conta) => conta.tipo_tag === "pre_paga"
  );

  const tagsPrePagas = contasTag.filter(
    (conta) => (conta.tipo_tag || "pre_paga") === "pre_paga"
  );

  const contasOrigemRecarga = contas.filter(
    (conta) => (conta.tipo_conta || "banco") === "banco"
  );

  const isRecargaCredito =
    formaRecarga === "credito_avista" || formaRecarga === "credito_parcelado";

  const isRecargaParcelada = formaRecarga === "credito_parcelado";
  const isRecargaDinheiro = formaRecarga === "dinheiro";

  useEffect(() => {
    if (!isRecargaParcelada) return;

    const total = moedaParaNumero(valorRecarga);
    const parcelas = Number(numeroParcelasRecarga || 2);

    if (ultimoCampoRecarga === "total" && total > 0 && parcelas > 0) {
      setValorParcelaRecarga(numeroParaMoedaInput(total / parcelas));
    }
  }, [valorRecarga, numeroParcelasRecarga, isRecargaParcelada, ultimoCampoRecarga]);

  useEffect(() => {
    if (!isRecargaParcelada) return;

    const parcela = moedaParaNumero(valorParcelaRecarga);
    const parcelas = Number(numeroParcelasRecarga || 2);

    if (ultimoCampoRecarga === "parcela" && parcela > 0 && parcelas > 0) {
      setValorRecarga(numeroParaMoedaInput(parcela * parcelas));
    }
  }, [valorParcelaRecarga, numeroParcelasRecarga, isRecargaParcelada, ultimoCampoRecarga]);

  useEffect(() => {
    if (!aberto) return;
    carregarDados();
    setEtapa(edicao?.id ? "uso" : etapaInicial || "menu");
  }, [aberto, etapaInicial, tagInicialId, edicao?.id]);

  useEffect(() => {
    if (!aberto || !edicao?.id || !edicao?.tag) return;
    const tag = edicao.tag;
    setContaTagId(tag.conta_tag_id ? String(tag.conta_tag_id) : (edicao.conta_id ? String(edicao.conta_id) : ""));
    setGrupos([
      {
        id: crypto.randomUUID(),
        data: edicao.data_compra || hoje,
        usos: [
          {
            ...usoPadrao,
            id: crypto.randomUUID(),
            categoria: edicao.categoria || usoPadrao.categoria,
            valor: numeroParaMoedaInput(edicao.valor_total || 0),
            descricao: tag.descricao_local || edicao.descricao || "",
          },
        ],
      },
    ]);
  }, [aberto, edicao?.id, edicao?.tag?.id]);

  useEffect(() => {
    if (isRecargaDinheiro && carteiraRecarga) {
      setContaOrigemRecargaId(String(carteiraRecarga.id));
      setCartaoRecargaId("");
    }
  }, [isRecargaDinheiro, carteiraRecarga]);


  async function carregarContasComSaldo(contasBase) {
    return Promise.all(
      (contasBase || []).map(async (conta) => {
        const contaId = conta.id;

        const { data: entradas } = await supabase
          .from("entradas")
          .select(`
            entrada_plataformas (
              faturamento,
              valor_reembolso
            )
          `)
          .eq("conta_id", contaId);

        const totalEntradas = (entradas || []).reduce((total, entrada) => {
          const totalPlataformas = (entrada.entrada_plataformas || []).reduce(
            (soma, item) =>
              soma +
              Number(item.faturamento || 0) +
              Number(item.valor_reembolso || 0),
            0
          );

          return total + totalPlataformas;
        }, 0);

        const { data: entradasAvulsas } = await supabase
          .from("entradas_avulsas")
          .select("valor")
          .eq("conta_id", contaId);

        const totalEntradasAvulsas = (entradasAvulsas || []).reduce(
          (total, entrada) => total + Number(entrada.valor || 0),
          0
        );

        const { data: transferenciasRecebidas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_destino_id", contaId);

        const totalTransferenciasRecebidas = (
          transferenciasRecebidas || []
        ).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: transferenciasEnviadas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_origem_id", contaId);

        const totalTransferenciasEnviadas = (
          transferenciasEnviadas || []
        ).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: saidas } = await supabase
          .from("saidas")
          .select("valor_total, tipo_movimentacao")
          .eq("conta_id", contaId);

        const totalSaidas = (saidas || [])
          .filter((saida) => saida.tipo_movimentacao !== "conta_pagar")
          .reduce((total, saida) => total + Number(saida.valor_total || 0), 0);

        const saldoAtual =
          Number(conta.saldo_inicial || 0) +
          totalEntradas +
          totalEntradasAvulsas +
          totalTransferenciasRecebidas -
          totalSaidas -
          totalTransferenciasEnviadas;

        return {
          ...conta,
          tipo_conta: conta.tipo_conta || "banco",
          saldo_atual: saldoAtual,
        };
      })
    );
  }


  async function carregarDados() {
    setCarregando(true);

    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("nome");

    const { data: cartoesData } = await supabase
      .from("cartoes")
      .select("*")
      .eq("ativo", true)
      .order("nome");

    const cartoesComUso = await carregarUsoDosCartoes(cartoesData || []);
    const contasComSaldo = await carregarContasComSaldo(contasData || []);
    const tags = contasComSaldo.filter((conta) => conta.tipo_conta === "tag");
    const tagsPrePagasEncontradas = tags.filter(
      (conta) => (conta.tipo_tag || "pre_paga") === "pre_paga"
    );
    const contasOrigem = contasComSaldo.filter(
      (conta) => (conta.tipo_conta || "banco") === "banco"
    );

    setContas(contasComSaldo);
    setContasTag(tags);
    setCartoes(cartoesComUso);

    const tagInicial = tagInicialId
      ? tags.find((tag) => String(tag.id) === String(tagInicialId))
      : null;

    if (tagInicial) {
      setContaTagId(String(tagInicial.id));
      if ((tagInicial.tipo_tag || "pre_paga") === "pre_paga") {
        setTagRecargaId(String(tagInicial.id));
      }
    } else {
      if (tags.length) setContaTagId(String(tags[0].id));
      if (tagsPrePagasEncontradas.length) setTagRecargaId(String(tagsPrePagasEncontradas[0].id));
    }
    if (contasOrigem.length) {
      const principal = contasOrigem.find((conta) => conta.principal);
      const contaPadrao = principal || contasOrigem[0];
      if (contaPadrao) setContaOrigemRecargaId(String(contaPadrao.id));
    }

    setCarregando(false);
  }

  async function carregarUsoDosCartoes(listaCartoes) {
    if (!listaCartoes.length) return [];

    const ids = listaCartoes.map((cartao) => cartao.id);

    const { data: faturasData } = await supabase
      .from("faturas_cartao")
      .select("cartao_id, valor_total, status")
      .in("cartao_id", ids)
      .in("status", ["aberta", "fechada"]);

    return listaCartoes.map((cartao) => {
      const usado = (faturasData || [])
        .filter((fatura) => Number(fatura.cartao_id) === Number(cartao.id))
        .reduce((total, fatura) => total + Number(fatura.valor_total || 0), 0);

      return {
        ...cartao,
        usado,
      };
    });
  }
  function formatarDataBR(dataISO) {
    if (!dataISO) return "-";
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
    const somenteDigitos = String(valor ?? "").replace(/\D/g, "");
    if (!somenteDigitos) return "";

    const digitosSemZerosNaFrente = somenteDigitos.replace(/^0+/, "");
    if (!digitosSemZerosNaFrente) return "";

    const centavos = Number(digitosSemZerosNaFrente);

    return (centavos / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function moedaParaNumero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(/\./g, "").replace(",", "."));
  }

  function numeroParaMoedaInput(valor) {
    return Number(valor || 0).toFixed(2).replace(".", ",");
  }

  function abrirFeedback(tipo, titulo, mensagem, fecharDepois = false) {
    setFeedback({ aberto: true, tipo, titulo, mensagem, fecharDepois });
  }

  async function fecharFeedback() {
    const deveFechar = feedback.fecharDepois;

    setFeedback({
      aberto: false,
      tipo: "sucesso",
      titulo: "",
      mensagem: "",
      fecharDepois: false,
    });

    if (deveFechar) {
      if (edicao?.id) await onSalvo?.();
      setEtapa("menu");
      resetarFormulario();
      limparRecarga();
      onClose?.();
    }
  }

  function resetarFormulario() {
    setGrupos([criarGrupo()]);
  }

  function temDadosPreenchidos() {
    return grupos.some((grupo) =>
      grupo.usos.some(
        (uso) =>
          uso.valor ||
          uso.descricao ||
          uso.categoria !== "Pedágio de uso a trabalho"
      )
    );
  }

  function cancelarUso() {
    resetarFormulario();
    setEtapa("menu");
  }

  function atualizarDataGrupo(grupoIndex, novaData) {
    setGrupos((lista) =>
      lista.map((grupo, index) =>
        index === grupoIndex ? { ...grupo, data: novaData } : grupo
      )
    );
  }

  function atualizarUso(grupoIndex, usoIndex, campo, valor) {
    setGrupos((lista) =>
      lista.map((grupo, gIndex) => {
        if (gIndex !== grupoIndex) return grupo;

        return {
          ...grupo,
          usos: grupo.usos.map((uso, uIndex) => {
            if (uIndex !== usoIndex) return uso;

            const novoUso = {
              ...uso,
              [campo]:
                campo === "valor" ? formatarMoedaDigitada(valor) : valor,
            };

            if (campo === "categoria" && !valor.includes("Estacionamento")) {
              novoUso.descricao = "";
            }

            return novoUso;
          }),
        };
      })
    );
  }

  function adicionarUso(grupoIndex) {
    setGrupos((lista) =>
      lista.map((grupo, index) =>
        index === grupoIndex
          ? {
              ...grupo,
              usos: [
                ...grupo.usos,
                { ...usoPadrao, id: crypto.randomUUID() },
              ],
            }
          : grupo
      )
    );
  }

  function removerUso(grupoIndex, usoIndex) {
    setGrupos((lista) =>
      lista.map((grupo, index) => {
        if (index !== grupoIndex) return grupo;

        const novosUsos = grupo.usos.filter((_, i) => i !== usoIndex);

        return {
          ...grupo,
          usos:
            novosUsos.length > 0
              ? novosUsos
              : [{ ...usoPadrao, id: crypto.randomUUID() }],
        };
      })
    );
  }

  function adicionarNovaData() {
    setGrupos((lista) => [...lista, criarGrupo()]);
  }

  function removerGrupo(grupoIndex) {
    if (grupos.length === 1) return;

    setConfirmacaoAcao({
      aberto: true,
      titulo: "Remover esta data?",
      mensagem: "Deseja remover esta data e seus usos?",
      onConfirmar: () => {
        setGrupos((lista) => lista.filter((_, index) => index !== grupoIndex));
      },
    });
  }

  function descricaoAutomatica(uso) {
    const nomeTag = contaTagSelecionada?.nome || "TAG";

    if (uso.categoria === "Pedágio de uso a trabalho") {
      return `Pedágio de uso a trabalho - ${nomeTag}`;
    }

    if (uso.categoria === "Pedágio de uso pessoal") {
      return `Pedágio de uso pessoal - ${nomeTag}`;
    }

    if (uso.categoria === "Mensalidade da TAG") {
      return `Mensalidade da TAG - ${nomeTag}`;
    }

    return uso.descricao || uso.categoria;
  }

  function dadosTagDetalhe(uso) {
    if (uso.categoria.includes("Pedágio")) {
      return {
        tipo_uso: "pedagio",
        uso: uso.categoria.includes("trabalho") ? "trabalho" : "pessoal",
        descricao_local: null,
      };
    }

    if (uso.categoria.includes("Estacionamento")) {
      return {
        tipo_uso: "estacionamento",
        uso: uso.categoria.includes("trabalho") ? "trabalho" : "pessoal",
        descricao_local: uso.descricao || null,
      };
    }

    return {
      tipo_uso: "mensalidade",
      uso: null,
      descricao_local: null,
    };
  }

  function calcularTotalUsoInformado() {
    return totalValor();
  }

  function calcularGatilhoRecarga(tag) {
    const valorRecarga = Number(tag?.valor_recarga_automatica || 0);
    const percentual = Number(tag?.percentual_alerta_recarga || 30);

    if (valorRecarga <= 0) return 0;
    return valorRecarga * (percentual / 100);
  }

  function precisaConfirmarRecargaAutomatica() {
    const tag = contaTagSelecionada;
    if (!tag) return null;

    const prePaga = (tag.tipo_tag || "pre_paga") === "pre_paga";
    const valorRecarga = Number(tag.valor_recarga_automatica || 0);
    const gatilho = calcularGatilhoRecarga(tag);
    const saldoAtual = Number(tag.saldo_atual || 0);
    const saldoPrevisto = saldoAtual - calcularTotalUsoInformado();

    if (!prePaga || !tag.recarga_automatica || valorRecarga <= 0 || gatilho <= 0) {
      return null;
    }

    if (saldoPrevisto <= gatilho) {
      return {
        saldoPrevisto,
        gatilho,
        valorRecarga,
      };
    }

    return null;
  }

  function ultimoDiaMes(ano, mes) {
    return new Date(ano, mes, 0).getDate();
  }

  function dataComDiaSeguro(ano, mes, dia) {
    const diaSeguro = Math.min(Number(dia || 1), ultimoDiaMes(ano, mes));
    return `${ano}-${String(mes).padStart(2, "0")}-${String(diaSeguro).padStart(2, "0")}`;
  }

  function adicionarMesCompetencia(ano, mes, quantidade) {
    let novoMes = mes + quantidade;
    let novoAno = ano;

    while (novoMes > 12) {
      novoMes -= 12;
      novoAno += 1;
    }

    while (novoMes < 1) {
      novoMes += 12;
      novoAno -= 1;
    }

    return { mes: novoMes, ano: novoAno };
  }

  function somarMeses(dataBase, mesesParaSomar) {
    const data = new Date(`${dataBase}T00:00:00`);
    data.setMonth(data.getMonth() + mesesParaSomar);
    return data;
  }

  function calcularCompetenciaFatura(dataBase, cartao) {
    const data = new Date(`${dataBase}T00:00:00`);
    const diaCompra = data.getDate();
    const diaFechamento = Number(cartao?.dia_fechamento || 1);
    const diaVencimento = Number(cartao?.dia_vencimento || 1);

    let mesFechamento = data.getMonth() + 1;
    let anoFechamento = data.getFullYear();

    if (diaCompra > diaFechamento) {
      const proximo = adicionarMesCompetencia(anoFechamento, mesFechamento, 1);
      mesFechamento = proximo.mes;
      anoFechamento = proximo.ano;
    }

    let mesVencimento = mesFechamento;
    let anoVencimento = anoFechamento;

    if (diaVencimento < diaFechamento) {
      const proximo = adicionarMesCompetencia(anoVencimento, mesVencimento, 1);
      mesVencimento = proximo.mes;
      anoVencimento = proximo.ano;
    }

    return { mes: mesVencimento, ano: anoVencimento, mesFechamento, anoFechamento };
  }

  async function buscarOuCriarFatura({ cartao, dataBase }) {
    const competencia = calcularCompetenciaFatura(dataBase, cartao);

    const dataFechamento = dataComDiaSeguro(
      competencia.anoFechamento,
      competencia.mesFechamento,
      cartao.dia_fechamento
    );

    const dataVencimento = dataComDiaSeguro(
      competencia.ano,
      competencia.mes,
      cartao.dia_vencimento
    );

    const { data: faturaExistente, error: erroBusca } = await supabase
      .from("faturas_cartao")
      .select("*")
      .eq("cartao_id", Number(cartao.id))
      .eq("mes", competencia.mes)
      .eq("ano", competencia.ano)
      .maybeSingle();

    if (erroBusca) throw erroBusca;
    if (faturaExistente) return faturaExistente;

    const { data: novaFatura, error: erroCriar } = await supabase
      .from("faturas_cartao")
      .insert({
        cartao_id: Number(cartao.id),
        mes: competencia.mes,
        ano: competencia.ano,
        data_fechamento: dataFechamento,
        data_vencimento: dataVencimento,
        valor_total: 0,
        status: "aberta",
      })
      .select()
      .single();

    if (erroCriar) throw erroCriar;
    return novaFatura;
  }

  async function atualizarValorFatura(faturaId, valorSomar) {
    const { data: fatura, error: erroBusca } = await supabase
      .from("faturas_cartao")
      .select("valor_total")
      .eq("id", faturaId)
      .single();

    if (erroBusca) throw erroBusca;

    const novoTotal = Number(fatura.valor_total || 0) + Number(valorSomar || 0);

    const { error: erroUpdate } = await supabase
      .from("faturas_cartao")
      .update({ valor_total: novoTotal })
      .eq("id", faturaId);

    if (erroUpdate) throw erroUpdate;
  }

  async function verificarLimiteCartaoRecarga(total) {
    if (!cartaoRecargaSelecionado) return true;

    const { data: faturasAbertas, error: erroFaturas } = await supabase
      .from("faturas_cartao")
      .select("valor_total")
      .eq("cartao_id", Number(cartaoRecargaId))
      .in("status", ["aberta", "fechada"]);

    if (erroFaturas) throw erroFaturas;

    const usadoAtual = (faturasAbertas || []).reduce(
      (totalAtual, fatura) => totalAtual + Number(fatura.valor_total || 0),
      0
    );

    const limite = Number(cartaoRecargaSelecionado.limite_total || 0);
    const disponivel = limite - usadoAtual;

    if (limite > 0 && total > disponivel) {
      return window.confirm(
        "Esta recarga ultrapassará o limite do cartão.\n\nDeseja continuar mesmo assim?"
      );
    }

    return true;
  }

  async function gerarParcelasRecarga(saidaId, total, parcelaValor, parcelas) {
    if (!isRecargaCredito || !cartaoRecargaSelecionado) return;

    const parcelasPayload = [];

    for (let index = 0; index < parcelas; index++) {
      const dataParcela = somarMeses(dataRecarga, index);
      const dataBase = dataParcela.toISOString().split("T")[0];

      const fatura = await buscarOuCriarFatura({
        cartao: cartaoRecargaSelecionado,
        dataBase,
      });

      await atualizarValorFatura(fatura.id, parcelaValor);

      parcelasPayload.push({
        saida_id: saidaId,
        cartao_id: Number(cartaoRecargaId),
        fatura_id: fatura.id,
        numero_parcela: index + 1,
        total_parcelas: parcelas,
        valor_parcela: parcelaValor,
        data_vencimento: fatura.data_vencimento,
        status: "pendente",
      });
    }

    if (parcelasPayload.length > 0) {
      const { error: erroParcelas } = await supabase
        .from("saidas_parcelas")
        .insert(parcelasPayload);

      if (erroParcelas) throw erroParcelas;
    }
  }

  function definirContaBancariaRecargaPadrao() {
    const contaPrincipal = contasOrigemRecarga.find((conta) => conta.principal);
    const contaPadrao = contaPrincipal || contasOrigemRecarga[0];

    if (contaPadrao) setContaOrigemRecargaId(String(contaPadrao.id));
  }

  function resetarRecarga() {
    limparRecarga();
  }


  async function gerarParcelaRecargaConfigurada({ saidaId, cartao, valor, dataBase }) {
    const fatura = await buscarOuCriarFatura({ cartao, dataBase });
    await atualizarValorFatura(fatura.id, valor);

    const { error } = await supabase.from("saidas_parcelas").insert({
      saida_id: saidaId,
      cartao_id: Number(cartao.id),
      fatura_id: fatura.id,
      numero_parcela: 1,
      total_parcelas: 1,
      valor_parcela: valor,
      data_vencimento: fatura.data_vencimento,
      status: "pendente",
    });

    if (error) throw error;
  }


  async function registrarEntradaSaldoTag({ tagId, data, valor, descricao }) {
    const { error } = await supabase.from("entradas_avulsas").insert({
      data,
      conta_id: Number(tagId),
      valor: Number(valor || 0),
      descricao,
      finalidade: null,
    });

    if (error) throw error;
  }

  async function registrarSaidaFinanceiraRecargaTag({ data, forma, contaId, valor, descricao }) {
    const { error } = await supabase.from("saidas").insert({
      data_compra: data,
      forma_pagamento: forma,
      tipo_movimentacao: "saida",
      conta_id: Number(contaId),
      cartao_id: null,
      tipo_credito: null,
      numero_parcelas: 1,
      valor_total: Number(valor || 0),
      valor_parcela: Number(valor || 0),
      data_efetivacao: data,
      data_vencimento: null,
      categoria: "Recarga TAG",
      finalidade: "trabalho",
      descricao,
      status: "pago",
    });

    if (error) throw error;
  }

  async function registrarRecargaAutomaticaConfigurada(tag, dataBase) {
    const valor = Number(tag.valor_recarga_automatica || 0);
    const forma = tag.tag_forma_recarga || "credito_avista";
    const descricao = `Recarga TAG - ${tag.nome || "TAG"}`;

    if (valor <= 0) {
      throw new Error("A TAG não possui valor de recarga configurado.");
    }

    if (forma === "credito_avista") {
      const cartao = cartoes.find(
        (item) => String(item.id) === String(tag.tag_cartao_recarga_id)
      );

      if (!cartao) {
        throw new Error("Selecione o cartão de crédito da recarga na configuração da TAG.");
      }

      const { data: saidaCriada, error: erroSaida } = await supabase
        .from("saidas")
        .insert({
          data_compra: dataBase,
          forma_pagamento: "credito_avista",
          tipo_movimentacao: "saida",
          conta_id: null,
          cartao_id: Number(cartao.id),
          tipo_credito: "avista",
          numero_parcelas: 1,
          valor_total: valor,
          valor_parcela: valor,
          data_efetivacao: dataBase,
          data_vencimento: null,
          categoria: "Recarga TAG",
          finalidade: "trabalho",
          descricao: `${descricao} automática confirmada`,
          status: "fatura",
        })
        .select()
        .single();

      if (erroSaida) throw erroSaida;

      await gerarParcelaRecargaConfigurada({
        saidaId: saidaCriada.id,
        cartao,
        valor,
        dataBase,
      });

      await registrarEntradaSaldoTag({
        tagId: tag.id,
        data: dataBase,
        valor,
        descricao: `${descricao} via cartão`,
      });

      return;
    }

    const contaOrigemId = tag.tag_conta_recarga_id;
    if (!contaOrigemId) {
      throw new Error("Selecione a conta da recarga na configuração da TAG.");
    }

    const descricaoForma = `${descricao} via ${forma === "pix" ? "Pix" : "débito"}`;

    await registrarSaidaFinanceiraRecargaTag({
      data: dataBase,
      forma,
      contaId: contaOrigemId,
      valor,
      descricao: descricaoForma,
    });

    await registrarEntradaSaldoTag({
      tagId: tag.id,
      data: dataBase,
      valor,
      descricao: descricaoForma,
    });
  }

  function validarUso() {
    if (!contaTagId) {
      abrirFeedback("erro", "TAG obrigatória", "Selecione uma TAG.");
      return false;
    }

    for (const grupo of grupos) {
      if (!grupo.data) {
        abrirFeedback("erro", "Data obrigatória", "Selecione a data.");
        return false;
      }

      for (const uso of grupo.usos) {
        if (!uso.categoria || moedaParaNumero(uso.valor) <= 0) {
          abrirFeedback(
            "erro",
            "Dados incompletos",
            "Preencha categoria e valor em todos os usos."
          );
          return false;
        }

        if (uso.categoria.includes("Estacionamento") && !uso.descricao.trim()) {
          abrirFeedback(
            "erro",
            "Descrição obrigatória",
            "Informe a descrição do estacionamento."
          );
          return false;
        }
      }
    }

    return true;
  }

  async function salvarUso(opcoes = {}) {
    if (!validarUso()) return;

    const recargaNecessaria = precisaConfirmarRecargaAutomatica();
    const registrarRecarga = opcoes?.registrarRecargaAutomatica === true;
    const ignorarRecarga = opcoes?.ignorarRecargaAutomatica === true;

    if (recargaNecessaria && !registrarRecarga && !ignorarRecarga) {
      setConfirmacaoRecarga({
        aberto: true,
        ...recargaNecessaria,
      });
      return;
    }

    setConfirmacaoRecarga({ aberto: false, saldoPrevisto: 0, gatilho: 0, valorRecarga: 0 });
    setSalvando(true);

    try {
      for (const grupo of grupos) {
        for (const uso of grupo.usos) {
          const valor = moedaParaNumero(uso.valor);
          const detalhe = dadosTagDetalhe(uso);

          const dadosSaida = {
              data_compra: grupo.data,
              forma_pagamento: "tag",
              conta_id: Number(contaTagId),
              cartao_id: null,
              tipo_credito: null,
              numero_parcelas: 1,
              valor_total: valor,
              valor_parcela: valor,
              data_efetivacao: grupo.data,
              categoria: uso.categoria,
              finalidade: detalhe.uso || "trabalho",
              descricao: descricaoAutomatica(uso),
              status: "pago",
              tipo_movimentacao: "saida",
            };
          let saidaId = edicao?.id || null;
          if (saidaId) {
            const { error: erroSaida } = await supabase.from("saidas").update(dadosSaida).eq("id", saidaId);
            if (erroSaida) throw erroSaida;
            await supabase.from("saidas_tag").delete().eq("saida_id", saidaId);
          } else {
            const { data: saidaCriada, error: erroSaida } = await supabase
              .from("saidas")
              .insert(dadosSaida)
              .select()
              .single();
            if (erroSaida) throw erroSaida;
            saidaId = saidaCriada.id;
          }

          const { error: erroTag } = await supabase.from("saidas_tag").insert({
            saida_id: saidaId,
            conta_tag_id: Number(contaTagId),
            tipo_uso: detalhe.tipo_uso,
            uso: detalhe.uso,
            descricao_local: detalhe.descricao_local,
          });

          if (erroTag) throw erroTag;
        }
      }

      if (registrarRecarga) {
        const dataRecargaAutomatica = grupos[0]?.data || hoje;
        await registrarRecargaAutomaticaConfigurada(contaTagSelecionada, dataRecargaAutomatica);
      }

      abrirFeedback(
        "sucesso",
        edicao?.id ? "Uso da TAG atualizado" : registrarRecarga ? "Uso e recarga salvos" : "Uso da TAG salvo",
        registrarRecarga
          ? "O uso da TAG e a recarga necessária foram registrados com sucesso."
          : "Os lançamentos foram registrados com sucesso.",
        true
      );
    } catch (error) {
      console.error(error);
      abrirFeedback(
        "erro",
        "Erro ao salvar",
        error.message || "Erro ao salvar uso da TAG."
      );
    } finally {
      setSalvando(false);
    }
  }

  function limparRecarga() {
    setDataRecarga(hoje);
    setFormaRecarga("pix");
    setValorRecarga("");
    setNumeroParcelasRecarga("1");
    setValorParcelaRecarga("");
    setUltimoCampoRecarga("total");

    if (tagsPrePagas.length) setTagRecargaId(String(tagsPrePagas[0].id));

    if (contasOrigemRecarga.length) {
      const principal = contasOrigemRecarga.find((conta) => conta.principal);
      setContaOrigemRecargaId(String((principal || contasOrigemRecarga[0]).id));
    }

    setCartaoRecargaId("");
  }

  function cancelarRecarga() {
    resetarRecarga();
    setEtapa("menu");
  }

  function textoFormaRecarga() {
    return formasRecarga.find((item) => item.valor === formaRecarga)?.titulo || "Selecionar forma";
  }

  function validarRecarga() {
    const valorNumero = moedaParaNumero(valorRecarga);

    if (!dataRecarga) {
      abrirFeedback("erro", "Data obrigatória", "Selecione a data da recarga.");
      return false;
    }

    if (!tagRecargaId) {
      abrirFeedback("erro", "TAG obrigatória", "Selecione a TAG recarregada.");
      return false;
    }

    if (!valorRecarga || valorNumero <= 0) {
      abrirFeedback("erro", "Valor obrigatório", "Informe o valor da recarga.");
      return false;
    }

    if (isRecargaCredito && !cartaoRecargaId) {
      abrirFeedback("erro", "Cartão obrigatório", "Selecione o cartão usado na recarga.");
      return false;
    }

    if (isRecargaDinheiro && !carteiraRecarga) {
      abrirFeedback("erro", "Carteira não encontrada", "Cadastre uma conta do tipo Carteira antes de registrar recarga em dinheiro.");
      return false;
    }

    if (!isRecargaCredito && !contaOrigemRecargaId) {
      abrirFeedback("erro", "Conta obrigatória", "Selecione a conta de origem da recarga.");
      return false;
    }

    if (isRecargaParcelada && Number(numeroParcelasRecarga || 0) < 2) {
      abrirFeedback("erro", "Parcelamento inválido", "Crédito parcelado precisa começar em 2x.");
      return false;
    }

    return true;
  }

  async function salvarRecarga() {
    if (!validarRecarga()) return;

    const valorNumero = moedaParaNumero(valorRecarga);
    const parcelas = isRecargaParcelada ? Number(numeroParcelasRecarga || 2) : 1;
    const parcelaValor = isRecargaParcelada
      ? moedaParaNumero(valorParcelaRecarga)
      : valorNumero;

    const tagNome = tagRecargaSelecionada?.nome || "TAG";
    const descricao = `Recarga TAG - ${tagNome}`;

    setSalvando(true);

    try {
      if (isRecargaCredito) {
        const limiteOk = await verificarLimiteCartaoRecarga(valorNumero);
        if (!limiteOk) {
          setSalvando(false);
          return;
        }

        const { data: saidaCriada, error: erroSaida } = await supabase
          .from("saidas")
          .insert({
            data_compra: dataRecarga,
            forma_pagamento: formaRecarga,
            tipo_movimentacao: "saida",
            conta_id: null,
            cartao_id: Number(cartaoRecargaId),
            tipo_credito: isRecargaParcelada ? "parcelado" : "avista",
            numero_parcelas: parcelas,
            valor_total: valorNumero,
            valor_parcela: parcelaValor,
            data_efetivacao: dataRecarga,
            data_vencimento: null,
            categoria: "Recarga TAG",
            descricao,
            status: "fatura",
          })
          .select()
          .single();

        if (erroSaida) throw erroSaida;

        await gerarParcelasRecarga(saidaCriada.id, valorNumero, parcelaValor, parcelas);

        await registrarEntradaSaldoTag({
          tagId: tagRecargaId,
          data: dataRecarga,
          valor: valorNumero,
          descricao: `${descricao} via cartão`,
        });
      } else {
        await registrarSaidaFinanceiraRecargaTag({
          data: dataRecarga,
          forma: formaRecarga,
          contaId: contaOrigemRecargaId,
          valor: valorNumero,
          descricao,
        });

        await registrarEntradaSaldoTag({
          tagId: tagRecargaId,
          data: dataRecarga,
          valor: valorNumero,
          descricao,
        });
      }

      abrirFeedback("sucesso", "Recarga salva", "A recarga da TAG foi registrada com sucesso.", true);
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar recarga da TAG.");
    } finally {
      setSalvando(false);
    }
  }

  function totalUsos() {
    return grupos.reduce((total, grupo) => total + grupo.usos.length, 0);
  }

  function totalValor() {
    return grupos.reduce(
      (totalGrupo, grupo) =>
        totalGrupo +
        grupo.usos.reduce(
          (totalUso, uso) => totalUso + moedaParaNumero(uso.valor),
          0
        ),
      0
    );
  }

  if (!aberto) return null;

  return (
    <>
      {etapa === "menu" && (
        <ModalBase
          aberto={aberto}
          titulo="TAG / Pedágio"
          descricao="Registre usos, pedágios, estacionamentos e recargas da TAG."
          onClose={onClose}
          largura="max-w-2xl"
        >
          {carregando && (
            <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
              <h3 className="text-gray-300 font-bold">Carregando TAGs...</h3>
              <p className="text-gray-500 mt-2">Aguarde enquanto buscamos as TAGs cadastradas nos veículos.</p>
            </div>
          )}

          {!carregando && contasTag.length === 0 && (
            <div className="bg-[#0B1120] border border-yellow-500/40 rounded-2xl p-5">
              <h3 className="text-yellow-400 font-bold">
                Nenhuma TAG cadastrada
              </h3>

              <p className="text-gray-400 mt-2">
                Cadastre uma TAG dentro do veículo antes de registrar usos.
              </p>
            </div>
          )}

          {!carregando && contasTag.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setEtapa("uso")}
                className="rounded-2xl border border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 p-6 text-left transition"
              >
                <FiTag className="w-8 h-8 text-blue-400" />

                <h3 className="text-xl font-bold text-white mt-4">
                  Registrar Uso
                </h3>

                <p className="text-gray-400 text-sm mt-2">
                  Pedágio, estacionamento e mensalidade.
                </p>
              </button>

              {existeTagPrePaga && (
                <button
                  type="button"
                  onClick={() => setEtapa("recarga")}
                  className="rounded-2xl border border-green-500 bg-green-500/10 hover:bg-green-500/20 p-6 text-left transition"
                >
                  <FiCreditCard className="w-8 h-8 text-green-400" />

                  <h3 className="text-xl font-bold text-white mt-4">
                    Registrar Recarga
                  </h3>

                  <p className="text-gray-400 text-sm mt-2">
                    Adicionar saldo em uma TAG pré-paga.
                  </p>
                </button>
              )}
            </div>
          )}
        </ModalBase>
      )}

      {etapa === "uso" && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[100] overscroll-none">
          <div className="w-full max-w-3xl max-h-[calc(100dvh-4rem)] sm:max-h-[90vh] bg-[#111827] border border-gray-800 rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="shrink-0 p-5 border-b border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Uso da TAG</h2>

                  <p className="text-gray-400 mt-2">
                    Registre usos em pedágios e estacionamentos feitos com a sua
                    TAG.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cancelarUso}
                  className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shrink-0 flex items-center justify-center"
                  aria-label="Fechar"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {contasTag.length > 1 && (
                <div className="mt-4">
                  <Campo label="Conta TAG">
                    <ButtonField onClick={() => setModalContaAberto(true)}>
                      {contaTagSelecionada?.nome || "Selecionar TAG"}
                    </ButtonField>
                  </Campo>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
              {grupos.map((grupo, grupoIndex) => {
                const ultimoGrupo = grupoIndex === grupos.length - 1;

                return (
                  <div
                    key={grupo.id}
                    className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 max-w-xs">
                        <Campo label="Data">
                          <ButtonField
                            onClick={() =>
                              setModalData({
                                aberto: true,
                                grupoIndex,
                              })
                            }
                          >
                            {formatarDataBR(grupo.data)}
                          </ButtonField>
                        </Campo>
                      </div>

                      <div className="flex items-center gap-2 pt-6">
                        {grupos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerGrupo(grupoIndex)}
                            className="h-[46px] w-[46px] rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10"
                            title="Excluir esta data"
                          >
                            <FiTrash2 className="w-5 h-5 mx-auto" />
                          </button>
                        )}

                        {ultimoGrupo && (
                          <button
                            type="button"
                            onClick={adicionarNovaData}
                            className="h-[46px] px-4 rounded-xl border border-green-500/50 text-green-400 hover:bg-green-500/10 font-bold"
                          >
                            + Nova data
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {grupo.usos.map((uso, usoIndex) => {
                        const precisaDescricao =
                          uso.categoria.includes("Estacionamento");

                        return (
                          <div
                            key={uso.id}
                            className="border border-gray-800 rounded-2xl p-4 bg-[#111827]"
                          >
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div>
                                <p className="text-sm font-bold text-white">
                                  Uso {usoIndex + 1}
                                </p>

                                <p className="text-xs text-gray-500">
                                  Categoria, valor e descrição quando necessário.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => removerUso(grupoIndex, usoIndex)}
                                disabled={grupo.usos.length === 1}
                                className="h-10 w-10 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                                title="Excluir este uso"
                              >
                                <FiTrash2 className="w-5 h-5 mx-auto" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_150px] gap-3 items-end">
                              <Campo label="Categoria">
                                <ButtonField
                                  onClick={() =>
                                    setModalCategoria({
                                      aberto: true,
                                      grupoIndex,
                                      usoIndex,
                                    })
                                  }
                                >
                                  {uso.categoria}
                                </ButtonField>
                              </Campo>

                              <Campo label="Valor">
                                <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
                                  <span className="px-3 text-gray-400">R$</span>

                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={uso.valor}
                                    placeholder=""
                                    onChange={(e) =>
                                      atualizarUso(
                                        grupoIndex,
                                        usoIndex,
                                        "valor",
                                        e.target.value
                                      )
                                    }
                                    className="w-full bg-transparent p-3 outline-none"
                                  />
                                </div>
                              </Campo>

                              <button
                                type="button"
                                onClick={() => adicionarUso(grupoIndex)}
                                className="h-[50px] rounded-xl border border-green-500/50 text-green-400 hover:bg-green-500/10 font-bold"
                              >
                                + Adicionar
                              </button>
                            </div>

                            {precisaDescricao && (
                              <div className="mt-4">
                                <label className="text-sm text-gray-300">
                                  Descrição do estacionamento
                                </label>

                                <input
                                  type="text"
                                  value={uso.descricao}
                                  placeholder="Ex: Shopping Tamboré, Zona Azul, Estacionamento Centro..."
                                  onChange={(e) =>
                                    atualizarUso(
                                      grupoIndex,
                                      usoIndex,
                                      "descricao",
                                      e.target.value
                                    )
                                  }
                                  className="w-full mt-2 bg-[#0B1120] border border-gray-600 focus:border-green-400 rounded-xl p-3 outline-none"
                                />

                                <p className="text-xs text-gray-500 mt-2">
                                  Obrigatório para identificar onde você
                                  estacionou.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 border-t border-gray-800 bg-[#111827]">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-center gap-8 text-sm">
                <div>
                  <p className="text-gray-500">Total de usos</p>
                  <p className="font-bold text-green-400">{totalUsos()}</p>
                </div>

                <div className="w-px h-8 bg-gray-800" />

                <div>
                  <p className="text-gray-500">Total estimado</p>
                  <p className="font-bold text-green-400">
                    {formatarMoeda(totalValor())}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5">
                <button
                  type="button"
                  onClick={cancelarUso}
                  className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={salvarUso}
                  disabled={salvando}
                  className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {etapa === "recarga" && (
        <ModalBase
          aberto={aberto}
          titulo="Recarga da TAG"
          descricao="Registre recarga manual ou automática em uma TAG pré-paga."
          onClose={cancelarRecarga}
          largura="max-w-2xl"
        >
          {tagsPrePagas.length === 0 ? (
            <div className="bg-[#0B1120] border border-yellow-500/40 rounded-2xl p-5">
              <h3 className="text-yellow-400 font-bold">Nenhuma TAG pré-paga</h3>
              <p className="text-gray-400 mt-2">
                Recarga só faz sentido para TAG pré-paga. Cadastre ou edite uma TAG dentro do veículo.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Data">
                  <ButtonField onClick={() => setModalDataRecargaAberto(true)}>
                    {formatarDataBR(dataRecarga)}
                  </ButtonField>
                </Campo>

                {tagsPrePagas.length > 1 && (
                  <Campo label="TAG destino">
                    <ButtonField onClick={() => setModalTagRecargaAberto(true)}>
                      {tagRecargaSelecionada?.nome || "Selecionar TAG"}
                    </ButtonField>
                  </Campo>
                )}

                <Campo label="Forma da recarga">
                  <ButtonField onClick={() => setModalFormaRecargaAberto(true)}>
                    {textoFormaRecarga()}
                  </ButtonField>
                </Campo>

                <Campo label={isRecargaCredito ? "Cartão" : isRecargaDinheiro ? "Carteira" : "Conta origem"}>
                  <ButtonField
                    onClick={() => {
                      if (isRecargaDinheiro) return;
                      isRecargaCredito
                        ? setModalCartaoRecargaAberto(true)
                        : setModalContaOrigemRecargaAberto(true);
                    }}
                  >
                    {isRecargaCredito
                      ? cartaoRecargaSelecionado
                        ? `${cartaoRecargaSelecionado.nome} final ${cartaoRecargaSelecionado.final_cartao}`
                        : "Selecionar cartão"
                      : isRecargaDinheiro
                      ? carteiraRecarga?.nome || "Carteira"
                      : contaOrigemRecarga?.nome || "Selecionar conta"}
                  </ButtonField>
                </Campo>

                <Campo label="Valor da recarga">
                  <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
                    <span className="px-3 text-gray-400">R$</span>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={valorRecarga}
                      placeholder=""
                      onChange={(e) => {
                        setUltimoCampoRecarga("total");
                        setValorRecarga(formatarMoedaDigitada(e.target.value));
                      }}
                      className="w-full bg-transparent p-3 outline-none"
                    />
                  </div>
                </Campo>

                {isRecargaParcelada && (
                  <Campo label="Parcelas">
                    <ButtonField onClick={() => setModalParcelasRecargaAberto(true)}>
                      {numeroParcelasRecarga}x
                    </ButtonField>
                  </Campo>
                )}
              </div>

              {isRecargaParcelada && (
                <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
                  <p className="font-bold text-white">Parcelamento da recarga</p>

                  <Campo label="Valor da parcela">
                    <div className="flex items-center mt-2 bg-[#111827] border border-gray-700 rounded-xl overflow-hidden">
                      <span className="px-3 text-gray-400">R$</span>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={valorParcelaRecarga}
                        placeholder=""
                        onChange={(e) => {
                          setUltimoCampoRecarga("parcela");
                          setValorParcelaRecarga(formatarMoedaDigitada(e.target.value));
                        }}
                        className="w-full bg-transparent p-3 outline-none"
                      />
                    </div>
                  </Campo>

                  <p className="text-xs text-gray-500 mt-3">
                    Crédito parcelado começa em 2x. A TAG recebe o valor total na hora, e o cartão recebe as parcelas na fatura.
                  </p>
                </div>
              )}

              {valorRecarga && (
                <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
                  <p className="text-xs text-gray-500">Resumo</p>

                  <p className="text-sm text-gray-300 mt-2">
                    {isRecargaCredito ? (
                      <>
                        Gerar uma saída no cartão{" "}
                        <span className="font-bold text-white">
                          {cartaoRecargaSelecionado?.nome || "selecionado"}
                        </span>{" "}
                        e adicionar{" "}
                        <span className="font-bold text-green-400">
                          {formatarMoeda(moedaParaNumero(valorRecarga))}
                        </span>{" "}
                        na TAG{" "}
                        <span className="font-bold text-white">
                          {tagRecargaSelecionada?.nome || "selecionada"}
                        </span>
                        .
                      </>
                    ) : (
                      <>
                        Transferir{" "}
                        <span className="font-bold text-green-400">
                          {formatarMoeda(moedaParaNumero(valorRecarga))}
                        </span>{" "}
                        de{" "}
                        <span className="font-bold text-white">
                          {contaOrigemRecarga?.nome || "origem"}
                        </span>{" "}
                        para{" "}
                        <span className="font-bold text-white">
                          {tagRecargaSelecionada?.nome || "TAG"}
                        </span>
                        .
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
                <button
                  type="button"
                  onClick={cancelarRecarga}
                  className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={salvarRecarga}
                  disabled={salvando}
                  className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </>
          )}
        </ModalBase>
      )}

      <DatePickerModal
        aberto={modalData.aberto}
        valor={
          modalData.grupoIndex !== null
            ? grupos[modalData.grupoIndex]?.data
            : hoje
        }
        onChange={(novaData) =>
          atualizarDataGrupo(modalData.grupoIndex, novaData)
        }
        onClose={() =>
          setModalData({
            aberto: false,
            grupoIndex: null,
          })
        }
        titulo="Data do uso da TAG"
        descricao="Escolha a data dos pedágios, estacionamentos ou mensalidade."
      />

      <SelecionarCategoriaModal
        aberto={modalCategoria.aberto}
        categorias={categorias}
        categoria={
          modalCategoria.grupoIndex !== null &&
          modalCategoria.usoIndex !== null
            ? grupos[modalCategoria.grupoIndex]?.usos?.[
                modalCategoria.usoIndex
              ]?.categoria
            : "Pedágio de uso a trabalho"
        }
        onSelecionar={(categoria) =>
          atualizarUso(
            modalCategoria.grupoIndex,
            modalCategoria.usoIndex,
            "categoria",
            categoria
          )
        }
        onClose={() =>
          setModalCategoria({
            aberto: false,
            grupoIndex: null,
            usoIndex: null,
          })
        }
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contasTag}
        contaId={contaTagId}
        onSelecionar={setContaTagId}
        onClose={() => setModalContaAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <DatePickerModal
        aberto={modalDataRecargaAberto}
        valor={dataRecarga}
        onChange={setDataRecarga}
        onClose={() => setModalDataRecargaAberto(false)}
        titulo="Data da recarga"
        descricao="Escolha a data em que a TAG foi recarregada."
      />

      <SelecionarContaModal
        aberto={modalTagRecargaAberto}
        contas={tagsPrePagas}
        contaId={tagRecargaId}
        onSelecionar={setTagRecargaId}
        onClose={() => setModalTagRecargaAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarFormaPagamentoModal
        aberto={modalFormaRecargaAberto}
        formasPagamento={formasRecarga}
        formaPagamento={formaRecarga}
        onSelecionar={(valor) => {
          setFormaRecarga(valor);

          if (valor === "credito_parcelado") {
            setContaOrigemRecargaId("");
            setNumeroParcelasRecarga((atual) =>
              Number(atual || 0) < 2 ? "2" : atual
            );
          }

          if (valor === "credito_avista") {
            setContaOrigemRecargaId("");
            setNumeroParcelasRecarga("1");
            setValorParcelaRecarga("");
          }

          if (valor === "dinheiro") {
            setCartaoRecargaId("");
            setNumeroParcelasRecarga("1");
            setValorParcelaRecarga("");
            if (carteiraRecarga) setContaOrigemRecargaId(String(carteiraRecarga.id));
          }

          if (!["credito_avista", "credito_parcelado"].includes(valor)) {
            setCartaoRecargaId("");
            setNumeroParcelasRecarga("1");
            setValorParcelaRecarga("");

            if (valor === "dinheiro") {
              if (carteiraRecarga) setContaOrigemRecargaId(String(carteiraRecarga.id));
            } else {
              definirContaBancariaRecargaPadrao();
            }
          }
        }}
        onClose={() => setModalFormaRecargaAberto(false)}
      />

      <SelecionarContaModal
        aberto={modalContaOrigemRecargaAberto}
        contas={contasOrigemRecarga}
        contaId={contaOrigemRecargaId}
        onSelecionar={setContaOrigemRecargaId}
        onClose={() => setModalContaOrigemRecargaAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartaoRecargaAberto}
        cartoes={cartoes}
        cartaoId={cartaoRecargaId}
        onSelecionar={setCartaoRecargaId}
        onClose={() => setModalCartaoRecargaAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarParcelasModal
        aberto={modalParcelasRecargaAberto}
        numeroParcelas={numeroParcelasRecarga}
        onSelecionar={setNumeroParcelasRecarga}
        onClose={() => setModalParcelasRecargaAberto(false)}
      />

      {confirmacaoRecarga.aberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4">
          <div className="w-full max-w-md bg-[#111827] border border-red-500/40 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-red-400">Recarga necessária</h2>

            <p className="text-gray-300 mt-4">
              Após este uso, a TAG ficará com saldo previsto de{" "}
              <span className="font-bold text-white">
                {formatarMoeda(confirmacaoRecarga.saldoPrevisto)}
              </span>
              . O gatilho configurado é{" "}
              <span className="font-bold text-blue-300">
                {formatarMoeda(confirmacaoRecarga.gatilho)}
              </span>
              .
            </p>

            <div className="mt-4 bg-[#0B1120] border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500">Recarga configurada</p>
              <p className="text-xl font-black text-green-400 mt-1">
                {formatarMoeda(confirmacaoRecarga.valorRecarga)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Confirme apenas se a recarga realmente aconteceu ou deve ser registrada junto com este uso.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => salvarUso({ ignorarRecargaAutomatica: true })}
                disabled={salvando}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Salvar só o uso
              </button>

              <button
                type="button"
                onClick={() => salvarUso({ registrarRecargaAutomatica: true })}
                disabled={salvando}
                className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                Salvar uso + recarga
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmacaoModal
        aberto={confirmacaoAcao.aberto}
        tipo="aviso"
        titulo={confirmacaoAcao.titulo}
        mensagem={confirmacaoAcao.mensagem}
        textoCancelar="Continuar editando"
        textoConfirmar="Confirmar"
        onCancelar={() => setConfirmacaoAcao({ aberto: false, titulo: "", mensagem: "", onConfirmar: null })}
        onConfirmar={() => {
          const acao = confirmacaoAcao.onConfirmar;
          setConfirmacaoAcao({ aberto: false, titulo: "", mensagem: "", onConfirmar: null });
          acao?.();
        }}
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
      className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
    >
      {children}
    </button>
  );
}