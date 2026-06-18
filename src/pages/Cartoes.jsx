import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCreditCard, FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { supabase } from "../services/supabase";

import CartaoCadastroModal from "../components/modals/CartaoCadastroModal";
import DetalheFaturaModal from "../components/modals/DetalheFaturaModal";

export default function Cartoes() {
  const [cartoes, setCartoes] = useState([]);
  const [contas, setContas] = useState([]);
  const [cartaoSelecionado, setCartaoSelecionado] = useState(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [cartaoEditando, setCartaoEditando] = useState(null);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState(null);

  const [modalAviso, setModalAviso] = useState({
    aberto: false,
    titulo: "",
    mensagem: "",
    tipo: "info",
  });

  const [nome, setNome] = useState("");
  const [finalCartao, setFinalCartao] = useState("");
  const [limiteTotal, setLimiteTotal] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");

  const [etapaCadastro, setEtapaCadastro] = useState(1);
  const [situacaoCartao, setSituacaoCartao] = useState("novo");
  const hojeISO = new Date().toISOString().split("T")[0];

  const [modoInicioCartao, setModoInicioCartao] = useState("saldo");
  const [saldoUtilizadoInicial, setSaldoUtilizadoInicial] = useState("");
  const [vencimentoFaturaInicial, setVencimentoFaturaInicial] = useState(hojeISO);
  const [modalVencimentoFaturaInicialAberto, setModalVencimentoFaturaInicialAberto] = useState(false);

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    await Promise.all([carregarCartoes(), carregarContas()]);
  }

  async function carregarContas() {
    const { data, error } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("id");

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao carregar contas.", "erro");
      return;
    }

    const contasComSaldo = await Promise.all(
      (data || []).map(async (conta) => {
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

        const totalTransferenciasRecebidas = (transferenciasRecebidas || []).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: transferenciasEnviadas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_origem_id", contaId);

        const totalTransferenciasEnviadas = (transferenciasEnviadas || []).reduce(
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

        return {
          ...conta,
          tipo_conta: conta.tipo_conta || "banco",
          saldo_atual:
            Number(conta.saldo_inicial || 0) +
            totalEntradas +
            totalEntradasAvulsas +
            totalTransferenciasRecebidas -
            totalSaidas -
            totalTransferenciasEnviadas,
        };
      })
    );

    setContas(contasComSaldo);
  }

  async function carregarCartoes() {
    const { data, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("ativo", true)
      .order("id");

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao carregar cartões.", "erro");
      return;
    }

    const idsCartoes = (data || []).map((cartao) => cartao.id);

    const { data: faturasData, error: erroFaturas } =
      idsCartoes.length > 0
        ? await supabase
            .from("faturas_cartao")
            .select("*")
            .in("cartao_id", idsCartoes)
            .in("status", ["aberta", "fechada", "parcial"])
        : { data: [], error: null };

    if (erroFaturas) {
      console.error(erroFaturas);
      abrirAviso("Erro", "Erro ao carregar faturas dos cartões.", "erro");
      return;
    }

    const idsFaturas = (faturasData || []).map((fatura) => fatura.id);

    const { data: parcelasData, error: erroParcelas } =
      idsFaturas.length > 0
        ? await supabase
            .from("saidas_parcelas")
            .select("fatura_id, valor_parcela")
            .in("fatura_id", idsFaturas)
        : { data: [], error: null };

    if (erroParcelas) {
      console.error(erroParcelas);
      abrirAviso("Erro", "Erro ao carregar parcelas dos cartões.", "erro");
      return;
    }

    const totalParcelasPorFatura = (parcelasData || []).reduce((acc, parcela) => {
      const id = String(parcela.fatura_id);
      acc[id] = (acc[id] || 0) + Number(parcela.valor_parcela || 0);
      return acc;
    }, {});

    const cartoesComResumo = (data || []).map((cartao) => {
      const usado = (faturasData || [])
        .filter((fatura) => String(fatura.cartao_id) === String(cartao.id))
        .reduce((soma, fatura) => {
          const totalFatura = Math.max(
            Number(fatura.valor_total || 0),
            Number(totalParcelasPorFatura[String(fatura.id)] || 0)
          );

          return soma + Math.max(totalFatura - Number(fatura.valor_pago || 0), 0);
        }, 0);

      const limite = Number(cartao.limite_total || 0);
      const disponivel = limite - usado;
      const percentual = limite > 0 ? (usado / limite) * 100 : 0;
      const percentualBarra = Math.min(percentual, 100);
      const limiteEstourado = usado > limite;

      return {
        ...cartao,
        usado,
        disponivel,
        percentual,
        percentualBarra,
        limiteEstourado,
      };
    });

    setCartoes(cartoesComResumo);

    if (cartaoSelecionado) {
      const atualizado = cartoesComResumo.find(
        (cartao) => String(cartao.id) === String(cartaoSelecionado.id)
      );

      if (atualizado) setCartaoSelecionado(atualizado);
    }
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "-";
    const [ano, mes, dia] = String(dataISOTexto).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function formatarMoedaDigitada(valor) {
    const somenteDigitos = String(valor).replace(/\D/g, "");
    const centavos = Number(somenteDigitos || 0);

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

  function corDisponivel(valor) {
  if (Number(valor) < 0) return "text-red-500 font-bold";
  if (Number(valor) === 0) return "text-gray-500";
  return "text-green-400";
}

  function corBarra(percentual) {
    if (Number(percentual) >= 100) return "bg-red-500";
    if (Number(percentual) >= 80) return "bg-yellow-400";
    return "bg-green-500";
  }

  function abrirAviso(titulo, mensagem, tipo = "info") {
    setModalAviso({
      aberto: true,
      titulo,
      mensagem,
      tipo,
    });
  }

  function fecharAviso() {
    setModalAviso({
      aberto: false,
      titulo: "",
      mensagem: "",
      tipo: "info",
    });
  }

  function abrirNovoCartao() {
    setCartaoEditando(null);
    setNome("");
    setFinalCartao("");
    setLimiteTotal("");
    setDiaFechamento("");
    setDiaVencimento("");
    setEtapaCadastro(1);
    setSituacaoCartao("novo");
    setModoInicioCartao("saldo");
    setSaldoUtilizadoInicial("");
    setVencimentoFaturaInicial(hojeISO);
    setModalVencimentoFaturaInicialAberto(false);
    setModalAberto(true);
  }

  function abrirEditarCartao(cartao) {
    setCartaoEditando(cartao);
    setNome(cartao.nome || "");
    setFinalCartao(cartao.final_cartao || "");
    setLimiteTotal(numeroParaMoedaInput(cartao.limite_total));
    setDiaFechamento(String(cartao.dia_fechamento || ""));
    setDiaVencimento(String(cartao.dia_vencimento || ""));
    setEtapaCadastro(1);
    setSituacaoCartao(cartao.cartao_em_uso ? "em_uso" : "novo");
    setModoInicioCartao("saldo");
    setSaldoUtilizadoInicial(numeroParaMoedaInput(cartao.saldo_utilizado_inicial || 0));
    setVencimentoFaturaInicial(hojeISO);
    setModalVencimentoFaturaInicialAberto(false);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setCartaoEditando(null);
    setNome("");
    setFinalCartao("");
    setLimiteTotal("");
    setDiaFechamento("");
    setDiaVencimento("");
    setEtapaCadastro(1);
    setSituacaoCartao("novo");
    setModoInicioCartao("saldo");
    setSaldoUtilizadoInicial("");
    setVencimentoFaturaInicial(hojeISO);
    setModalVencimentoFaturaInicialAberto(false);
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
      setEtapaCadastro(cartaoEditando ? 4 : 2);
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
      if (modoInicioCartao === "parcelamentos") {
        abrirAviso(
          "Em breve",
          "A importação detalhada de parcelamentos será criada na próxima etapa. Por enquanto, use saldo utilizado atual.",
          "info"
        );
        return;
      }

      if (moedaParaNumero(saldoUtilizadoInicial) <= 0) {
        abrirAviso("Saldo utilizado", "Informe o saldo utilizado atual do cartão.", "erro");
        return;
      }

      if (!vencimentoFaturaInicial) {
        abrirAviso("Vencimento obrigatório", "Informe o vencimento da fatura atual.", "erro");
        return;
      }

      setEtapaCadastro(4);
    }
  }

  async function criarFaturaInicialCartao(cartaoId, valorInicial) {
    const competencia = calcularFaturaInicialPorVencimento(vencimentoFaturaInicial);

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

  async function salvarCartao() {
    if (!validarDadosBasicosCartao()) return;

    if (!cartaoEditando && situacaoCartao === "em_uso") {
      if (modoInicioCartao === "parcelamentos") {
        abrirAviso(
          "Em breve",
          "A importação detalhada de parcelamentos será criada na próxima etapa. Por enquanto, use saldo utilizado atual.",
          "info"
        );
        return;
      }

      if (moedaParaNumero(saldoUtilizadoInicial) <= 0) {
        abrirAviso("Saldo utilizado", "Informe o saldo utilizado atual do cartão.", "erro");
        return;
      }

      if (!vencimentoFaturaInicial) {
        abrirAviso("Vencimento obrigatório", "Informe o vencimento da fatura atual.", "erro");
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

    const valorSaldoInicial =
      !cartaoEditando && situacaoCartao === "em_uso"
        ? moedaParaNumero(saldoUtilizadoInicial)
        : 0;

    const payload = {
      nome: nomeNormalizado,
      final_cartao: finalCartao,
      limite_total: moedaParaNumero(limiteTotal),
      dia_fechamento: Number(diaFechamento),
      dia_vencimento: Number(diaVencimento),
      cartao_em_uso: !cartaoEditando ? situacaoCartao === "em_uso" : Boolean(cartaoEditando.cartao_em_uso),
      saldo_utilizado_inicial: !cartaoEditando
        ? valorSaldoInicial
        : Number(cartaoEditando.saldo_utilizado_inicial || 0),
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

      fecharModal();
      carregarCartoes();
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
          await criarFaturaInicialCartao(cartaoReativado.id, valorSaldoInicial);
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
      carregarCartoes();

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
        await criarFaturaInicialCartao(novoCartao.id, valorSaldoInicial);
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
    carregarCartoes();
  }

  function solicitarExclusaoCartao(cartao) {
    setCartaoParaExcluir(cartao);
    setModalExcluirAberto(true);
  }

  async function confirmarExclusaoCartao() {
    if (!cartaoParaExcluir) return;

    const { error } = await supabase
      .from("cartoes")
      .update({ ativo: false })
      .eq("id", cartaoParaExcluir.id);

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao excluir cartão.", "erro");
      return;
    }

    setModalExcluirAberto(false);
    setCartaoParaExcluir(null);
    carregarCartoes();
  }

  function abrirFaturas(cartao) {
    setCartaoSelecionado(cartao);
  }

  function voltarParaCartoes() {
    setCartaoSelecionado(null);
  }

  if (cartaoSelecionado) {
    return (
      <TelaFaturasCartao
        cartao={cartaoSelecionado}
        contas={contas}
        voltar={voltarParaCartoes}
        formatarMoeda={formatarMoeda}
        formatarMoedaDigitada={formatarMoedaDigitada}
        moedaParaNumero={moedaParaNumero}
        numeroParaMoedaInput={numeroParaMoedaInput}
        corDisponivel={corDisponivel}
        corBarra={corBarra}
        abrirAviso={abrirAviso}
        recarregarCartoes={carregarCartoes}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cartões</h1>

          <p className="text-gray-400 mt-2">
            Gerencie seus cartões, limites e faturas
          </p>
        </div>

        <button
          type="button"
          onClick={abrirNovoCartao}
          className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl px-4 sm:px-5 py-3 flex items-center justify-center gap-2"
        >
          <FiPlus />
          <span>Novo Cartão</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {cartoes.map((cartao) => (
          <div
            key={cartao.id}
            onClick={() => {
              if (Number(cartao.usado || 0) <= 0) {
                abrirAviso("Sem faturas em aberto", "Esse cartão ainda não possui faturas em aberto.", "info");
                return;
              }

              abrirFaturas(cartao);
            }}
            className={`relative rounded-2xl border border-gray-800 bg-[#111827] p-6 overflow-hidden transition ${
              Number(cartao.usado || 0) > 0
                ? "cursor-pointer hover:border-green-400/60"
                : "cursor-not-allowed opacity-80"
            }`}
          >
            

            <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  abrirEditarCartao(cartao);
                }}
                className="w-9 h-9 rounded-xl border border-gray-700 bg-[#0B1120] text-gray-400 hover:text-white hover:border-green-400 flex items-center justify-center"
                title="Editar cartão"
                aria-label="Editar cartão"
              >
                <FiEdit2 />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  solicitarExclusaoCartao(cartao);
                }}
                className="w-9 h-9 rounded-xl border border-gray-700 bg-[#0B1120] text-gray-400 hover:text-red-400 hover:border-red-500/60 flex items-center justify-center"
                title="Excluir cartão"
                aria-label="Excluir cartão"
              >
                <FiTrash2 />
              </button>
            </div>

            <div className="flex items-start gap-3 pr-20">
              <div className="w-11 h-11 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
                <FiCreditCard className="w-5 h-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-black truncate">{cartao.nome}</h2>
                <p className="text-gray-400 text-sm mt-1">Final {cartao.final_cartao}</p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-400">Usado</p>

                  <p className="text-xl font-bold mt-1">
                    {formatarMoeda(cartao.usado)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-400">Disponível</p>

                  <p className={`text-xl font-bold mt-1 ${corDisponivel(cartao.disponivel)}`}>
                    {formatarMoeda(cartao.disponivel)}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-3 bg-[#0B1120] border border-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${corBarra(cartao.percentual)} rounded-full transition-all`}
                  style={{ width: `${cartao.percentualBarra}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>{Math.round(cartao.percentual)}% usado</span>
                <span>Limite {formatarMoeda(cartao.limite_total)}</span>
              </div>

              {cartao.limiteEstourado && (
  <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
    <p className="text-red-400 font-bold text-sm flex items-center gap-2">
      <FiAlertTriangle />
      <span>Limite excedido</span>
    </p>

    <p className="text-xs text-gray-300 mt-1">
      Excedido em{" "}
      {formatarMoeda(
        Number(cartao.usado || 0) -
        Number(cartao.limite_total || 0)
      )}
    </p>
  </div>
)}
            </div>

            <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
              <span>Fecha dia {cartao.dia_fechamento}</span>
              <span>Vence dia {cartao.dia_vencimento}</span>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Clique para visualizar as faturas
            </p>
          </div>
        ))}
      </div>

      {cartoes.length === 0 && (
        <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400">Nenhum cartão cadastrado ainda.</p>
        </div>
      )}

      <CartaoCadastroModal
        aberto={modalAberto}
        cartaoEditando={cartaoEditando}
        onClose={fecharModal}
        abrirAviso={abrirAviso}
        recarregarCartoes={carregarCartoes}
        formatarMoeda={formatarMoeda}
        formatarMoedaDigitada={formatarMoedaDigitada}
        moedaParaNumero={moedaParaNumero}
        numeroParaMoedaInput={numeroParaMoedaInput}
      />

      {modalExcluirAberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-red-400">
              Excluir Cartão
            </h2>

            <p className="text-gray-300 mt-4">
              Deseja realmente excluir o cartão{" "}
              <span className="font-bold text-white">
                {cartaoParaExcluir?.nome}
              </span>
              ?
            </p>

            <p className="text-gray-500 text-sm mt-2">
              Ele deixará de aparecer para novos lançamentos.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setModalExcluirAberto(false);
                  setCartaoParaExcluir(null);
                }}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarExclusaoCartao}
                className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl p-3"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAviso.aberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80]">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2
              className={`text-2xl font-bold ${
                modalAviso.tipo === "erro" ? "text-red-400" : "text-green-400"
              }`}
            >
              {modalAviso.titulo}
            </h2>

            <p className="text-gray-300 mt-4">{modalAviso.mensagem}</p>

            <button
              type="button"
              onClick={fecharAviso}
              className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TelaFaturasCartao({
  cartao,
  contas,
  voltar,
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
  corDisponivel,
  corBarra,
  abrirAviso,
  recarregarCartoes,
}) {
  const [faturas, setFaturas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [faturaSelecionada, setFaturaSelecionada] = useState(null);
  const [mostrarPagas, setMostrarPagas] = useState(false);

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
    carregarFaturas();
  }, [cartao.id]);

  async function carregarFaturas() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("faturas_cartao")
      .select("*")
      .eq("cartao_id", cartao.id)
      .order("data_vencimento", { ascending: true });

    if (error) {
      console.error(error);
      setCarregando(false);
      return;
    }

    setFaturas(data || []);

    if (faturaSelecionada) {
      const atualizada = (data || []).find(
        (fatura) => String(fatura.id) === String(faturaSelecionada.id)
      );

      if (atualizada) setFaturaSelecionada(atualizada);
    }

    setCarregando(false);
  }

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "-";
    const [ano, mes, dia] = String(dataISOTexto).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function tituloFatura(fatura) {
    return `${meses[Number(fatura.mes || 1) - 1]} ${fatura.ano}`;
  }

  function saldoFatura(fatura) {
    return Math.max(
      Number(fatura.valor_total || 0) - Number(fatura.valor_pago || 0),
      0
    );
  }

  
  function obterStatusFatura(fatura) {
    const status = String(fatura.status || "").toLowerCase();

    if (status === "paga") {
      return { texto: "Paga", classe: "bg-green-500/10 text-green-400" };
    }

    if (status === "parcial") {
      return { texto: "Parcial", classe: "bg-yellow-500/10 text-yellow-400" };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencimento = new Date(fatura.data_vencimento);
    vencimento.setHours(0, 0, 0, 0);

    if (vencimento < hoje) {
      return { texto: "Em atraso", classe: "bg-red-500/10 text-red-400" };
    }

    return { texto: "Aberta", classe: "bg-blue-500/10 text-blue-400" };
  }

  function resumoValorFatura(fatura) {
    const status = String(fatura.status || "aberta").toLowerCase();

    if (status === "paga") {
      return {
        label: "Valor pago",
        valor: Number(fatura.valor_pago || fatura.valor_total || 0),
        className: "text-green-400",
      };
    }

    if (status === "parcial") {
      return {
        label: "Em aberto",
        valor: saldoFatura(fatura),
        className: "text-red-400",
      };
    }

    return {
      label: "Valor total",
      valor: Number(fatura.valor_total || 0),
      className: "text-white",
    };
  }

  const faturasExibidas = mostrarPagas
    ? faturas
    : faturas.filter((fatura) => String(fatura.status).toLowerCase() !== "paga");

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={voltar}
          className="w-10 h-10 rounded-xl border border-gray-700 hover:bg-white/5 flex items-center justify-center"
        >
          ←
        </button>

        <div>
          <h1 className="text-3xl font-bold">{cartao.nome}</h1>

          <p className="text-gray-400 mt-1">Cartão final {cartao.final_cartao}</p>
        </div>
      </div>

      <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-gray-400">Limite Total</p>

            <h2 className="text-4xl font-bold mt-2">
              {formatarMoeda(cartao.limite_total)}
            </h2>
          </div>

          <div className="text-right">
            <p className="text-gray-400">Disponível</p>

            <h2 className={`text-4xl font-bold mt-2 ${corDisponivel(cartao.disponivel)}`}>
              {formatarMoeda(cartao.disponivel)}
            </h2>
          </div>
        </div>

        <div className="mt-6 h-3 bg-[#0B1120] border border-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${corBarra(cartao.percentual)} rounded-full`}
            style={{ width: `${cartao.percentualBarra}%` }}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Faturas</h2>

        <button
          type="button"
          onClick={() => setMostrarPagas((valor) => !valor)}
          className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
            mostrarPagas
              ? "border-green-400 bg-green-500/10 text-green-400"
              : "border-gray-700 text-gray-400 hover:bg-white/5"
          }`}
        >
          {mostrarPagas ? "Ocultar pagas" : "Mostrar pagas"}
        </button>
      </div>

      {carregando && (
        <div className="mt-4 bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400">Carregando faturas...</p>
        </div>
      )}

      {!carregando && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {faturasExibidas.map((fatura) => {
            const saldo = saldoFatura(fatura);
            const paga = String(fatura.status).toLowerCase() === "paga";
            const resumo = resumoValorFatura(fatura);
            const statusVisual = obterStatusFatura(fatura);

            return (
              <button
                type="button"
                key={fatura.id}

                onClick={() => setFaturaSelecionada(fatura)}
                className="text-left bg-[#111827] border border-gray-800 hover:border-green-400/60 rounded-2xl p-6 transition disabled:hover:border-gray-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">
                    {tituloFatura(fatura)}
                  </h3>

                  <span
                    className={`text-xs rounded-full px-3 py-1 font-bold ${statusVisual.classe}`}
                  >
                    {statusVisual.texto}
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-xs text-gray-500">{resumo.label}</p>

                  <p className={`text-3xl font-black mt-1 ${resumo.className}`}>
                    {formatarMoeda(resumo.valor)}
                  </p>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Vencimento</p>
                    <p className="text-lg font-bold text-white mt-1">
                      {formatarDataBR(fatura.data_vencimento)}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500">
                    Clique para detalhes
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {faturas.length === 0 && !carregando && (
        <div className="mt-6 bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold">Nenhuma fatura ainda</h3>

          <p className="text-gray-400 mt-2">
            Quando uma saída for lançada no crédito, a fatura será criada automaticamente aqui.
          </p>
        </div>
      )}

      {faturaSelecionada && (
        <DetalheFaturaModal
          fatura={faturaSelecionada}
          cartao={cartao}
          contas={contas}
          fechar={() => setFaturaSelecionada(null)}
          tituloFatura={tituloFatura}
          saldoFatura={saldoFatura}
          formatarMoeda={formatarMoeda}
          formatarMoedaDigitada={formatarMoedaDigitada}
          moedaParaNumero={moedaParaNumero}
          numeroParaMoedaInput={numeroParaMoedaInput}
          formatarDataBR={formatarDataBR}
          abrirAviso={abrirAviso}
          recarregar={async () => {
            await carregarFaturas();
            await recarregarCartoes();
          }}
        />
      )}
    </div>
  );
}

