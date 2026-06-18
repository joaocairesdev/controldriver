import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { supabase } from "../../services/supabase";

import DatePickerModal from "./DatePickerModal";

export default function CartaoCadastroModal({
  aberto,
  cartaoEditando,
  onClose,
  abrirAviso,
  recarregarCartoes,
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
}) {
  const hojeISO = new Date().toISOString().split("T")[0];

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

  const [nome, setNome] = useState("");
  const [finalCartao, setFinalCartao] = useState("");
  const [limiteTotal, setLimiteTotal] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");

  const [etapaCadastro, setEtapaCadastro] = useState(1);
  const [situacaoCartao, setSituacaoCartao] = useState("novo");
  const [modoInicioCartao, setModoInicioCartao] = useState("saldo");
  const [faturasIniciais, setFaturasIniciais] = useState([criarFaturaInicialVazia()]);
  const [faturasIniciaisRemovidas, setFaturasIniciaisRemovidas] = useState([]);
  const [parcelamentosImportados, setParcelamentosImportados] = useState([criarParcelamentoVazio()]);
  const [modalVencimentoFaturaInicialAberto, setModalVencimentoFaturaInicialAberto] = useState(false);
  const [indiceFaturaVencimento, setIndiceFaturaVencimento] = useState(null);
  const [modalVencimentoParcelamentoAberto, setModalVencimentoParcelamentoAberto] = useState(false);
  const [indiceParcelamentoVencimento, setIndiceParcelamentoVencimento] = useState(null);

  useEffect(() => {
    if (!aberto) return;

    if (cartaoEditando) {
      setNome(cartaoEditando.nome || "");
      setFinalCartao(cartaoEditando.final_cartao || "");
      setLimiteTotal(numeroParaMoedaInput(cartaoEditando.limite_total));
      setDiaFechamento(String(cartaoEditando.dia_fechamento || ""));
      setDiaVencimento(String(cartaoEditando.dia_vencimento || ""));
      setEtapaCadastro(1);
      setSituacaoCartao(cartaoEditando.cartao_em_uso ? "em_uso" : "novo");
      setModoInicioCartao("saldo");
      setFaturasIniciais([criarFaturaInicialVazia()]);
      setFaturasIniciaisRemovidas([]);
      setParcelamentosImportados([criarParcelamentoVazio()]);
      setModalVencimentoFaturaInicialAberto(false);
      setIndiceFaturaVencimento(null);
      setModalVencimentoParcelamentoAberto(false);
      setIndiceParcelamentoVencimento(null);

      if (cartaoEditando.cartao_em_uso) {
        carregarFaturasIniciaisCartao(cartaoEditando.id);
      }

      return;
    }

    limparFormulario();
  }, [aberto, cartaoEditando]);

  function limparFormulario() {
    setNome("");
    setFinalCartao("");
    setLimiteTotal("");
    setDiaFechamento("");
    setDiaVencimento("");
    setEtapaCadastro(1);
    setSituacaoCartao("novo");
    setModoInicioCartao("saldo");
    setFaturasIniciais([criarFaturaInicialVazia()]);
    setFaturasIniciaisRemovidas([]);
    setParcelamentosImportados([criarParcelamentoVazio()]);
    setModalVencimentoFaturaInicialAberto(false);
    setIndiceFaturaVencimento(null);
    setModalVencimentoParcelamentoAberto(false);
    setIndiceParcelamentoVencimento(null);
  }

  async function carregarFaturasIniciaisCartao(cartaoId) {
    const { data: parcelasData, error: erroParcelas } = await supabase
      .from("saidas_parcelas")
      .select("*")
      .eq("cartao_id", Number(cartaoId))
      .order("data_vencimento", { ascending: true })
      .order("id", { ascending: true });

    if (erroParcelas) {
      console.error(erroParcelas);
      abrirAviso("Erro", "Erro ao carregar lançamentos iniciais do cartão.", "erro");
      return;
    }

    const saidaIds = [...new Set((parcelasData || []).map((parcela) => parcela.saida_id).filter(Boolean))];
    const faturaIds = [...new Set((parcelasData || []).map((parcela) => parcela.fatura_id).filter(Boolean))];

    const { data: saidasData, error: erroSaidas } = saidaIds.length
      ? await supabase.from("saidas").select("*").in("id", saidaIds)
      : { data: [], error: null };

    if (erroSaidas) {
      console.error(erroSaidas);
      abrirAviso("Erro", "Erro ao carregar compras importadas do cartão.", "erro");
      return;
    }

    const { data: faturasData, error: erroFaturas } = faturaIds.length
      ? await supabase.from("faturas_cartao").select("*").in("id", faturaIds)
      : { data: [], error: null };

    if (erroFaturas) {
      console.error(erroFaturas);
      abrirAviso("Erro", "Erro ao carregar faturas do cartão.", "erro");
      return;
    }

    const saidasImportadas = (saidasData || []).filter(
      (saida) => saida.categoria === "Parcelamento importado"
    );

    if (saidasImportadas.length) {
      const parcelamentos = saidasImportadas.map((saida) => {
        const parcelasDaSaida = (parcelasData || [])
          .filter((parcela) => String(parcela.saida_id) === String(saida.id))
          .sort((a, b) => Number(a.numero_parcela || 0) - Number(b.numero_parcela || 0));

        const primeiraParcela = parcelasDaSaida[0];

        return {
          id: `existente-parcelamento-${saida.id}`,
          descricao: saida.descricao || "Parcelamento existente",
          valorParcela: numeroParaMoedaInput(
            primeiraParcela?.valor_parcela || saida.valor_parcela || 0
          ),
          parcelasRestantes: String(parcelasDaSaida.length || saida.numero_parcelas || 1),
          primeiroVencimento:
            primeiraParcela?.data_vencimento || saida.data_vencimento || hojeISO,
          existente: true,
          saida_id: saida.id,
        };
      });

      setModoInicioCartao("parcelamentos");
      setParcelamentosImportados(parcelamentos);
      setFaturasIniciais([criarFaturaInicialVazia()]);
      return;
    }

    const faturasIniciaisEncontradas = (parcelasData || [])
      .map((parcela) => {
        const saida = (saidasData || []).find((item) => String(item.id) === String(parcela.saida_id));
        const fatura = (faturasData || []).find((item) => String(item.id) === String(parcela.fatura_id));

        if (saida?.categoria !== "Saldo inicial do cartão") return null;

        return {
          id: `existente-${parcela.id}`,
          valor: numeroParaMoedaInput(parcela.valor_parcela || saida.valor_total || fatura?.valor_total || 0),
          vencimento: fatura?.data_vencimento || parcela.data_vencimento || hojeISO,
          existente: true,
          fatura_id: parcela.fatura_id,
          saida_id: parcela.saida_id,
          parcela_id: parcela.id,
        };
      })
      .filter(Boolean);

    setModoInicioCartao("saldo");

    if (faturasIniciaisEncontradas.length) {
      setFaturasIniciais(faturasIniciaisEncontradas);
      return;
    }

    setFaturasIniciais([
      {
        id: `${Date.now()}-${Math.random()}`,
        valor: numeroParaMoedaInput(cartaoEditando?.saldo_utilizado_inicial || 0),
        vencimento: hojeISO,
      },
    ]);
  }

  function fecharModal() {
    limparFormulario();
    onClose();
  }

  function somenteNumeros(valor) {
    return String(valor).replace(/\D/g, "");
  }

  function validarDia(valor) {
    const numero = Number(valor);
    if (!valor) return false;
    if (numero < 1) return false;
    if (numero > 31) return false;
    return true;
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

  function ajustarVencimentoFimDeSemana(dataISO) {
    const data = new Date(`${dataISO}T00:00:00`);
    const diaSemana = data.getDay();

    if (diaSemana === 6) data.setDate(data.getDate() + 2);
    if (diaSemana === 0) data.setDate(data.getDate() + 1);

    return data.toISOString().split("T")[0];
  }

  function calcularFaturaInicialPorVencimento(dataVencimentoEscolhida) {
    const dataVencimentoReal = ajustarVencimentoFimDeSemana(dataVencimentoEscolhida);
    const data = new Date(`${dataVencimentoReal}T00:00:00`);

    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();

    const diaFechamentoCartao = Number(diaFechamento || 1);
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
      dataFechamento: dataComDiaSeguro(anoFechamento, mesFechamento, diaFechamentoCartao),
      dataVencimento: dataVencimentoReal,
    };
  }

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "-";
    const [ano, mes, dia] = String(dataISOTexto).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function atualizarFaturaInicial(id, campo, valor) {
    setFaturasIniciais((lista) =>
      lista.map((fatura) =>
        fatura.id === id ? { ...fatura, [campo]: valor } : fatura
      )
    );
  }

  function adicionarFaturaInicial() {
    setFaturasIniciais((lista) => [...lista, criarFaturaInicialVazia()]);
  }

  function removerFaturaInicial(id) {
    setFaturasIniciais((lista) => {
      if (lista.length <= 1) return lista;

      const faturaRemovida = lista.find((fatura) => fatura.id === id);

      if (faturaRemovida?.existente) {
        setFaturasIniciaisRemovidas((removidas) => [
          ...removidas,
          {
            fatura_id: faturaRemovida.fatura_id,
            saida_id: faturaRemovida.saida_id,
            parcela_id: faturaRemovida.parcela_id,
          },
        ]);
      }

      return lista.filter((fatura) => fatura.id !== id);
    });
  }

  function totalFaturasIniciais() {
    return faturasIniciais.reduce(
      (total, fatura) => total + moedaParaNumero(fatura.valor),
      0
    );
  }

  function atualizarParcelamentoImportado(id, campo, valor) {
    setParcelamentosImportados((lista) =>
      lista.map((parcelamento) =>
        parcelamento.id === id ? { ...parcelamento, [campo]: valor } : parcelamento
      )
    );
  }

  function adicionarParcelamentoImportado() {
    setParcelamentosImportados((lista) => [...lista, criarParcelamentoVazio()]);
  }

  function removerParcelamentoImportado(id) {
    setParcelamentosImportados((lista) => {
      if (lista.length <= 1) return lista;
      return lista.filter((parcelamento) => parcelamento.id !== id);
    });
  }

  function totalParcelamentosImportados() {
    return parcelamentosImportados.reduce((total, parcelamento) => {
      const valorParcela = moedaParaNumero(parcelamento.valorParcela);
      const parcelas = Number(parcelamento.parcelasRestantes || 0);
      return total + valorParcela * parcelas;
    }, 0);
  }

  function totalInicialCartao() {
    if (modoInicioCartao === "parcelamentos") {
      return totalParcelamentosImportados();
    }

    return totalFaturasIniciais();
  }

  function validarParcelamentosImportados() {
    if (!parcelamentosImportados.length) {
      abrirAviso("Parcelamentos", "Adicione pelo menos um parcelamento.", "erro");
      return false;
    }

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

  function validarFaturasIniciais() {
    if (!faturasIniciais.length) {
      abrirAviso("Fatura inicial", "Adicione pelo menos uma fatura em aberto.", "erro");
      return false;
    }

    const existeInvalida = faturasIniciais.some(
      (fatura) => moedaParaNumero(fatura.valor) <= 0 || !fatura.vencimento
    );

    if (existeInvalida) {
      abrirAviso(
        "Fatura inicial",
        "Informe o valor e o vencimento de todas as faturas em aberto.",
        "erro"
      );
      return false;
    }

    return true;
  }

  function validarDadosBasicosCartao() {
    if (!nome.trim()) {
      abrirAviso("Nome obrigatório", "Digite o nome do cartão.", "erro");
      return false;
    }

    if (!finalCartao || finalCartao.length < 4) {
      abrirAviso("Final do cartão", "Digite os 4 últimos números do cartão.", "erro");
      return false;
    }

    if (!limiteTotal) {
      abrirAviso("Limite obrigatório", "Digite o limite total do cartão.", "erro");
      return false;
    }

    if (!validarDia(diaFechamento)) {
      abrirAviso("Dia de fechamento inválido", "O dia de fechamento precisa estar entre 1 e 31.", "erro");
      return false;
    }

    if (!validarDia(diaVencimento)) {
      abrirAviso("Dia de vencimento inválido", "O dia de vencimento precisa estar entre 1 e 31.", "erro");
      return false;
    }

    return true;
  }

  function avancarCadastroCartao() {
    if (etapaCadastro === 1) {
      if (!validarDadosBasicosCartao()) return;

      if (cartaoEditando) {
        setEtapaCadastro(situacaoCartao === "em_uso" ? 3 : 4);
      } else {
        setEtapaCadastro(2);
      }

      return;
    }

    if (etapaCadastro === 2) {
      if (situacaoCartao === "novo") {
        setEtapaCadastro(4);
        return;
      }

      setEtapaCadastro(3);
      return;
    }

    if (etapaCadastro === 3) {
      if (!cartaoEditando && modoInicioCartao === "parcelamentos") {
        if (!validarParcelamentosImportados()) return;
        setEtapaCadastro(4);
        return;
      }

      if (!validarFaturasIniciais()) return;

      setEtapaCadastro(4);
    }
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

  function somarMesesDataISO(dataISO, mesesParaSomar) {
    const data = new Date(`${dataISO}T00:00:00`);
    data.setMonth(data.getMonth() + mesesParaSomar);
    return data.toISOString().split("T")[0];
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

  async function atualizarFaturaInicialExistente(faturaInicial) {
    const valorInicial = moedaParaNumero(faturaInicial.valor);
    const competencia = calcularFaturaInicialPorVencimento(faturaInicial.vencimento);

    const { error: erroFatura } = await supabase
      .from("faturas_cartao")
      .update({
        mes: competencia.mes,
        ano: competencia.ano,
        data_fechamento: competencia.dataFechamento,
        data_vencimento: competencia.dataVencimento,
        valor_total: valorInicial,
      })
      .eq("id", faturaInicial.fatura_id);

    if (erroFatura) throw erroFatura;

    const { error: erroSaida } = await supabase
      .from("saidas")
      .update({
        data_compra: competencia.dataFechamento,
        valor_total: valorInicial,
        valor_parcela: valorInicial,
        data_vencimento: competencia.dataVencimento,
        categoria: "Saldo inicial do cartão",
        descricao: "Fatura em aberto informada ao cadastrar o cartão",
        status: "fatura",
      })
      .eq("id", faturaInicial.saida_id);

    if (erroSaida) throw erroSaida;

    const { error: erroParcela } = await supabase
      .from("saidas_parcelas")
      .update({
        valor_parcela: valorInicial,
        data_vencimento: competencia.dataVencimento,
        status: "pendente",
      })
      .eq("id", faturaInicial.parcela_id);

    if (erroParcela) throw erroParcela;
  }

  async function excluirFaturasIniciaisRemovidas() {
    for (const removida of faturasIniciaisRemovidas) {
      if (removida.parcela_id) {
        const { error } = await supabase
          .from("saidas_parcelas")
          .delete()
          .eq("id", removida.parcela_id);

        if (error) throw error;
      }

      if (removida.saida_id) {
        const { error } = await supabase
          .from("saidas")
          .delete()
          .eq("id", removida.saida_id);

        if (error) throw error;
      }

      if (removida.fatura_id) {
        const { error } = await supabase
          .from("faturas_cartao")
          .delete()
          .eq("id", removida.fatura_id);

        if (error) throw error;
      }
    }
  }

  async function sincronizarFaturasIniciaisCartao(cartaoId) {
    await excluirFaturasIniciaisRemovidas();

    for (const faturaInicial of faturasIniciais) {
      if (faturaInicial.existente) {
        await atualizarFaturaInicialExistente(faturaInicial);
      } else {
        await criarFaturaInicialCartao(cartaoId, faturaInicial);
      }
    }
  }

  async function recalcularFaturasCartao(cartaoId) {
    const { data: faturasData, error: erroFaturas } = await supabase
      .from("faturas_cartao")
      .select("id, valor_pago")
      .eq("cartao_id", Number(cartaoId));

    if (erroFaturas) throw erroFaturas;

    for (const fatura of faturasData || []) {
      const { data: parcelasData, error: erroParcelas } = await supabase
        .from("saidas_parcelas")
        .select("valor_parcela")
        .eq("fatura_id", fatura.id);

      if (erroParcelas) throw erroParcelas;

      const total = (parcelasData || []).reduce(
        (soma, parcela) => soma + Number(parcela.valor_parcela || 0),
        0
      );

      const pago = Math.min(Number(fatura.valor_pago || 0), total);
      const status = total <= 0 ? "aberta" : pago >= total ? "paga" : pago > 0 ? "parcial" : "aberta";

      const { error: erroUpdate } = await supabase
        .from("faturas_cartao")
        .update({ valor_total: total, valor_pago: pago, status })
        .eq("id", fatura.id);

      if (erroUpdate) throw erroUpdate;
    }
  }

  async function excluirLancamentosIniciaisCartao(cartaoId, categorias) {
    const { data: saidasData, error: erroSaidas } = await supabase
      .from("saidas")
      .select("id")
      .eq("cartao_id", Number(cartaoId))
      .in("categoria", categorias);

    if (erroSaidas) throw erroSaidas;

    const saidaIds = (saidasData || []).map((saida) => saida.id);
    if (!saidaIds.length) return;

    const { error: erroParcelas } = await supabase
      .from("saidas_parcelas")
      .delete()
      .in("saida_id", saidaIds);

    if (erroParcelas) throw erroParcelas;

    const { error: erroDeleteSaidas } = await supabase
      .from("saidas")
      .delete()
      .in("id", saidaIds);

    if (erroDeleteSaidas) throw erroDeleteSaidas;

    await recalcularFaturasCartao(cartaoId);
  }

  async function salvarCartao() {
    if (!validarDadosBasicosCartao()) return;

    if (situacaoCartao === "em_uso") {
      if (modoInicioCartao === "parcelamentos") {
        if (!validarParcelamentosImportados()) return;
      } else {
        if (!validarFaturasIniciais()) return;
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

    const valorSaldoInicial =
      situacaoCartao === "em_uso"
        ? totalInicialCartao()
        : 0;

    const payload = {
      nome: nomeNormalizado,
      final_cartao: finalCartao,
      limite_total: moedaParaNumero(limiteTotal),
      dia_fechamento: Number(diaFechamento),
      dia_vencimento: Number(diaVencimento),
      cartao_em_uso: situacaoCartao === "em_uso",
      saldo_utilizado_inicial: valorSaldoInicial,
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
        if (situacaoCartao === "em_uso") {
          if (modoInicioCartao === "parcelamentos") {
            await excluirLancamentosIniciaisCartao(cartaoEditando.id, [
              "Saldo inicial do cartão",
              "Parcelamento importado",
            ]);

            for (const parcelamento of parcelamentosImportados) {
              await criarParcelamentoImportadoCartao(cartaoEditando.id, parcelamento);
            }
          } else {
            await excluirLancamentosIniciaisCartao(cartaoEditando.id, ["Parcelamento importado"]);
            await sincronizarFaturasIniciaisCartao(cartaoEditando.id);
          }
        } else {
          await excluirLancamentosIniciaisCartao(cartaoEditando.id, [
            "Saldo inicial do cartão",
            "Parcelamento importado",
          ]);
        }
      } catch (error) {
        console.error(error);
        abrirAviso(
          "Cartão editado com aviso",
          "O cartão foi editado, mas não foi possível atualizar as faturas iniciais.",
          "erro"
        );
        return;
      }

      fecharModal();
      recarregarCartoes();
      return;
    }

    const cartaoInativoMesmoNome = (cartoesMesmoNome || []).find(
      (cartao) => cartao.ativo === false
    );

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
          if (modoInicioCartao === "parcelamentos") {
            for (const parcelamento of parcelamentosImportados) {
              await criarParcelamentoImportadoCartao(cartaoReativado.id, parcelamento);
            }
          } else {
            for (const faturaInicial of faturasIniciais) {
              await criarFaturaInicialCartao(cartaoReativado.id, faturaInicial);
            }
          }
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
      .insert({
        ...payload,
        ativo: true,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao criar cartão.", "erro");
      return;
    }

    try {
      if (valorSaldoInicial > 0) {
        if (modoInicioCartao === "parcelamentos") {
          for (const parcelamento of parcelamentosImportados) {
            await criarParcelamentoImportadoCartao(novoCartao.id, parcelamento);
          }
        } else {
          for (const faturaInicial of faturasIniciais) {
            await criarFaturaInicialCartao(novoCartao.id, faturaInicial);
          }
        }
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
                {cartaoEditando
                  ? "Altere os dados do cartão cadastrado"
                  : "Cadastre um cartão novo ou informe uma fatura já existente."}
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

          <div
            className={`grid ${
              cartaoEditando ? (situacaoCartao === "em_uso" ? "grid-cols-3" : "grid-cols-2") : "grid-cols-4"
            } gap-2 mt-6`}
          >
            {Array.from(
              { length: cartaoEditando ? (situacaoCartao === "em_uso" ? 3 : 2) : 4 },
              (_, index) => {
                const etapasVisuais = cartaoEditando
                  ? situacaoCartao === "em_uso"
                    ? [1, 3, 4]
                    : [1, 4]
                  : [1, 2, 3, 4];
                const etapaReal = etapasVisuais[index];
                const ativo = etapasVisuais.indexOf(etapaCadastro) >= index;

                return (
                  <div
                    key={etapaReal}
                    className={`h-2 rounded-full ${
                      ativo ? "bg-green-500" : "bg-gray-800"
                    }`}
                  />
                );
              }
            )}
          </div>

          {etapaCadastro === 1 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white">Dados do cartão</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <CampoCartao label="Nome do Cartão">
                  <input
                    type="text"
                    value={nome}
                    placeholder="Ex: Nubank PJ"
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
                  />
                </CampoCartao>

                <CampoCartao label="Final do Cartão">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={finalCartao}
                    placeholder="Ex: 8510"
                    onChange={(e) =>
                      setFinalCartao(somenteNumeros(e.target.value).slice(0, 4))
                    }
                    className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
                  />
                </CampoCartao>
              </div>

              <div className="mt-4">
                <CampoCartao label="Limite Total">
                  <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
                    <span className="px-3 text-gray-400">R$</span>

                    <input
                      type="text"
                      inputMode="decimal"
                      value={limiteTotal}
                      placeholder="0,00"
                      onChange={(e) =>
                        setLimiteTotal(formatarMoedaDigitada(e.target.value))
                      }
                      className="w-full bg-transparent p-3 outline-none"
                    />
                  </div>
                </CampoCartao>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <CampoCartao label="Dia de Fechamento">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={diaFechamento}
                    placeholder="Ex: 05"
                    onChange={(e) =>
                      setDiaFechamento(somenteNumeros(e.target.value).slice(0, 2))
                    }
                    className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
                  />
                </CampoCartao>

                <CampoCartao label="Dia de Vencimento">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={diaVencimento}
                    placeholder="Ex: 10"
                    onChange={(e) =>
                      setDiaVencimento(somenteNumeros(e.target.value).slice(0, 2))
                    }
                    className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
                  />
                </CampoCartao>
              </div>
            </div>
          )}

          {!cartaoEditando && etapaCadastro === 2 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white">Situação do cartão</h3>
              <p className="text-gray-400 text-sm mt-1">
                Escolha se este cartão está começando zerado ou se já possui fatura em aberto.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <button
                  type="button"
                  onClick={() => setSituacaoCartao("novo")}
                  className={`rounded-2xl border p-5 text-left transition ${
                    situacaoCartao === "novo"
                      ? "border-green-400 bg-green-500/10"
                      : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                  }`}
                >
                  <p className="text-xl font-bold">Cartão novo</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Começa sem fatura e sem valor utilizado.
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
                    Use quando já existe fatura, compras ou saldo utilizado antes do app.
                  </p>
                </button>
              </div>
            </div>
          )}

          {(!cartaoEditando || (cartaoEditando && situacaoCartao === "em_uso")) && etapaCadastro === 3 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white">
                {cartaoEditando ? "Faturas iniciais" : "Como deseja iniciar?"}
              </h3>

              {!cartaoEditando && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                  <button
                    type="button"
                    onClick={() => setModoInicioCartao("saldo")}
                    className={`rounded-2xl border p-5 text-left transition ${
                      modoInicioCartao === "saldo"
                        ? "border-green-400 bg-green-500/10"
                        : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                    }`}
                  >
                    <p className="font-bold">Apenas saldo utilizado</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Cria uma fatura aberta com o valor informado.
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
                      Informe compras parceladas que já existem no banco.
                    </p>
                  </button>
                </div>
              )}

              {modoInicioCartao === "saldo" && (
                <div className="mt-5 space-y-4">
                  {faturasIniciais.map((fatura, index) => (
                    <div
                      key={fatura.id}
                      className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="font-bold text-white">
                          Fatura em aberto {index + 1}
                        </h4>

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
                              onChange={(e) =>
                                atualizarFaturaInicial(
                                  fatura.id,
                                  "valor",
                                  formatarMoedaDigitada(e.target.value)
                                )
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
                              setModalVencimentoFaturaInicialAberto(true);
                            }}
                            className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                          >
                            {formatarDataBR(fatura.vencimento)}
                          </button>
                        </CampoCartao>
                      </div>

                      <p className="text-xs text-gray-500 mt-3">
                        Se o vencimento cair em sábado ou domingo, o app ajusta para segunda ao salvar.
                      </p>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={adicionarFaturaInicial}
                    className="w-full border border-dashed border-gray-700 hover:border-green-400 hover:bg-green-500/10 text-gray-300 hover:text-green-400 font-bold rounded-xl p-3 transition"
                  >
                    + Adicionar outra fatura em aberto
                  </button>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                    <p className="text-sm text-gray-400">Total inicial informado</p>
                    <p className="text-2xl font-black text-green-400 mt-1">
                      {formatarMoeda(totalFaturasIniciais())}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500">
                    O app criará automaticamente uma fatura aberta para cada vencimento informado.
                  </p>
                </div>
              )}
            </div>
          )}


          {modoInicioCartao === "parcelamentos" && etapaCadastro === 3 && (
            <div className="mt-5 space-y-4">
              {parcelamentosImportados.map((parcelamento, index) => (
                <div
                  key={parcelamento.id}
                  className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-white">
                        Parcelamento {index + 1}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Compra parcelada já existente no cartão.
                      </p>
                    </div>

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
                        placeholder="Ex: Celular, Seguro, Peças do carro..."
                        onChange={(e) =>
                          atualizarParcelamentoImportado(
                            parcelamento.id,
                            "descricao",
                            e.target.value
                          )
                        }
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
                          onChange={(e) =>
                            atualizarParcelamentoImportado(
                              parcelamento.id,
                              "valorParcela",
                              formatarMoedaDigitada(e.target.value)
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
                        onChange={(e) =>
                          atualizarParcelamentoImportado(
                            parcelamento.id,
                            "parcelasRestantes",
                            somenteNumeros(e.target.value).slice(0, 3)
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

                  <div className="mt-4 bg-[#111827] border border-gray-800 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Total restante desse parcelamento</p>
                    <p className="font-black text-green-400 mt-1">
                      {formatarMoeda(
                        moedaParaNumero(parcelamento.valorParcela) *
                          Number(parcelamento.parcelasRestantes || 0)
                      )}
                    </p>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={adicionarParcelamentoImportado}
                className="w-full border border-dashed border-gray-700 hover:border-green-400 hover:bg-green-500/10 text-gray-300 hover:text-green-400 font-bold rounded-xl p-3 transition"
              >
                + Adicionar outro parcelamento
              </button>

              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <p className="text-sm text-gray-400">Total de parcelamentos importados</p>
                <p className="text-2xl font-black text-green-400 mt-1">
                  {formatarMoeda(totalParcelamentosImportados())}
                </p>
              </div>

              <p className="text-xs text-gray-500">
                O app criará as próximas faturas automaticamente, uma parcela por mês, começando pelo vencimento informado.
              </p>
            </div>
          )}

          {etapaCadastro === 4 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white">Resumo</h3>

              <div className="mt-4 bg-[#0B1120] border border-gray-800 rounded-2xl p-5 space-y-3">
                <ResumoLinha titulo="Cartão" valor={`${nome || "-"} final ${finalCartao || "-"}`} />
                <ResumoLinha titulo="Limite" valor={formatarMoeda(moedaParaNumero(limiteTotal))} />
                <ResumoLinha titulo="Fechamento" valor={`Dia ${diaFechamento || "-"}`} />
                <ResumoLinha titulo="Vencimento" valor={`Dia ${diaVencimento || "-"}`} />
                <ResumoLinha
                  titulo="Situação"
                  valor={situacaoCartao === "novo" ? "Cartão novo" : "Cartão já em uso"}
                />

                {situacaoCartao === "em_uso" && (
                  <>
                    <ResumoLinha
                      titulo="Total inicial"
                      valor={formatarMoeda(totalInicialCartao())}
                    />

                    {!cartaoEditando && modoInicioCartao === "parcelamentos" ? (
                      <>
                        <ResumoLinha
                          titulo="Modo"
                          valor="Importar parcelamentos existentes"
                        />

                        {parcelamentosImportados.map((parcelamento, index) => (
                          <ResumoLinha
                            key={parcelamento.id}
                            titulo={`Parcelamento ${index + 1}`}
                            valor={`${parcelamento.descricao || "-"} • ${parcelamento.parcelasRestantes || 0}x de ${formatarMoeda(moedaParaNumero(parcelamento.valorParcela))}`}
                          />
                        ))}
                      </>
                    ) : (
                      <>
                        {faturasIniciais.map((fatura, index) => (
                          <ResumoLinha
                            key={fatura.id}
                            titulo={`Fatura ${index + 1}`}
                            valor={`${formatarMoeda(moedaParaNumero(fatura.valor))} • vence ${formatarDataBR(ajustarVencimentoFimDeSemana(fatura.vencimento))}`}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="sticky bottom-0 z-20 grid grid-cols-2 gap-4 mt-6 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] bg-[#111827] border-t border-gray-800">
            <button
              type="button"
              onClick={() => {
                if (etapaCadastro > 1) {
                  if (cartaoEditando) {
                    if (etapaCadastro === 4 && situacaoCartao === "em_uso") {
                      setEtapaCadastro(3);
                    } else {
                      setEtapaCadastro(1);
                    }
                  } else {
                    setEtapaCadastro((etapa) => etapa - 1);
                  }

                  return;
                }

                fecharModal();
              }}
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
        aberto={modalVencimentoFaturaInicialAberto}
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
          setModalVencimentoFaturaInicialAberto(false);
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

function CampoCartao({ label, children }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>
      {children}
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
