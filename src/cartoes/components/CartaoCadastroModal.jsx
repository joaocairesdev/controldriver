import { useEffect, useState } from "react";
import { FiCreditCard, FiPlus, FiUser, FiX } from "react-icons/fi";
import { supabase } from "../../services/supabase";
import DatePickerModal from "../../components/modals/DatePickerModal";
import ModalBase from "../../components/modals/ModalBase";
import {
  adicionarMesCompetencia,
  calcularDiaFechamentoTerceiro,
  ajustarVencimentoFimDeSemana,
  dataComDiaSeguro,
  formatarDataBR,
  moedaParaNumero,
  numeroParaMoedaInput as numeroParaMoedaPadrao,
  somenteNumeros,
  somarMesesDataISO,
  TIPOS_CARTAO,
  validarDia,
} from "../../cartoes/cartoesUtils";

export default function CartaoCadastroModal({
  aberto,
  cartaoEditando,
  onClose,
  abrirAviso,
  recarregarCartoes,
  formatarMoeda,
  formatarMoedaDigitada,
  numeroParaMoedaInput,
}) {
  const hojeISO = new Date().toISOString().split("T")[0];

  const [tipoCartao, setTipoCartao] = useState(TIPOS_CARTAO.PROPRIO);
  const [erros, setErros] = useState({});
  const [nome, setNome] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [finalCartao, setFinalCartao] = useState("");
  const [limiteTotal, setLimiteTotal] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [etapaCadastro, setEtapaCadastro] = useState(1);
  const [situacaoCartao, setSituacaoCartao] = useState("novo");
  const [modoInicioCartao, setModoInicioCartao] = useState("saldo");
  const [faturasIniciais, setFaturasIniciais] = useState([]);
  const [parcelamentosImportados, setParcelamentosImportados] = useState([]);
  const [modalVencimentoFaturaAberto, setModalVencimentoFaturaAberto] = useState(false);
  const [indiceFaturaVencimento, setIndiceFaturaVencimento] = useState(null);
  const [modalVencimentoParcelamentoAberto, setModalVencimentoParcelamentoAberto] = useState(false);
  const [indiceParcelamentoVencimento, setIndiceParcelamentoVencimento] = useState(null);

  useEffect(() => {
    if (!aberto) return;

    if (cartaoEditando) {
      setTipoCartao(cartaoEditando.tipo_cartao || TIPOS_CARTAO.PROPRIO);
      setErros({});
      setNome(cartaoEditando.nome || "");
      setResponsavelNome(cartaoEditando.responsavel_nome || "");
      setFinalCartao(cartaoEditando.final_cartao || "");
      setLimiteTotal(valorParaInput(cartaoEditando.limite_total));
      setDiaFechamento(String(cartaoEditando.dia_fechamento || ""));
      setDiaVencimento(String(cartaoEditando.dia_vencimento || ""));
      setSituacaoCartao(cartaoEditando.cartao_em_uso ? "em_uso" : "novo");
      setModoInicioCartao("saldo");
      setFaturasIniciais([criarFaturaInicialVazia()]);
      setParcelamentosImportados([criarParcelamentoVazio()]);
      setEtapaCadastro(2);
      carregarFaturasIniciaisCartaoEditando(cartaoEditando.id);
      return;
    }

    limparFormulario();
  }, [aberto, cartaoEditando]);

  function valorParaInput(valor) {
    if (numeroParaMoedaInput) return numeroParaMoedaInput(valor);
    return numeroParaMoedaPadrao(valor);
  }

  function criarFaturaInicialVazia() {
    return {
      id: `${Date.now()}-${Math.random()}`,
      valor: "",
      vencimento: hojeISO,
    };
  }

  function criarParcelamentoVazio() {
    return {
      id: `${Date.now()}-${Math.random()}`,
      descricao: "",
      valorParcela: "",
      parcelasRestantes: "2",
      primeiroVencimento: hojeISO,
    };
  }

  function limparFormulario() {
    setTipoCartao(TIPOS_CARTAO.PROPRIO);
    setErros({});
    setNome("");
    setResponsavelNome("");
    setFinalCartao("");
    setLimiteTotal("");
    setDiaFechamento("");
    setDiaVencimento("");
    setEtapaCadastro(1);
    setSituacaoCartao("novo");
    setModoInicioCartao("saldo");
    setFaturasIniciais([criarFaturaInicialVazia()]);
    setParcelamentosImportados([criarParcelamentoVazio()]);
    setModalVencimentoFaturaAberto(false);
    setIndiceFaturaVencimento(null);
    setModalVencimentoParcelamentoAberto(false);
    setIndiceParcelamentoVencimento(null);
  }

  function fecharModal() {
    limparFormulario();
    onClose();
  }

  function totalFaturasIniciais() {
    return faturasIniciais.reduce((total, fatura) => total + moedaParaNumero(fatura.valor), 0);
  }

  function totalParcelamentosImportados() {
    return parcelamentosImportados.reduce((total, parcelamento) => {
      return total + moedaParaNumero(parcelamento.valorParcela) * Number(parcelamento.parcelasRestantes || 0);
    }, 0);
  }

  function totalInicialCartao() {
    if (modoInicioCartao === "parcelamentos") return totalParcelamentosImportados();
    return totalFaturasIniciais();
  }

  function existeFaturaInicialPreenchida() {
    return faturasIniciais.some((fatura) => moedaParaNumero(fatura.valor) > 0);
  }

  function existeParcelamentoImportadoPreenchido() {
    return parcelamentosImportados.some((parcelamento) => {
      const descricaoPreenchida = String(parcelamento.descricao || "").trim().length > 0;
      const valorPreenchido = moedaParaNumero(parcelamento.valorParcela) > 0;
      const parcelasAlteradas = String(parcelamento.parcelasRestantes || "") !== "2";
      const vencimentoAlterado = Boolean(parcelamento.primeiroVencimento) && parcelamento.primeiroVencimento !== hojeISO;

      return descricaoPreenchida || valorPreenchido || parcelasAlteradas || vencimentoAlterado;
    });
  }

  function deveProcessarDadosIniciaisCartao() {
    if (situacaoCartao !== "em_uso") return false;
    if (!cartaoEditando) return true;

    if (modoInicioCartao === "parcelamentos") return existeParcelamentoImportadoPreenchido();
    return existeFaturaInicialPreenchida();
  }

  async function criarDadosIniciaisCartao(cartaoId) {
    if (modoInicioCartao === "parcelamentos") {
      for (const parcelamento of parcelamentosImportados) {
        await criarParcelamentoImportadoCartao(cartaoId, parcelamento);
      }
      return;
    }

    for (const faturaInicial of faturasIniciais) {
      await criarFaturaInicialCartao(cartaoId, faturaInicial);
    }
  }


  async function carregarFaturasIniciaisCartaoEditando(cartaoId) {
    const { data: saidasIniciais, error: erroSaidas } = await supabase
      .from("saidas")
      .select("*")
      .eq("cartao_id", Number(cartaoId))
      .eq("categoria", "Saldo inicial do cartão")
      .eq("descricao", "Fatura em aberto informada ao cadastrar o cartão")
      .order("data_vencimento", { ascending: true });

    if (erroSaidas) {
      console.error(erroSaidas);
      return;
    }

    const saidasIds = (saidasIniciais || []).map((saida) => saida.id);
    if (!saidasIds.length) return;

    const { data: parcelasIniciais, error: erroParcelas } = await supabase
      .from("saidas_parcelas")
      .select("*")
      .in("saida_id", saidasIds)
      .order("data_vencimento", { ascending: true });

    if (erroParcelas) {
      console.error(erroParcelas);
      return;
    }

    const faturasIds = [...new Set((parcelasIniciais || []).map((parcela) => parcela.fatura_id).filter(Boolean))];
    let faturasPorId = new Map();

    if (faturasIds.length) {
      const { data: faturas, error: erroFaturas } = await supabase
        .from("faturas_cartao")
        .select("*")
        .in("id", faturasIds);

      if (erroFaturas) {
        console.error(erroFaturas);
        return;
      }

      faturasPorId = new Map((faturas || []).map((fatura) => [Number(fatura.id), fatura]));
    }

    const saidasPorId = new Map((saidasIniciais || []).map((saida) => [Number(saida.id), saida]));
    const faturasCarregadas = (parcelasIniciais || []).map((parcela) => {
      const saida = saidasPorId.get(Number(parcela.saida_id));
      const fatura = faturasPorId.get(Number(parcela.fatura_id));
      const valor = Number(parcela.valor_parcela ?? saida?.valor_parcela ?? fatura?.valor_total ?? 0);

      return {
        id: `existente-${parcela.id}`,
        valor: valorParaInput(valor),
        vencimento: parcela.data_vencimento || fatura?.data_vencimento || saida?.data_vencimento || hojeISO,
        existente: true,
        saidaId: saida?.id || null,
        parcelaId: parcela.id,
        faturaId: parcela.fatura_id || null,
        valorPagoFatura: Number(fatura?.valor_pago || 0),
      };
    });

    if (faturasCarregadas.length) {
      setFaturasIniciais(faturasCarregadas);
      setSituacaoCartao("em_uso");
      setModoInicioCartao("saldo");
    }
  }

  function calcularStatusFatura(valorTotal, valorPago) {
    const total = Number(valorTotal || 0);
    const pago = Number(valorPago || 0);

    if (total <= 0) return "aberta";
    if (pago >= total - 0.005) return "paga";
    if (pago > 0) return "parcial";
    return "aberta";
  }

  async function salvarFaturaInicialExistenteCartao(cartaoId, faturaInicial) {
    const valorInicial = moedaParaNumero(faturaInicial.valor);
    const competencia = calcularFaturaInicialPorVencimento(faturaInicial.vencimento);
    const valorPagoFatura = Number(faturaInicial.valorPagoFatura || 0);
    const statusFatura = calcularStatusFatura(valorInicial, valorPagoFatura);

    if (!faturaInicial.faturaId || !faturaInicial.saidaId || !faturaInicial.parcelaId) {
      await criarFaturaInicialCartao(cartaoId, faturaInicial);
      return;
    }

    const { error: erroFatura } = await supabase
      .from("faturas_cartao")
      .update({
        mes: competencia.mes,
        ano: competencia.ano,
        data_fechamento: competencia.dataFechamento,
        data_vencimento: competencia.dataVencimento,
        valor_total: valorInicial,
        status: statusFatura,
      })
      .eq("id", faturaInicial.faturaId);

    if (erroFatura) throw erroFatura;

    const { error: erroSaida } = await supabase
      .from("saidas")
      .update({
        data_compra: competencia.dataFechamento,
        data_vencimento: competencia.dataVencimento,
        valor_total: valorInicial,
        valor_parcela: valorInicial,
      })
      .eq("id", faturaInicial.saidaId);

    if (erroSaida) throw erroSaida;

    const { error: erroParcela } = await supabase
      .from("saidas_parcelas")
      .update({
        fatura_id: faturaInicial.faturaId,
        valor_parcela: valorInicial,
        data_vencimento: competencia.dataVencimento,
      })
      .eq("id", faturaInicial.parcelaId);

    if (erroParcela) throw erroParcela;
  }

  async function salvarFaturasIniciaisCartaoEditando(cartaoId) {
    for (const faturaInicial of faturasIniciais) {
      await salvarFaturaInicialExistenteCartao(cartaoId, faturaInicial);
    }
  }

  function atualizarFaturaInicial(id, campo, valor) {
    setFaturasIniciais((lista) =>
      lista.map((fatura) => (fatura.id === id ? { ...fatura, [campo]: valor } : fatura))
    );
  }

  function atualizarParcelamentoImportado(id, campo, valor) {
    setParcelamentosImportados((lista) =>
      lista.map((parcelamento) =>
        parcelamento.id === id ? { ...parcelamento, [campo]: valor } : parcelamento
      )
    );
  }

  function adicionarFaturaInicial() {
    setFaturasIniciais((lista) => [...lista, criarFaturaInicialVazia()]);
  }

  function adicionarParcelamentoImportado() {
    setParcelamentosImportados((lista) => [...lista, criarParcelamentoVazio()]);
  }

  function removerFaturaInicial(id) {
    const fatura = faturasIniciais.find((item) => item.id === id);

    if (fatura?.existente) {
      abrirAviso(
        "Fatura existente",
        "Essa fatura já existe no banco. Para evitar apagar histórico por engano, edite o valor ou vencimento dela em vez de remover.",
        "erro"
      );
      return;
    }

    setFaturasIniciais((lista) => {
      if (lista.length <= 1) return lista;
      return lista.filter((fatura) => fatura.id !== id);
    });
  }

  function removerParcelamentoImportado(id) {
    setParcelamentosImportados((lista) => {
      if (lista.length <= 1) return lista;
      return lista.filter((parcelamento) => parcelamento.id !== id);
    });
  }

  function calcularFaturaInicialPorVencimento(dataVencimentoEscolhida) {
    const dataVencimentoReal = ajustarVencimentoFimDeSemana(dataVencimentoEscolhida);
    const data = new Date(`${dataVencimentoReal}T00:00:00`);
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    const diaFechamentoCartao = Number(diaFechamento || diaVencimento || 1);
    const diaVencimentoConfigurado = Number(diaVencimento || 1);
    let mesFechamento = mes;
    let anoFechamento = ano;

    if (diaVencimentoConfigurado < diaFechamentoCartao) {
      const anterior = adicionarMesCompetencia(anoFechamento, mesFechamento, -1);
      mesFechamento = anterior.mes;
      anoFechamento = anterior.ano;
    }

    return {
      mes,
      ano,
      dataFechamento: ajustarVencimentoFimDeSemana(
        dataComDiaSeguro(anoFechamento, mesFechamento, diaFechamentoCartao)
      ),
      dataVencimento: dataVencimentoReal,
    };
  }

  function definirErroCampo(campo, invalido, novosErros) {
    if (invalido) novosErros[campo] = "Campo obrigatório";
  }

  function limparErroCampo(campo) {
    if (!erros[campo]) return;

    setErros((atuais) => {
      const copia = { ...atuais };
      delete copia[campo];
      return copia;
    });
  }

  function classeCampo(campo) {
    return erros[campo]
      ? "border-red-500 focus:border-red-400 animate-shake"
      : "border-gray-700 focus:border-green-400";
  }

  function validarDadosBasicosCartao() {
    const novosErros = {};

    definirErroCampo("nome", !nome.trim(), novosErros);

    if (tipoCartao === TIPOS_CARTAO.PROPRIO) {
      definirErroCampo("finalCartao", !finalCartao || finalCartao.length < 4, novosErros);
      definirErroCampo("limiteTotal", moedaParaNumero(limiteTotal) <= 0, novosErros);
      definirErroCampo("diaFechamento", !validarDia(diaFechamento), novosErros);
      definirErroCampo("diaVencimento", !validarDia(diaVencimento), novosErros);
    }

    if (tipoCartao === TIPOS_CARTAO.TERCEIRO) {
      definirErroCampo("diaVencimento", !validarDia(diaVencimento), novosErros);
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  function validarFaturasIniciais() {
    const existeInvalida = faturasIniciais.some(
      (fatura) => moedaParaNumero(fatura.valor) <= 0 || !fatura.vencimento
    );

    if (existeInvalida) {
      abrirAviso("Fatura inicial", "Informe o valor e o vencimento de todas as faturas em aberto.", "erro");
      return false;
    }

    return true;
  }

  function validarParcelamentosImportados() {
    const existeInvalido = parcelamentosImportados.some((parcelamento) => {
      const descricaoOk = String(parcelamento.descricao || "").trim().length > 0;
      const valorOk = moedaParaNumero(parcelamento.valorParcela) > 0;
      const parcelasOk = Number(parcelamento.parcelasRestantes || 0) >= 1;
      const vencimentoOk = Boolean(parcelamento.primeiroVencimento);
      return !descricaoOk || !valorOk || !parcelasOk || !vencimentoOk;
    });

    if (existeInvalido) {
      abrirAviso(
        "Parcelamentos",
        "Preencha descrição, valor da parcela, parcelas restantes e próximo vencimento de todos os parcelamentos.",
        "erro"
      );
      return false;
    }

    return true;
  }

  function avancarCadastroCartao() {
    if (etapaCadastro === 1) {
      setEtapaCadastro(2);
      return;
    }

    if (etapaCadastro === 2) {
      if (!validarDadosBasicosCartao()) return;
      setEtapaCadastro(3);
      return;
    }

    if (etapaCadastro === 3) {
      if (deveProcessarDadosIniciaisCartao()) {
        if (modoInicioCartao === "parcelamentos") {
          if (!validarParcelamentosImportados()) return;
        } else if (!validarFaturasIniciais()) {
          return;
        }
      }

      setEtapaCadastro(4);
    }
  }

  function voltarCadastroCartao() {
    if (cartaoEditando && etapaCadastro <= 2) {
      fecharModal();
      return;
    }

    if (etapaCadastro <= 1) {
      fecharModal();
      return;
    }

    setEtapaCadastro((etapa) => etapa - 1);
  }

  async function criarFaturaInicialCartao(cartaoId, faturaInicial) {
    const valorInicial = moedaParaNumero(faturaInicial.valor);
    const competencia = calcularFaturaInicialPorVencimento(faturaInicial.vencimento);

    const { data: faturaCriada, error: erroFatura } = await supabase
      .from("faturas_cartao")
      .insert({
        cartao_id: Number(cartaoId),
        mes: competencia.mes,
        ano: competencia.ano,
        data_fechamento: competencia.dataFechamento,
        data_vencimento: competencia.dataVencimento,
        valor_total: valorInicial,
        valor_pago: 0,
        status: "aberta",
      })
      .select()
      .single();

    if (erroFatura) throw erroFatura;

    const { data: saidaCriada, error: erroSaida } = await supabase
      .from("saidas")
      .insert({
        data_compra: competencia.dataFechamento,
        forma_pagamento: "credito_avista",
        conta_id: null,
        cartao_id: Number(cartaoId),
        tipo_credito: "avista",
        numero_parcelas: 1,
        valor_total: valorInicial,
        valor_parcela: valorInicial,
        data_efetivacao: null,
        data_vencimento: competencia.dataVencimento,
        categoria: "Saldo inicial do cartão",
        descricao: "Fatura em aberto informada ao cadastrar o cartão",
        status: "fatura",
      })
      .select()
      .single();

    if (erroSaida) throw erroSaida;

    const { error: erroParcela } = await supabase.from("saidas_parcelas").insert({
      saida_id: saidaCriada.id,
      cartao_id: Number(cartaoId),
      fatura_id: faturaCriada.id,
      numero_parcela: 1,
      total_parcelas: 1,
      valor_parcela: valorInicial,
      data_vencimento: competencia.dataVencimento,
      status: "pendente",
    });

    if (erroParcela) throw erroParcela;
  }

  async function buscarOuCriarFaturaPorVencimento(cartaoId, dataVencimento, valorSomar) {
    const competencia = calcularFaturaInicialPorVencimento(dataVencimento);

    const { data: faturaExistente, error: erroBusca } = await supabase
      .from("faturas_cartao")
      .select("*")
      .eq("cartao_id", Number(cartaoId))
      .eq("mes", competencia.mes)
      .eq("ano", competencia.ano)
      .maybeSingle();

    if (erroBusca) throw erroBusca;

    if (faturaExistente) {
      const novoTotal = Number(faturaExistente.valor_total || 0) + Number(valorSomar || 0);

      const { data: faturaAtualizada, error: erroUpdate } = await supabase
        .from("faturas_cartao")
        .update({
          data_fechamento: competencia.dataFechamento,
          data_vencimento: competencia.dataVencimento,
          valor_total: novoTotal,
        })
        .eq("id", faturaExistente.id)
        .select()
        .single();

      if (erroUpdate) throw erroUpdate;
      return faturaAtualizada;
    }

    const { data: faturaCriada, error: erroCriar } = await supabase
      .from("faturas_cartao")
      .insert({
        cartao_id: Number(cartaoId),
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

  async function criarParcelamentoImportadoCartao(cartaoId, parcelamento) {
    const valorParcela = moedaParaNumero(parcelamento.valorParcela);
    const parcelas = Number(parcelamento.parcelasRestantes || 1);
    const valorTotal = valorParcela * parcelas;
    const primeiroVencimento = ajustarVencimentoFimDeSemana(parcelamento.primeiroVencimento);
    const competenciaInicial = calcularFaturaInicialPorVencimento(primeiroVencimento);

    const { data: saidaCriada, error: erroSaida } = await supabase
      .from("saidas")
      .insert({
        data_compra: competenciaInicial.dataFechamento,
        forma_pagamento: "credito_parcelado",
        conta_id: null,
        cartao_id: Number(cartaoId),
        tipo_credito: "parcelado",
        numero_parcelas: parcelas,
        valor_total: valorTotal,
        valor_parcela: valorParcela,
        data_efetivacao: null,
        data_vencimento: primeiroVencimento,
        categoria: "Parcelamento importado",
        descricao: String(parcelamento.descricao || "Parcelamento existente").trim(),
        status: "fatura",
      })
      .select()
      .single();

    if (erroSaida) throw erroSaida;

    const parcelasPayload = [];

    for (let index = 0; index < parcelas; index++) {
      const vencimentoParcela = ajustarVencimentoFimDeSemana(
        somarMesesDataISO(primeiroVencimento, index)
      );

      const fatura = await buscarOuCriarFaturaPorVencimento(
        cartaoId,
        vencimentoParcela,
        valorParcela
      );

      parcelasPayload.push({
        saida_id: saidaCriada.id,
        cartao_id: Number(cartaoId),
        fatura_id: fatura.id,
        numero_parcela: index + 1,
        total_parcelas: parcelas,
        valor_parcela: valorParcela,
        data_vencimento: fatura.data_vencimento || vencimentoParcela,
        status: "pendente",
      });
    }

    const { error: erroParcelas } = await supabase
      .from("saidas_parcelas")
      .insert(parcelasPayload);

    if (erroParcelas) throw erroParcelas;
  }

  async function salvarCartao() {
    if (!validarDadosBasicosCartao()) return;

    if (deveProcessarDadosIniciaisCartao()) {
      if (modoInicioCartao === "parcelamentos") {
        if (!validarParcelamentosImportados()) return;
      } else if (!validarFaturasIniciais()) {
        return;
      }
    }

    const nomeNormalizado = nome.trim();

    const { data: cartoesMesmoNome } = await supabase
      .from("cartoes")
      .select("*")
      .ilike("nome", nomeNormalizado);

    const cartaoAtivoMesmoNome = (cartoesMesmoNome || []).find(
      (cartao) => cartao.ativo === true && cartao.id !== cartaoEditando?.id
    );

    if (cartaoAtivoMesmoNome) {
      abrirAviso(
        "Cartão já cadastrado",
        "Já existe um cartão ativo com esse nome. Use outro nome ou edite o cartão existente.",
        "erro"
      );
      return;
    }

    const valorSaldoInicial = situacaoCartao === "em_uso" ? totalInicialCartao() : 0;
    const deveAtualizarSaldoInicialEditando =
      Boolean(cartaoEditando) && modoInicioCartao === "saldo" && deveProcessarDadosIniciaisCartao();

    const payload = {
      nome: nomeNormalizado,
      tipo_cartao: tipoCartao,
      responsavel_nome: null,
      final_cartao: tipoCartao === TIPOS_CARTAO.PROPRIO ? finalCartao || null : null,
      limite_total: tipoCartao === TIPOS_CARTAO.PROPRIO ? moedaParaNumero(limiteTotal) : 0,
      dia_fechamento:
        tipoCartao === TIPOS_CARTAO.PROPRIO
          ? Number(diaFechamento)
          : calcularDiaFechamentoTerceiro(diaVencimento),
      dia_vencimento: Number(diaVencimento),
      observacoes: null,
      cartao_em_uso: situacaoCartao === "em_uso",
      saldo_utilizado_inicial: cartaoEditando
        ? deveAtualizarSaldoInicialEditando
          ? valorSaldoInicial
          : Number(cartaoEditando.saldo_utilizado_inicial || 0)
        : valorSaldoInicial,
    };

    if (cartaoEditando) {
      const { error } = await supabase
        .from("cartoes")
        .update(payload)
        .eq("id", cartaoEditando.id);

      if (error) {
        console.error(error);
        abrirAviso("Erro", "Erro ao editar cartão.", "erro");
        return;
      }

      try {
        if (deveProcessarDadosIniciaisCartao()) {
          if (modoInicioCartao === "saldo") {
            await salvarFaturasIniciaisCartaoEditando(cartaoEditando.id);
          } else {
            await criarDadosIniciaisCartao(cartaoEditando.id);
          }
        }
      } catch (error) {
        console.error(error);
        abrirAviso(
          "Cartão editado com aviso",
          "O cartão foi editado, mas não foi possível importar os dados em aberto.",
          "erro"
        );
        return;
      }

      fecharModal();
      recarregarCartoes();
      return;
    }

    const cartaoInativoMesmoNome = (cartoesMesmoNome || []).find((cartao) => cartao.ativo === false);

    if (cartaoInativoMesmoNome) {
      const { data: cartaoReativado, error } = await supabase
        .from("cartoes")
        .update({ ...payload, ativo: true })
        .eq("id", cartaoInativoMesmoNome.id)
        .select()
        .single();

      if (error) {
        console.error(error);
        abrirAviso("Erro", "Erro ao reativar cartão.", "erro");
        return;
      }

      try {
        if (valorSaldoInicial > 0) {
          await criarDadosIniciaisCartao(cartaoReativado.id);
        }
      } catch (error) {
        console.error(error);
        abrirAviso(
          "Cartão reativado com aviso",
          "O cartão foi reativado, mas não foi possível criar a fatura inicial.",
          "erro"
        );
        return;
      }

      fecharModal();
      recarregarCartoes();
      abrirAviso(
        "Cartão reativado",
        "Já existia um cartão excluído com esse nome. Ele foi reativado para manter o histórico correto.",
        "info"
      );
      return;
    }

    const { data: novoCartao, error } = await supabase
      .from("cartoes")
      .insert({ ...payload, ativo: true })
      .select()
      .single();

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao criar cartão.", "erro");
      return;
    }

    try {
      if (valorSaldoInicial > 0) {
        await criarDadosIniciaisCartao(novoCartao.id);
      }
    } catch (error) {
      console.error(error);
      abrirAviso(
        "Cartão criado com aviso",
        "O cartão foi criado, mas não foi possível criar a fatura inicial.",
        "erro"
      );
      return;
    }

    fecharModal();
    recarregarCartoes();
  }

  if (!aberto) return null;

  if (etapaCadastro === 1) {
    return (
      <ModalBase
        aberto={aberto}
        titulo={cartaoEditando ? "Editar Cartão" : "Novo Cartão"}
        descricao="Cadastre seus cartões ou de terceiros para manter as faturas organizadas."
        onClose={fecharModal}
        largura="max-w-2xl"
      
        confirmarAoFecharSeAlterado>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setTipoCartao(TIPOS_CARTAO.PROPRIO);
              setEtapaCadastro(2);
            }}
            className="rounded-2xl border border-gray-700 bg-[#0B1120] hover:border-green-400 hover:bg-green-500/10 p-6 text-left transition"
          >
            <FiCreditCard className="text-green-400 w-8 h-8" />
            <h3 className="text-xl font-bold text-white mt-4">Cartão próprio</h3>
            <p className="text-gray-400 text-sm mt-2">
              Cartão no seu nome, com final obrigatório e controle normal de limite.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTipoCartao(TIPOS_CARTAO.TERCEIRO);
              setEtapaCadastro(2);
            }}
            className="rounded-2xl border border-gray-700 bg-[#0B1120] hover:border-green-400 hover:bg-green-500/10 p-6 text-left transition"
          >
            <FiUser className="text-green-400 w-8 h-8" />
            <h3 className="text-xl font-bold text-white mt-4">Cartão de terceiro</h3>
            <p className="text-gray-400 text-sm mt-2">
              Cartão de outra pessoa, ideal quando você não sabe o final ou o limite exato.
            </p>
          </button>
        </div>
      </ModalBase>
    );
  }

  const etapasVisuais = [2, 3, 4];

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 overscroll-none overflow-hidden">
        <div
          className="w-full max-w-2xl max-h-[100dvh] sm:max-h-[88vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-28 sm:pb-6 scrollbar-hide"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {cartaoEditando ? "Editar Cartão" : "Novo Cartão"}
              </h2>
              <p className="text-gray-400 mt-2">
                Cadastre seus cartões ou de terceiros para manter as faturas organizadas.
              </p>
            </div>

            <button
              type="button"
              onClick={fecharModal}
              className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shrink-0 flex items-center justify-center"
              aria-label="Fechar"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {etapaCadastro > 1 && (
            <div className="grid gap-2 mt-6" style={{ gridTemplateColumns: `repeat(${etapasVisuais.length}, minmax(0, 1fr))` }}>
              {etapasVisuais.map((etapa, index) => {
                const ativo = etapasVisuais.indexOf(etapaCadastro) >= index;
                return (
                  <div
                    key={etapa}
                    className={`h-2 rounded-full ${ativo ? "bg-green-500" : "bg-gray-800"}`}
                  />
                );
              })}
            </div>
          )}

          {etapaCadastro === 2 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white">
                {tipoCartao === TIPOS_CARTAO.TERCEIRO ? "Cartão de terceiro" : "Dados do cartão"}
              </h3>

              {tipoCartao === TIPOS_CARTAO.TERCEIRO && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <CampoCartao label="Nome do cartão" erro={erros.nome}>
                    <input
                      type="text"
                      value={nome}
                      placeholder="Ex: Cartão da mãe"
                      onChange={(event) => {
                        setNome(event.target.value);
                        limparErroCampo("nome");
                      }}
                      className={`w-full mt-2 bg-[#0B1120] border rounded-xl p-3 outline-none ${classeCampo("nome")}`}
                    />
                  </CampoCartao>

                  <CampoCartao label="Dia de vencimento" erro={erros.diaVencimento}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={diaVencimento}
                      placeholder="Ex: 10"
                      onChange={(event) => {
                        setDiaVencimento(somenteNumeros(event.target.value).slice(0, 2));
                        limparErroCampo("diaVencimento");
                      }}
                      className={`w-full mt-2 bg-[#0B1120] border rounded-xl p-3 outline-none ${classeCampo("diaVencimento")}`}
                    />
                  </CampoCartao>
                </div>
              )}

              {tipoCartao === TIPOS_CARTAO.PROPRIO && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <CampoCartao label="Nome do cartão" erro={erros.nome}>
                    <input
                      type="text"
                      value={nome}
                      placeholder="Ex: Nubank"
                      onChange={(event) => {
                        setNome(event.target.value);
                        limparErroCampo("nome");
                      }}
                      className={`w-full mt-2 bg-[#0B1120] border rounded-xl p-3 outline-none ${classeCampo("nome")}`}
                    />
                  </CampoCartao>

                  <CampoCartao label="Final do cartão" erro={erros.finalCartao}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={finalCartao}
                      placeholder="Ex: 8510"
                      onChange={(event) => {
                        setFinalCartao(somenteNumeros(event.target.value).slice(0, 4));
                        limparErroCampo("finalCartao");
                      }}
                      className={`w-full mt-2 bg-[#0B1120] border rounded-xl p-3 outline-none ${classeCampo("finalCartao")}`}
                    />
                  </CampoCartao>

                  <CampoCartao label="Limite total" erro={erros.limiteTotal}>
                    <div className={`flex items-center mt-2 bg-[#0B1120] border rounded-xl overflow-hidden ${classeCampo("limiteTotal")}`}>
                      <span className="px-3 text-gray-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={limiteTotal}
                        placeholder="0,00"
                        onChange={(event) => {
                          setLimiteTotal(formatarMoedaDigitada(event.target.value));
                          limparErroCampo("limiteTotal");
                        }}
                        className="w-full bg-transparent p-3 outline-none"
                      />
                    </div>
                  </CampoCartao>

                  <CampoCartao label="Dia de fechamento" erro={erros.diaFechamento}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={diaFechamento}
                      placeholder="Ex: 05"
                      onChange={(event) => {
                        setDiaFechamento(somenteNumeros(event.target.value).slice(0, 2));
                        limparErroCampo("diaFechamento");
                      }}
                      className={`w-full mt-2 bg-[#0B1120] border rounded-xl p-3 outline-none ${classeCampo("diaFechamento")}`}
                    />
                  </CampoCartao>

                  <CampoCartao label="Dia de vencimento" erro={erros.diaVencimento}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={diaVencimento}
                      placeholder="Ex: 10"
                      onChange={(event) => {
                        setDiaVencimento(somenteNumeros(event.target.value).slice(0, 2));
                        limparErroCampo("diaVencimento");
                      }}
                      className={`w-full mt-2 bg-[#0B1120] border rounded-xl p-3 outline-none ${classeCampo("diaVencimento")}`}
                    />
                  </CampoCartao>
                </div>
              )}
            </div>
          )}


          {etapaCadastro === 3 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white">
                {tipoCartao === TIPOS_CARTAO.TERCEIRO
                  ? "Situação do cartão de terceiro"
                  : "Situação do cartão"}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {tipoCartao === TIPOS_CARTAO.TERCEIRO
                  ? "Informe se esse cartão de terceiro começa sem lançamentos ou se já existem faturas/parcelamentos antigos para importar."
                  : "Escolha se este cartão começa zerado ou se já existe fatura/parcelamento em aberto."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setSituacaoCartao("novo");
                    setModoInicioCartao("saldo");
                  }}
                  className={`rounded-2xl border p-5 text-left transition ${
                    situacaoCartao === "novo"
                      ? "border-green-400 bg-green-500/10"
                      : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                  }`}
                >
                  <p className="text-xl font-bold">Cartão novo</p>
                  <p className="text-gray-400 text-sm mt-2">
                    {tipoCartao === TIPOS_CARTAO.TERCEIRO
                      ? "Use quando ainda não existe fatura ou compra antiga para controlar nesse cartão."
                      : "Começa sem fatura e sem valor utilizado."}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSituacaoCartao("em_uso")}
                  className={`rounded-2xl border p-5 text-left transition ${
                    situacaoCartao === "em_uso"
                      ? "border-green-400 bg-green-500/10"
                      : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                  }`}
                >
                  <p className="text-xl font-bold">Cartão já em uso</p>
                  <p className="text-gray-400 text-sm mt-2">
                    {tipoCartao === TIPOS_CARTAO.TERCEIRO
                      ? "Use quando já existem compras antigas feitas nesse cartão e que ainda serão pagas."
                      : "Use quando já existe fatura, compras ou saldo utilizado antes do app."}
                  </p>
                </button>
              </div>

              {situacaoCartao === "em_uso" && (
                <div className="mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setModoInicioCartao("saldo")}
                      className={`rounded-2xl border p-5 text-left transition ${
                        modoInicioCartao === "saldo"
                          ? "border-green-400 bg-green-500/10"
                          : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                      }`}
                    >
                      <p className="font-bold">Apenas fatura em aberto</p>
                      <p className="text-gray-400 text-sm mt-2">
                        {tipoCartao === TIPOS_CARTAO.TERCEIRO
                          ? "Cria uma ou mais faturas abertas desse cartão de terceiro com o valor informado."
                          : "Cria uma ou mais faturas abertas com o valor informado."}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModoInicioCartao("parcelamentos")}
                      className={`rounded-2xl border p-5 text-left transition ${
                        modoInicioCartao === "parcelamentos"
                          ? "border-yellow-400 bg-yellow-500/10"
                          : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                      }`}
                    >
                      <p className="font-bold">Importar parcelamentos</p>
                      <p className="text-gray-400 text-sm mt-2">
                        {tipoCartao === TIPOS_CARTAO.TERCEIRO
                          ? "Informe compras parceladas antigas feitas nesse cartão de terceiro."
                          : "Informe compras parceladas que já existem no cartão."}
                      </p>
                    </button>
                  </div>

                  {modoInicioCartao === "saldo" && (
                    <div className="mt-5 space-y-4">
                      {faturasIniciais.map((fatura, index) => (
                        <div key={fatura.id} className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
                          <div className="flex items-center justify-between gap-4">
                            <h4 className="font-bold text-white">Fatura em aberto {index + 1}</h4>
                            {faturasIniciais.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removerFaturaInicial(fatura.id)}
                                className="text-gray-500 hover:text-red-400 text-sm font-bold"
                              >
                                Remover
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                            <CampoCartao label="Valor da fatura">
                              <div className="flex items-center mt-2 bg-[#111827] border border-gray-700 rounded-xl overflow-hidden">
                                <span className="px-3 text-gray-400">R$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={fatura.valor}
                                  placeholder="0,00"
                                  onChange={(event) =>
                                    atualizarFaturaInicial(fatura.id, "valor", formatarMoedaDigitada(event.target.value))
                                  }
                                  className="w-full bg-transparent p-3 outline-none"
                                />
                              </div>
                            </CampoCartao>

                            <CampoCartao label="Vencimento da fatura">
                              <button
                                type="button"
                                onClick={() => {
                                  setIndiceFaturaVencimento(index);
                                  setModalVencimentoFaturaAberto(true);
                                }}
                                className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                              >
                                {formatarDataBR(fatura.vencimento)}
                              </button>
                            </CampoCartao>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={adicionarFaturaInicial}
                        className="w-full border border-dashed border-gray-700 hover:border-green-400 hover:bg-green-500/10 text-gray-300 hover:text-green-400 font-bold rounded-xl p-3 transition"
                      >
                        <span className="inline-flex items-center justify-center gap-2"><FiPlus /> Adicionar outra fatura</span>
                      </button>
                    </div>
                  )}

                  {modoInicioCartao === "parcelamentos" && (
                    <div className="mt-5 space-y-4">
                      {parcelamentosImportados.map((parcelamento, index) => (
                        <div key={parcelamento.id} className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
                          <div className="flex items-center justify-between gap-4">
                            <h4 className="font-bold text-white">Parcelamento {index + 1}</h4>
                            {parcelamentosImportados.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removerParcelamentoImportado(parcelamento.id)}
                                className="text-gray-500 hover:text-red-400 text-sm font-bold"
                              >
                                Remover
                              </button>
                            )}
                          </div>

                          <div className="mt-4">
                            <CampoCartao label="Descrição da compra">
                              <input
                                type="text"
                                value={parcelamento.descricao}
                                placeholder="Ex: Manutenção, seguro, peças..."
                                onChange={(event) => atualizarParcelamentoImportado(parcelamento.id, "descricao", event.target.value)}
                                className="w-full mt-2 bg-[#111827] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
                              />
                            </CampoCartao>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                            <CampoCartao label="Valor da parcela">
                              <div className="flex items-center mt-2 bg-[#111827] border border-gray-700 rounded-xl overflow-hidden">
                                <span className="px-3 text-gray-400">R$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={parcelamento.valorParcela}
                                  placeholder="0,00"
                                  onChange={(event) =>
                                    atualizarParcelamentoImportado(
                                      parcelamento.id,
                                      "valorParcela",
                                      formatarMoedaDigitada(event.target.value)
                                    )
                                  }
                                  className="w-full bg-transparent p-3 outline-none"
                                />
                              </div>
                            </CampoCartao>

                            <CampoCartao label="Parcelas restantes">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={parcelamento.parcelasRestantes}
                                placeholder="Ex: 10"
                                onChange={(event) =>
                                  atualizarParcelamentoImportado(
                                    parcelamento.id,
                                    "parcelasRestantes",
                                    somenteNumeros(event.target.value).slice(0, 3)
                                  )
                                }
                                className="w-full mt-2 bg-[#111827] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
                              />
                            </CampoCartao>

                            <CampoCartao label="Próximo vencimento">
                              <button
                                type="button"
                                onClick={() => {
                                  setIndiceParcelamentoVencimento(index);
                                  setModalVencimentoParcelamentoAberto(true);
                                }}
                                className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                              >
                                {formatarDataBR(parcelamento.primeiroVencimento)}
                              </button>
                            </CampoCartao>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={adicionarParcelamentoImportado}
                        className="w-full border border-dashed border-gray-700 hover:border-green-400 hover:bg-green-500/10 text-gray-300 hover:text-green-400 font-bold rounded-xl p-3 transition"
                      >
                        <span className="inline-flex items-center justify-center gap-2"><FiPlus /> Adicionar outro parcelamento</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {etapaCadastro === 4 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white">Resumo</h3>

              <div className="mt-4 bg-[#0B1120] border border-gray-800 rounded-2xl p-5 space-y-3">
                <ResumoLinha titulo="Tipo" valor={tipoCartao === TIPOS_CARTAO.TERCEIRO ? "Cartão de terceiro" : "Cartão próprio"} />
                <ResumoLinha
                  titulo="Cartão"
                  valor={tipoCartao === TIPOS_CARTAO.PROPRIO && finalCartao ? `${nome || "-"} final ${finalCartao}` : nome || "-"}
                />
                {tipoCartao === TIPOS_CARTAO.PROPRIO && (
                  <>
                    <ResumoLinha titulo="Limite" valor={formatarMoeda(moedaParaNumero(limiteTotal))} />
                    <ResumoLinha titulo="Fechamento" valor={`Dia ${diaFechamento || "-"}`} />
                  </>
                )}
                <ResumoLinha titulo="Vencimento" valor={`Dia ${diaVencimento || "-"}`} />

                <ResumoLinha titulo="Situação" valor={situacaoCartao === "novo" ? "Cartão novo" : "Cartão já em uso"} />
                {deveProcessarDadosIniciaisCartao() && (
                  <ResumoLinha titulo="Total inicial" valor={formatarMoeda(totalInicialCartao())} />
                )}
              </div>
            </div>
          )}

          <div className="sticky bottom-0 z-20 grid grid-cols-2 gap-4 mt-6 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] bg-[#111827] border-t border-gray-800">
            <button
              type="button"
              onClick={voltarCadastroCartao}
              className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
            >
              {etapaCadastro > 1 ? "Voltar" : "Cancelar"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (etapaCadastro === 4) {
                  salvarCartao();
                  return;
                }

                avancarCadastroCartao();
              }}
              className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              {etapaCadastro === 4 ? "Salvar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>

      <DatePickerModal
        aberto={modalVencimentoFaturaAberto}
        valor={
          indiceFaturaVencimento !== null
            ? faturasIniciais[indiceFaturaVencimento]?.vencimento || hojeISO
            : hojeISO
        }
        onChange={(valor) => {
          if (indiceFaturaVencimento === null) return;
          const fatura = faturasIniciais[indiceFaturaVencimento];
          if (!fatura) return;
          atualizarFaturaInicial(fatura.id, "vencimento", valor);
        }}
        onClose={() => {
          setModalVencimentoFaturaAberto(false);
          setIndiceFaturaVencimento(null);
        }}
        titulo="Vencimento da fatura atual"
        descricao="Escolha o vencimento real da fatura que já existe no cartão."
      />

      <DatePickerModal
        aberto={modalVencimentoParcelamentoAberto}
        valor={
          indiceParcelamentoVencimento !== null
            ? parcelamentosImportados[indiceParcelamentoVencimento]?.primeiroVencimento || hojeISO
            : hojeISO
        }
        onChange={(valor) => {
          if (indiceParcelamentoVencimento === null) return;
          const parcelamento = parcelamentosImportados[indiceParcelamentoVencimento];
          if (!parcelamento) return;
          atualizarParcelamentoImportado(parcelamento.id, "primeiroVencimento", valor);
        }}
        onClose={() => {
          setModalVencimentoParcelamentoAberto(false);
          setIndiceParcelamentoVencimento(null);
        }}
        titulo="Próximo vencimento"
        descricao="Escolha o vencimento da próxima parcela que ainda virá na fatura."
      />
    </>
  );
}

function CampoCartao({ label, erro, children }) {
  return (
    <div>
      <label className={erro ? "text-sm text-red-400" : "text-sm text-gray-300"}>{label}</label>
      {children}
      {erro && <p className="text-xs text-red-400 mt-1">{erro}</p>}
    </div>
  );
}

function ResumoLinha({ titulo, valor }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-gray-500">{titulo}</span>
      <span className="font-bold text-white text-right">{valor}</span>
    </div>
  );
}
