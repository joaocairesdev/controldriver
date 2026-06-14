import { useEffect, useMemo, useState } from "react";
import { FiArrowDown, FiArrowRight, FiArrowUp, FiFilter, FiSearch } from "react-icons/fi";
import { supabase } from "../services/supabase";
import SelecionarCategoriaModal from "../components/modals/SelecionarCategoriaModal";
import SelecionarFormaPagamentoModal from "../components/modals/SelecionarFormaPagamentoModal";
import DetalhesLancamentoModal from "../components/modals/DetalhesLancamentoModal";
import ConfirmacaoModal from "../components/modals/ConfirmacaoModal";
import FeedbackModal from "../components/modals/FeedbackModal";
import EntradaAvulsaModal from "../components/modals/EntradaAvulsaModal";
import TransferenciaModal from "../components/modals/TransferenciaModal";
import GanhosPlataformaModal from "../components/modals/GanhosPlataformaModal";
import SaidaModal from "../components/modals/SaidaModal";
import AbastecimentoOuRecargaModal from "../components/modals/AbastecimentoOuRecargaModal";
import ManutencaoModal from "../components/modals/ManutencaoModal";
import TagModal from "../components/modals/TagModal";

const ITENS_POR_PAGINA = 30;

export default function Extrato() {
  const [todosLancamentos, setTodosLancamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);

  const [modalPersonalizadoAberto, setModalPersonalizadoAberto] =
    useState(false);

  const [filtrosPersonalizados, setFiltrosPersonalizados] = useState({
    dataInicio: "",
    dataFim: "",
    categoria: "todas",
    formaPagamento: "todas",
  });

  const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const [edicaoLancamento, setEdicaoLancamento] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [confirmarExclusaoLote, setConfirmarExclusaoLote] = useState(false);

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
  });

  useEffect(() => {
    carregarExtrato();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
    setSelecionados([]);
  }, [filtroTipo, busca, filtrosPersonalizados]);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data) {
    if (!data) return "-";
    const [ano, mes, dia] = String(data).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function formatarHoraSemSegundos(valor) {
    if (!valor) return "-";
    const partes = String(valor).split(":");
    return `${partes[0] || "00"}:${partes[1] || "00"}`;
  }

  function textoFormaPagamento(saida) {
  const parcelas = Number(saida.numero_parcelas || 1);

  if (
    saida.forma_pagamento === "credito_parcelado" ||
    (saida.forma_pagamento === "credito" && parcelas > 1)
  ) {
    return `Crédito Parcelado em ${parcelas}x`;
  }

  if (
    saida.forma_pagamento === "credito_avista" ||
    saida.forma_pagamento === "credito"
  ) {
    return "Crédito à Vista";
  }

  const nomes = {
    pix: "Pix",
    debito: "Débito",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    boleto_parcelado: "Boleto Parcelado",
    tag: "TAG",
  };

  return nomes[saida.forma_pagamento] || saida.forma_pagamento || "-";
}

  async function carregarExtrato() {
    setCarregando(true);

    const { data: contasData } = await supabase
      .from("contas")
      .select("id, nome");

    const nomeContaPorId = Object.fromEntries(
      (contasData || []).map((conta) => [String(conta.id), conta.nome])
    );

    const { data: entradasData } = await supabase.from("entradas").select(`
      id,
      data,
      created_at,
      km_rodados,
      horas_trabalhadas,
      conta_id,
      contas ( nome ),
      entrada_plataformas (
        id,
        plataforma_id,
        faturamento,
        valor_reembolso,
        numero_corridas,
        houve_pedagio,
        plataformas ( nome )
      )
    `);

    const { data: entradasAvulsasData } = await supabase
      .from("entradas_avulsas")
      .select(`
        id,
        data,
        created_at,
        conta_id,
        valor,
        descricao,
        contas ( nome )
      `);

    const { data: transferenciasData } = await supabase
      .from("transferencias")
      .select(`
        id,
        data,
        created_at,
        conta_origem_id,
        conta_destino_id,
        valor,
        descricao,
        tipo
      `);

    const { data: saidasData } = await supabase.from("saidas").select(`
      id,
      data_compra,
      created_at,
      categoria,
      descricao,
      valor_total,
      forma_pagamento,
      status,
      tipo_movimentacao,
      data_vencimento,
      numero_parcelas,
      valor_parcela,
      conta_id,
      cartao_id,
      tipo_credito,
      data_efetivacao,
      finalidade,
      contas ( nome ),
      cartoes ( nome, final_cartao )
    `);

    const idsSaidas = (saidasData || []).map((s) => s.id);

    const { data: abastecimentosData, error: erroAbastecimentos } =
      idsSaidas.length > 0
        ? await supabase
            .from("saidas_abastecimentos")
            .select("*")
            .in("saida_id", idsSaidas)
        : { data: [], error: null };

    if (erroAbastecimentos) {
      console.error("Erro ao buscar abastecimentos do extrato:", erroAbastecimentos);
    }

    const { data: manutencoesData } =
      idsSaidas.length > 0
        ? await supabase
            .from("saidas_manutencoes")
            .select("*")
            .in("saida_id", idsSaidas)
        : { data: [] };

    const { data: recargasEletricasData } =
      idsSaidas.length > 0
        ? await supabase
            .from("saidas_recargas_eletricas")
            .select("*")
            .in("saida_id", idsSaidas)
        : { data: [] };

    const { data: tagsData } =
      idsSaidas.length > 0
        ? await supabase
            .from("saidas_tag")
            .select("*")
            .in("saida_id", idsSaidas)
        : { data: [] };

    const entradasFormatadas = (entradasData || []).map((entrada) => {
      const total = (entrada.entrada_plataformas || []).reduce(
        (soma, item) =>
          soma +
          Number(item.faturamento || 0) +
          Number(item.valor_reembolso || 0),
        0
      );

      const plataformas = (entrada.entrada_plataformas || [])
        .map((item) => item.plataformas?.nome)
        .filter(Boolean)
        .join(", ");

      return {
        id: `entrada-${entrada.id}`,
        idOriginal: entrada.id,
        tipo: "entrada",
        data: entrada.data,
        created_at: entrada.created_at,
        titulo: "Ganhos com Plataformas",
        descricao: plataformas || "Plataformas",
        valor: total,
        contaDestino: entrada.contas?.nome || "Conta",
        categoria: "Entrada",
        formaPagamento: "entrada",
        textoBusca: `Ganhos com Plataformas ${plataformas} ${entrada.contas?.nome || ""}`,
        dadosOriginais: entrada,
      };
    });

    const entradasAvulsasFormatadas = (entradasAvulsasData || []).map(
      (entrada) => ({
        id: `entrada-avulsa-${entrada.id}`,
        idOriginal: entrada.id,
        tipo: "entrada_avulsa",
        data: entrada.data,
        created_at: entrada.created_at,
        titulo: "Entrada Avulsa",
        descricao: entrada.descricao || "Entrada avulsa",
        valor: Number(entrada.valor || 0),
        contaDestino: entrada.contas?.nome || "Conta",
        categoria: "Entrada Avulsa",
        formaPagamento: "entrada_avulsa",
        textoBusca: `Entrada Avulsa ${entrada.descricao || ""} ${entrada.contas?.nome || ""}`,
        dadosOriginais: entrada,
      })
    );

    const transferenciasFormatadas = (transferenciasData || []).map(
      (transferencia) => {
        const contaOrigem =
          nomeContaPorId[String(transferencia.conta_origem_id)] || "Origem";
        const contaDestino =
          nomeContaPorId[String(transferencia.conta_destino_id)] || "Destino";

        return {
          id: `transferencia-${transferencia.id}`,
          idOriginal: transferencia.id,
          tipo: "transferencia",
          data: transferencia.data,
          created_at: transferencia.created_at,
          titulo: "Transferência",
          descricao:
            transferencia.descricao ||
            `${contaOrigem} → ${contaDestino}`,
          valor: Number(transferencia.valor || 0),
          contaOrigem,
          contaDestino,
          categoria: "Transferência",
          formaPagamento: "transferencia",
          textoBusca: `Transferência ${transferencia.descricao || ""} ${contaOrigem} ${contaDestino}`,
          dadosOriginais: {
            ...transferencia,
            contaOrigem,
            contaDestino,
          },
        };
      }
    );

    const saidasFormatadas = (saidasData || []).map((saida) => {
      const formaTexto = textoFormaPagamento(saida);

      const contaCartao =
        saida.tipo_movimentacao === "conta_pagar"
          ? "Conta registrada"
          : ["credito", "credito_avista", "credito_parcelado"].includes(
              saida.forma_pagamento
            )
          ? `${saida.cartoes?.nome || "Cartão"} final ${
              saida.cartoes?.final_cartao || ""
            }`
          : saida.contas?.nome || "Conta";

      return {
        id: `saida-${saida.id}`,
        idOriginal: saida.id,
        tipo:
          saida.tipo_movimentacao === "conta_pagar"
            ? "conta_pagar"
            : "saida",
        data: saida.data_compra,
        created_at: saida.created_at,
        titulo: saida.categoria,
        descricao: saida.descricao || saida.categoria,
        valor: Number(saida.valor_total || 0),
        formaPagamentoTexto: formaTexto,
        formaPagamento: saida.forma_pagamento,
        contaOrigem: contaCartao,
        categoria: saida.categoria,
        textoBusca: `${saida.categoria} ${saida.descricao || ""} ${formaTexto} ${contaCartao}`,
        dadosOriginais: {
          ...saida,
          formaPagamentoTexto: formaTexto,
          contaOrigem: contaCartao,
          abastecimento: (abastecimentosData || []).find(
            (item) => item.saida_id === saida.id
          ),
          manutencao: (manutencoesData || []).find(
            (item) => item.saida_id === saida.id
          ),
          recargaEletrica: (recargasEletricasData || []).find(
            (item) => item.saida_id === saida.id
          ),
          tag: (tagsData || []).find(
            (item) => item.saida_id === saida.id
          ),
        },
      };
    });

    const tudo = [
      ...entradasFormatadas,
      ...entradasAvulsasFormatadas,
      ...transferenciasFormatadas,
      ...saidasFormatadas,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setTodosLancamentos(tudo);
    setCarregando(false);
  }

  const categoriasDisponiveis = useMemo(() => {
    const categorias = todosLancamentos
      .filter((item) => ["saida", "conta_pagar"].includes(item.tipo))
      .map((item) => item.categoria)
      .filter(Boolean);

    return [...new Set(categorias)].sort();
  }, [todosLancamentos]);

  const formasPagamentoDisponiveis = useMemo(() => {
    const nomes = {
      pix: "Pix",
      debito: "Débito",
      dinheiro: "Dinheiro",
      boleto: "Boleto",
      boleto_parcelado: "Boleto Parcelado",
      tag: "TAG",
      credito: "Cartão de crédito",
      credito_avista: "Crédito à Vista",
      credito_parcelado: "Crédito Parcelado",
      entrada: "Entrada",
      entrada_avulsa: "Entrada Avulsa",
      transferencia: "Transferência",
    };

    const formas = todosLancamentos
      .map((item) => item.formaPagamento)
      .filter(Boolean);

    return [...new Set(formas)].sort().map((valor) => ({
      valor,
      titulo: nomes[valor] || valor,
    }));
  }, [todosLancamentos]);

  const lancamentosFiltrados = useMemo(() => {
    let lista = [...todosLancamentos];

    if (filtroTipo === "entrada") {
      lista = lista.filter((item) => ["entrada", "entrada_avulsa"].includes(item.tipo));
    }

    if (filtroTipo === "saida") {
      lista = lista.filter((item) => ["saida", "conta_pagar"].includes(item.tipo));
    }

    if (filtroTipo === "transferencia") {
      lista = lista.filter((item) => item.tipo === "transferencia");
    }

    if (filtroTipo === "personalizado") {
      const { dataInicio, dataFim, categoria, formaPagamento } =
        filtrosPersonalizados;

      if (dataInicio) {
        lista = lista.filter((item) => item.data >= dataInicio);
      }

      if (dataFim) {
        lista = lista.filter((item) => item.data <= dataFim);
      }

      if (categoria !== "todas") {
        lista = lista.filter((item) => item.categoria === categoria);
      }

      if (formaPagamento !== "todas") {
        lista = lista.filter((item) => item.formaPagamento === formaPagamento);
      }
    }

    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();

      lista = lista.filter((item) =>
        String(item.textoBusca || "").toLowerCase().includes(termo)
      );
    }

    return lista;
  }, [todosLancamentos, filtroTipo, filtrosPersonalizados, busca]);

  const totalPaginas = Math.max(
    Math.ceil(lancamentosFiltrados.length / ITENS_POR_PAGINA),
    1
  );

  const lancamentosPagina = lancamentosFiltrados.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  const lancamentosVisiveis = modoSelecao
    ? lancamentosPagina
    : agruparEntradasDePlataformaPorDia(lancamentosPagina);

  function selecionarFiltro(valor) {
    if (valor === "personalizado") {
      setFiltroTipo("personalizado");
      setModalPersonalizadoAberto(true);
      return;
    }

    setFiltroTipo(valor);
  }

  function limparFiltros() {
    setFiltroTipo("todos");
    setBusca("");
    setFiltrosPersonalizados({
      dataInicio: "",
      dataFim: "",
      categoria: "todas",
      formaPagamento: "todas",
    });
    setModalPersonalizadoAberto(false);
  }

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  function alternarModoSelecao() {
    setModoSelecao((ativo) => {
      const novoEstado = !ativo;
      if (ativo) setSelecionados([]);
      setLancamentoSelecionado(null);
      return novoEstado;
    });
  }

  function alternarSelecionado(id) {
    setSelecionados((lista) =>
      lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]
    );
  }

  function selecionarTodosDaPagina() {
    const idsPagina = lancamentosPagina.map((item) => item.id);
    const todosSelecionados = idsPagina.every((id) => selecionados.includes(id));

    if (todosSelecionados) {
      setSelecionados((lista) => lista.filter((id) => !idsPagina.includes(id)));
      return;
    }

    setSelecionados((lista) => [...new Set([...lista, ...idsPagina])]);
  }

  function limparSelecao() {
    setSelecionados([]);
    setModoSelecao(false);
  }

  async function recalcularOdometroVeiculo(veiculoId) {
  if (!veiculoId) return;

  const { data: ultimoAbastecimento } = await supabase
    .from("saidas_abastecimentos")
    .select("odometro")
    .eq("veiculo_id", veiculoId)
    .order("odometro", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimoAbastecimento?.odometro) {
    await supabase
      .from("veiculos")
      .update({
        odometro_atual: Number(ultimoAbastecimento.odometro || 0),
      })
      .eq("id", veiculoId);

    return;
  }

  const { data: veiculo } = await supabase
    .from("veiculos")
    .select("odometro_inicial")
    .eq("id", veiculoId)
    .maybeSingle();

  await supabase
    .from("veiculos")
    .update({
      odometro_atual: Number(veiculo?.odometro_inicial || 0),
    })
    .eq("id", veiculoId);
}

  function editarLancamento(lancamento) {
    setLancamentoSelecionado(null);
    setEdicaoLancamento(lancamento);
  }

  async function excluirLancamentoItem(lancamentoAlvo) {
    if (!lancamentoAlvo) return;

    if (lancamentoAlvo.tipo === "entrada") {
      const { error: erroDetalhes } = await supabase
        .from("entrada_plataformas")
        .delete()
        .eq("entrada_id", lancamentoAlvo.idOriginal);

      if (erroDetalhes) throw erroDetalhes;

      const { error: erroEntrada } = await supabase
        .from("entradas")
        .delete()
        .eq("id", lancamentoAlvo.idOriginal);

      if (erroEntrada) throw erroEntrada;
    }

    if (lancamentoAlvo.tipo === "entrada_avulsa") {
      const { error: erroEntradaAvulsa } = await supabase
        .from("entradas_avulsas")
        .delete()
        .eq("id", lancamentoAlvo.idOriginal);

      if (erroEntradaAvulsa) throw erroEntradaAvulsa;
    }

    if (lancamentoAlvo.tipo === "transferencia") {
      const { error: erroTransferencia } = await supabase
        .from("transferencias")
        .delete()
        .eq("id", lancamentoAlvo.idOriginal);

      if (erroTransferencia) throw erroTransferencia;
    }

    if (["saida", "conta_pagar"].includes(lancamentoAlvo.tipo)) {
      const { data: saidaPagamento } = await supabase
        .from("saidas")
        .select("id, categoria, valor_total, fatura_pagamento_id")
        .eq("id", lancamentoAlvo.idOriginal)
        .maybeSingle();

      if (
        saidaPagamento?.categoria === "Pagamento de Fatura" &&
        saidaPagamento?.fatura_pagamento_id
      ) {
        const { data: fatura } = await supabase
          .from("faturas_cartao")
          .select("valor_total, valor_pago")
          .eq("id", saidaPagamento.fatura_pagamento_id)
          .maybeSingle();

        const novoValorPago = Math.max(
          Number(fatura?.valor_pago || 0) - Number(saidaPagamento.valor_total || 0),
          0
        );

        const novoSaldo = Number(fatura?.valor_total || 0) - novoValorPago;

        const novoStatus =
          novoValorPago <= 0 ? "aberta" : novoSaldo > 0 ? "parcial" : "paga";

        await supabase
          .from("faturas_cartao")
          .update({ valor_pago: novoValorPago, status: novoStatus })
          .eq("id", saidaPagamento.fatura_pagamento_id);

        if (novoStatus !== "paga") {
          await supabase
            .from("saidas_parcelas")
            .update({ status: "pendente" })
            .eq("fatura_id", saidaPagamento.fatura_pagamento_id);
        }
      }

      const { data: abastecimentoExcluido, error: erroBuscaAbastecimento } =
        await supabase
          .from("saidas_abastecimentos")
          .select("veiculo_id")
          .eq("saida_id", lancamentoAlvo.idOriginal)
          .maybeSingle();

      if (erroBuscaAbastecimento) throw erroBuscaAbastecimento;

      const veiculoId = abastecimentoExcluido?.veiculo_id || null;

      const tabelasDetalhes = [
        "saidas_abastecimentos",
        "saidas_manutencoes",
        "saidas_recargas_eletricas",
        "saidas_tag",
      ];

      const { error: erroParcelas } = await supabase
        .from("saidas_parcelas")
        .delete()
        .eq("saida_id", lancamentoAlvo.idOriginal);

      if (erroParcelas) throw erroParcelas;

      for (const tabela of tabelasDetalhes) {
        const { error } = await supabase
          .from(tabela)
          .delete()
          .eq("saida_id", lancamentoAlvo.idOriginal);

        if (error) throw error;
      }

      const { error: erroSaida } = await supabase
        .from("saidas")
        .delete()
        .eq("id", lancamentoAlvo.idOriginal);

      if (erroSaida) throw erroSaida;

      if (veiculoId) {
        await recalcularOdometroVeiculo(veiculoId);
      }
    }
  }

  async function excluirLancamento() {
    if (!confirmarExclusao) return;

    setExcluindo(true);

    try {
      await excluirLancamentoItem(confirmarExclusao);

      setConfirmarExclusao(null);
      setLancamentoSelecionado(null);
      await carregarExtrato();

      abrirFeedback("sucesso", "Lançamento excluído", "O lançamento foi excluído com sucesso.");
    } catch (erro) {
      console.error("Erro ao excluir lançamento:", erro);
      abrirFeedback("erro", "Erro ao excluir", erro.message || "Erro desconhecido.");
    } finally {
      setExcluindo(false);
    }
  }

  async function excluirSelecionados() {
    if (selecionados.length === 0) return;

    const itens = todosLancamentos.filter((item) => selecionados.includes(item.id));

    setExcluindo(true);

    try {
      for (const item of itens) {
        await excluirLancamentoItem(item);
      }

      setConfirmarExclusaoLote(false);
      limparSelecao();
      await carregarExtrato();

      abrirFeedback(
        "sucesso",
        "Lançamentos excluídos",
        `${itens.length} lançamento(s) foram excluídos com sucesso.`
      );
    } catch (erro) {
      console.error("Erro ao excluir lançamentos:", erro);
      abrirFeedback("erro", "Erro ao excluir", erro.message || "Erro desconhecido.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Extrato</h1>

      <p className="text-gray-400 mt-2">
        Acompanhe todos os lançamentos de entrada e saída.
      </p>

      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            { nome: "Todos", valor: "todos" },
            { nome: "Entradas", valor: "entrada" },
            { nome: "Saídas", valor: "saida" },
          ].map((item) => {
            const ativo = filtroTipo === item.valor;

            return (
              <button
                key={item.valor}
                type="button"
                onClick={() => selecionarFiltro(item.valor)}
                className={`h-11 px-2 rounded-xl border text-sm font-black transition ${
                  ativo
                    ? "bg-green-500 text-black border-green-500"
                    : "border-gray-700 text-gray-300 hover:bg-white/5"
                }`}
              >
                {item.nome}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => selecionarFiltro("personalizado")}
            className={`h-11 rounded-xl border flex items-center justify-center transition ${
              filtroTipo === "personalizado"
                ? "bg-green-500 text-black border-green-500"
                : "border-gray-700 text-gray-300 hover:bg-white/5"
            }`}
            title="Filtros personalizados"
            aria-label="Filtros personalizados"
          >
            <FiFilter className="text-lg" />
          </button>
        </div>

        <div className="relative w-full">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
            <FiSearch />
          </span>

          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no extrato..."
            className="w-full bg-[#111827] border border-gray-700 focus:border-green-400 outline-none rounded-xl py-3 pl-11 pr-4"
          />
        </div>

        {(filtroTipo !== "todos" || busca) && (
          <button
            type="button"
            onClick={limparFiltros}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 font-semibold text-sm"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          Mostrando {lancamentosPagina.length} de {lancamentosFiltrados.length}{" "}
          lançamento(s)
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {modoSelecao && (
            <>
              <button
                type="button"
                onClick={selecionarTodosDaPagina}
                className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300 hover:bg-white/5 font-semibold"
              >
                Selecionar página
              </button>

              <span className="text-sm text-gray-400">
                {selecionados.length} selecionado(s)
              </span>

              <button
                type="button"
                disabled={selecionados.length === 0 || excluindo}
                onClick={() => setConfirmarExclusaoLote(true)}
                className="px-4 py-2 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 font-semibold disabled:opacity-40"
              >
                Excluir selecionados
              </button>
            </>
          )}

          <button
            type="button"
            onClick={alternarModoSelecao}
            className={`px-4 py-2 rounded-xl border font-semibold transition ${
              modoSelecao
                ? "border-gray-700 text-gray-300 hover:bg-white/5"
                : "border-green-500/60 text-green-400 hover:bg-green-500/10"
            }`}
          >
            {modoSelecao ? "Cancelar seleção" : "Selecionar lançamentos"}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {carregando && (
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400">Carregando extrato...</p>
          </div>
        )}

        {!carregando && lancamentosFiltrados.length === 0 && (
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-gray-400">Nenhum lançamento encontrado.</p>
          </div>
        )}

        {lancamentosVisiveis.map((item) => {
          const selecionado = selecionados.includes(item.id);

          const entrada = ["entrada", "entrada_avulsa", "entrada_agrupada"].includes(item.tipo);
          const neutro = item.tipo === "conta_pagar" || item.tipo === "transferencia";
          const sinal = entrada ? "+" : neutro ? "" : "-";
          const corValor = entrada ? "text-green-400" : neutro ? "text-blue-400" : "text-red-400";
          const corIcone = entrada
            ? "bg-green-500/15 text-green-400"
            : neutro
            ? "bg-blue-500/15 text-blue-400"
            : "bg-red-500/15 text-red-400";
          const IconeLancamento = entrada ? FiArrowUp : neutro ? FiArrowRight : FiArrowDown;
          const colunasCard = modoSelecao
            ? "grid-cols-[auto_1fr_auto]"
            : "grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_auto]";

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (modoSelecao) {
                  alternarSelecionado(item.id);
                  return;
                }

                setLancamentoSelecionado(item);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();

                if (modoSelecao) {
                  alternarSelecionado(item.id);
                  return;
                }

                setLancamentoSelecionado(item);
              }}
              className={`w-full text-left bg-[#111827] border rounded-2xl p-4 sm:p-5 grid ${colunasCard} items-center gap-3 transition cursor-pointer ${
                selecionado
                  ? "border-green-400 bg-green-500/10"
                  : "border-gray-800 hover:border-green-400/60"
              }`}
            >
              {modoSelecao && (
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 text-xs ${
                    selecionado
                      ? "bg-green-500 border-green-500 text-black"
                      : "border-gray-600 text-transparent"
                  }`}
                >
                  ✓
                </div>
              )}

              {!modoSelecao && (
                <div className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center font-black shrink-0 ${corIcone}`}>
                  <IconeLancamento />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  {!modoSelecao && (
                    <span className={`sm:hidden w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 ${corIcone}`}>
                      <IconeLancamento />
                    </span>
                  )}
                  <p className="text-xs text-gray-500 truncate">{formatarData(item.data)}</p>
                </div>
                <h2 className="text-base sm:text-lg font-black truncate mt-0.5">{item.titulo}</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">{item.descricao}</p>
              </div>

              <div className="text-right min-w-[92px] sm:min-w-[130px]">
                <p className={`text-base sm:text-xl font-black whitespace-nowrap ${corValor}`}>
                  {sinal} {formatarMoeda(item.valor)}
                </p>

                {entrada && (
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 truncate">
                    Para {item.contaDestino}
                  </p>
                )}

                {item.tipo === "transferencia" && (
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 truncate">
                    {item.contaOrigem} → {item.contaDestino}
                  </p>
                )}

                {(item.tipo === "saida" || item.tipo === "conta_pagar") && (
                  <>
                    <p className="text-[11px] sm:text-xs text-gray-400 mt-1 truncate">
                      {item.tipo === "conta_pagar"
                        ? `Contas a pagar - ${item.formaPagamentoTexto}`
                        : item.formaPagamentoTexto}
                    </p>

                    {item.tipo !== "conta_pagar" && (
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">
                        {item.contaOrigem}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            type="button"
            disabled={paginaAtual === 1}
            onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))}
            className="px-4 py-2 rounded-xl border border-gray-700 disabled:opacity-40 hover:bg-white/5"
          >
            Anterior
          </button>

          <span className="text-sm text-gray-400">
            Página {paginaAtual} de {totalPaginas}
          </span>

          <button
            type="button"
            disabled={paginaAtual === totalPaginas}
            onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))}
            className="px-4 py-2 rounded-xl border border-gray-700 disabled:opacity-40 hover:bg-white/5"
          >
            Próxima
          </button>
        </div>
      )}

      {modalPersonalizadoAberto && (
        <ModalPersonalizado
          filtros={filtrosPersonalizados}
          setFiltros={setFiltrosPersonalizados}
          categorias={categoriasDisponiveis}
          formasPagamento={formasPagamentoDisponiveis}
          formatarData={formatarData}
          fechar={() => setModalPersonalizadoAberto(false)}
          limpar={limparFiltros}
        />
      )}

      <DetalhesLancamentoModal
  aberto={!!lancamentoSelecionado}
  lancamento={lancamentoSelecionado}
  fechar={() => setLancamentoSelecionado(null)}
  editar={() => editarLancamento(lancamentoSelecionado)}
  editarTurno={(turno) => editarLancamento(turno)}
  pedirExclusao={() => setConfirmarExclusao(lancamentoSelecionado)}
  formatarMoeda={formatarMoeda}
  formatarData={formatarData}
  formatarHoraSemSegundos={formatarHoraSemSegundos}
/>

      {edicaoLancamento?.tipo === "entrada_avulsa" && (
        <EntradaAvulsaModal
          aberto={true}
          edicao={edicaoLancamento.dadosOriginais}
          onClose={() => setEdicaoLancamento(null)}
          onSalvo={carregarExtrato}
        />
      )}

      {edicaoLancamento?.tipo === "transferencia" && (
        <TransferenciaModal
          aberto={true}
          edicao={edicaoLancamento.dadosOriginais}
          onClose={() => setEdicaoLancamento(null)}
          onSalvo={carregarExtrato}
        />
      )}

      {edicaoLancamento?.tipo === "entrada" && (
        <GanhosPlataformaModal
          aberto={true}
          edicao={edicaoLancamento.dadosOriginais}
          onClose={() => setEdicaoLancamento(null)}
          onSalvo={carregarExtrato}
        />
      )}

      {edicaoLancamento && ["saida", "conta_pagar"].includes(edicaoLancamento.tipo) &&
        !edicaoLancamento.dadosOriginais?.abastecimento &&
        !edicaoLancamento.dadosOriginais?.manutencao &&
        edicaoLancamento.formaPagamento !== "tag" && (
          <SaidaModal
            aberto={true}
            edicao={edicaoLancamento.dadosOriginais}
            onClose={() => setEdicaoLancamento(null)}
            onSalvo={carregarExtrato}
            titulo={edicaoLancamento.tipo === "conta_pagar" ? "Editar Despesa Futura" : "Editar Despesa"}
            descricaoModal="Altere os dados deste lançamento."
            modo={edicaoLancamento.tipo === "conta_pagar" ? "futura" : "saida"}
            categoriaInicial={edicaoLancamento.categoria || "Outros"}
          />
      )}

      {edicaoLancamento && (
        edicaoLancamento.dadosOriginais?.abastecimento ||
        edicaoLancamento.dadosOriginais?.recargaEletrica
      ) && (
        <AbastecimentoOuRecargaModal
          aberto={true}
          edicao={edicaoLancamento.dadosOriginais}
          onClose={() => setEdicaoLancamento(null)}
          onSalvo={carregarExtrato}
        />
      )}

      {edicaoLancamento?.dadosOriginais?.manutencao && (
        <ManutencaoModal
          aberto={true}
          edicao={edicaoLancamento.dadosOriginais}
          onClose={() => setEdicaoLancamento(null)}
          onSalvo={carregarExtrato}
        />
      )}

      {edicaoLancamento && (
        edicaoLancamento.formaPagamento === "tag" || edicaoLancamento.dadosOriginais?.tag
      ) && (
        <TagModal
          aberto={true}
          edicao={edicaoLancamento.dadosOriginais}
          onClose={() => setEdicaoLancamento(null)}
          onSalvo={carregarExtrato}
        />
      )}

      <ConfirmacaoModal
        aberto={!!confirmarExclusao}
        tipo="perigo"
        titulo="Excluir lançamento"
        mensagem="Tem certeza que deseja excluir este lançamento? Essa ação não poderá ser desfeita."
        textoCancelar="Cancelar"
        textoConfirmar={excluindo ? "Excluindo..." : "Excluir"}
        carregando={excluindo}
        onCancelar={() => setConfirmarExclusao(null)}
        onConfirmar={excluirLancamento}
      />

      <ConfirmacaoModal
        aberto={confirmarExclusaoLote}
        tipo="perigo"
        titulo="Excluir selecionados"
        mensagem={`Tem certeza que deseja excluir ${selecionados.length} lançamento(s)? Essa ação não poderá ser desfeita.`}
        textoCancelar="Cancelar"
        textoConfirmar={excluindo ? "Excluindo..." : "Excluir selecionados"}
        carregando={excluindo}
        onCancelar={() => setConfirmarExclusaoLote(false)}
        onConfirmar={excluirSelecionados}
      />

      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={fecharFeedback}
      />
    </div>
  );
}


function agruparEntradasDePlataformaPorDia(lista) {
  const grupos = new Map();
  const resultado = [];

  for (const item of lista) {
    if (item.tipo !== "entrada") {
      resultado.push(item);
      continue;
    }

    const chave = `entrada-${item.data}`;

    if (!grupos.has(chave)) {
      const grupo = {
        id: `entrada-grupo-${item.data}`,
        idOriginal: null,
        tipo: "entrada_agrupada",
        data: item.data,
        created_at: item.created_at,
        titulo: "Ganhos com Plataformas",
        descricao: "",
        valor: 0,
        contaDestino: "",
        categoria: "Entrada",
        formaPagamento: "entrada",
        textoBusca: "",
        dadosOriginais: { turnos: [] },
      };

      grupos.set(chave, grupo);
      resultado.push(grupo);
    }

    const grupo = grupos.get(chave);
    grupo.dadosOriginais.turnos.push(item);
    grupo.valor += Number(item.valor || 0);

    if (new Date(item.created_at) > new Date(grupo.created_at)) {
      grupo.created_at = item.created_at;
    }
  }

  for (const grupo of grupos.values()) {
    const turnos = grupo.dadosOriginais.turnos;

    if (turnos.length === 1) {
      const index = resultado.findIndex((item) => item.id === grupo.id);
      if (index >= 0) resultado[index] = turnos[0];
      continue;
    }

    const plataformas = [
      ...new Set(
        turnos.flatMap((turno) =>
          String(turno.descricao || "")
            .split(",")
            .map((texto) => texto.trim())
            .filter(Boolean),
        ),
      ),
    ];

    const contas = [
      ...new Set(turnos.map((turno) => turno.contaDestino).filter(Boolean)),
    ];

    grupo.descricao = `${turnos.length} turnos${plataformas.length ? ` • ${plataformas.join(", ")}` : ""}`;
    grupo.contaDestino = contas.length === 1 ? contas[0] : "Várias contas";
    grupo.textoBusca = `${grupo.titulo} ${grupo.descricao} ${grupo.contaDestino}`;
  }

  return resultado;
}

function ModalPersonalizado({
  filtros,
  setFiltros,
  categorias,
  formasPagamento,
  formatarData,
  fechar,
  limpar,
}) {
  const [modalPeriodoAberto, setModalPeriodoAberto] = useState(false);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [modalFormaPagamentoAberto, setModalFormaPagamentoAberto] = useState(false);

  const categoriaTexto =
    filtros.categoria === "todas" ? "Todas as categorias" : filtros.categoria;

  const formaPagamentoTexto =
    formasPagamento.find((item) => item.valor === filtros.formaPagamento)?.titulo ||
    "Todas as formas";

  const periodoTexto = textoPeriodoFiltro(filtros.dataInicio, filtros.dataFim, formatarData);
  const categoriasFiltro = ["Todas as categorias", ...categorias];
  const formasFiltro = [
    { valor: "todas", titulo: "Todas as formas" },
    ...formasPagamento,
  ];

  function atualizarFiltro(campo, valor) {
    setFiltros((filtrosAtuais) => ({ ...filtrosAtuais, [campo]: valor }));
  }

  function aplicarPeriodo({ dataInicio, dataFim }) {
    setFiltros((filtrosAtuais) => ({
      ...filtrosAtuais,
      dataInicio,
      dataFim,
    }));
  }

  function limparPeriodo() {
    setFiltros((filtrosAtuais) => ({
      ...filtrosAtuais,
      dataInicio: "",
      dataFim: "",
    }));
  }

  function limparEFechar() {
    limpar();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-black text-green-400">
                Filtros do extrato
              </div>

              <h2 className="text-2xl font-black mt-3">Filtro personalizado</h2>
              <p className="text-gray-400 mt-2 text-sm leading-relaxed">
                Escolha o período, categoria e forma de pagamento para refinar os lançamentos.
              </p>
            </div>

            <button
              type="button"
              onClick={fechar}
              className="w-10 h-10 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black shrink-0"
              aria-label="Fechar filtro personalizado"
            >
              ×
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <Campo label="Período">
              <ButtonField onClick={() => setModalPeriodoAberto(true)}>
                {periodoTexto}
              </ButtonField>
            </Campo>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Categoria">
              <ButtonField onClick={() => setModalCategoriaAberto(true)}>
                {categoriaTexto}
              </ButtonField>
            </Campo>

            <Campo label="Forma de pagamento">
              <ButtonField onClick={() => setModalFormaPagamentoAberto(true)}>
                {formaPagamentoTexto}
              </ButtonField>
            </Campo>
          </div>

          <div className="mt-6 rounded-2xl bg-[#0B1120] border border-gray-800 p-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              No período, primeiro escolha a data inicial. Depois escolha a data final.
              Datas anteriores ao início ficam bloqueadas automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <button
              type="button"
              onClick={limparEFechar}
              className="w-full border border-gray-700 hover:bg-white/5 text-white font-black rounded-2xl p-4"
            >
              Limpar filtros
            </button>

            <button
              type="button"
              onClick={fechar}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-black rounded-2xl p-4"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>

      <DateRangePickerModal
        aberto={modalPeriodoAberto}
        dataInicioAtual={filtros.dataInicio}
        dataFimAtual={filtros.dataFim}
        onAplicar={aplicarPeriodo}
        onLimpar={limparPeriodo}
        onClose={() => setModalPeriodoAberto(false)}
        formatarData={formatarData}
      />

      <SelecionarCategoriaModal
        aberto={modalCategoriaAberto}
        categorias={categoriasFiltro}
        categoria={categoriaTexto}
        onSelecionar={(valor) =>
          atualizarFiltro(
            "categoria",
            valor === "Todas as categorias" ? "todas" : valor
          )
        }
        onClose={() => setModalCategoriaAberto(false)}
      />

      <SelecionarFormaPagamentoModal
        aberto={modalFormaPagamentoAberto}
        formasPagamento={formasFiltro}
        formaPagamento={filtros.formaPagamento}
        onSelecionar={(valor) => atualizarFiltro("formaPagamento", valor)}
        onClose={() => setModalFormaPagamentoAberto(false)}
      />
    </>
  );
}

function DateRangePickerModal({
  aberto,
  dataInicioAtual,
  dataFimAtual,
  onAplicar,
  onLimpar,
  onClose,
  formatarData,
}) {
  const hoje = new Date();
  const dataBase = dataInicioAtual ? new Date(`${dataInicioAtual}T00:00:00`) : hoje;

  const [mes, setMes] = useState(dataBase.getMonth());
  const [ano, setAno] = useState(dataBase.getFullYear());
  const [etapa, setEtapa] = useState("inicio");
  const [dataInicio, setDataInicio] = useState(dataInicioAtual || "");
  const [dataFim, setDataFim] = useState(dataFimAtual || "");
  const [modoMesAno, setModoMesAno] = useState(false);
  const [etapaMesAno, setEtapaMesAno] = useState("ano");

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  useEffect(() => {
    if (!aberto) return;

    const base = dataInicioAtual ? new Date(`${dataInicioAtual}T00:00:00`) : new Date();
    setMes(base.getMonth());
    setAno(base.getFullYear());
    setEtapa(dataInicioAtual && !dataFimAtual ? "fim" : "inicio");
    setDataInicio(dataInicioAtual || "");
    setDataFim(dataFimAtual || "");
    setModoMesAno(false);
    setEtapaMesAno("ano");
  }, [aberto, dataInicioAtual, dataFimAtual]);

  if (!aberto) return null;

  function alterarMes(delta) {
    let novoMes = mes + delta;
    let novoAno = ano;

    if (novoMes < 0) {
      novoMes = 11;
      novoAno -= 1;
    }

    if (novoMes > 11) {
      novoMes = 0;
      novoAno += 1;
    }

    setMes(novoMes);
    setAno(novoAno);
  }

  function diasDoMesCalendario() {
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const totalDias = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay();
    const dias = [];

    for (let i = 0; i < diaSemanaInicio; i++) dias.push(null);
    for (let dia = 1; dia <= totalDias; dia++) dias.push(dia);
    while (dias.length < 42) dias.push(null);

    return dias;
  }

  function selecionarDia(dia) {
    const selecionada = dataISO(new Date(ano, mes, dia));

    if (etapa === "fim" && dataInicio && selecionada < dataInicio) return;

    if (etapa === "inicio") {
      setDataInicio(selecionada);
      setDataFim("");
      setEtapa("fim");
      return;
    }

    const inicioFinal = dataInicio || selecionada;
    onAplicar({ dataInicio: inicioFinal, dataFim: selecionada });
    onClose();
  }

  function limparPeriodoInterno() {
    setDataInicio("");
    setDataFim("");
    setEtapa("inicio");
    onLimpar();
    onClose();
  }

  function anosDisponiveis() {
    const anoAtual = new Date().getFullYear();
    return Array.from({ length: 13 }, (_, i) => anoAtual - 6 + i);
  }

  function dataEstaNoIntervalo(data) {
    if (!dataInicio || !dataFim) return false;
    return data >= dataInicio && data <= dataFim;
  }

  function dataEstaSelecionada(data) {
    return data === dataInicio || data === dataFim;
  }

  const instrucao = etapa === "inicio"
    ? "Escolha a data inicial do período."
    : "Agora escolha a data final. Datas anteriores ao início ficam bloqueadas.";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[70] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-black text-green-400">
              {etapa === "inicio" ? "1 de 2" : "2 de 2"}
            </div>
            <h2 className="text-2xl font-black mt-3">Selecionar período</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{instrucao}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black shrink-0"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <ResumoPeriodo titulo="Início" valor={dataInicio ? formatarData(dataInicio) : "Escolher"} ativo={etapa === "inicio"} />
          <ResumoPeriodo titulo="Final" valor={dataFim ? formatarData(dataFim) : "Escolher"} ativo={etapa === "fim"} />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button type="button" onClick={() => alterarMes(-1)} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl">‹</button>

          <button
            type="button"
            onClick={() => {
              setModoMesAno(true);
              setEtapaMesAno("ano");
            }}
            className="flex-1 text-center py-2 rounded-xl hover:bg-white/5 transition"
          >
            <span className="text-xl font-black">{meses[mes]}</span>
            <span className="text-xl font-black mx-2 text-gray-500">/</span>
            <span className="text-xl font-black">{ano}</span>
          </button>

          <button type="button" onClick={() => alterarMes(1)} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl">›</button>
        </div>

        {!modoMesAno ? (
          <div className="grid grid-cols-7 gap-1.5 mt-4 min-h-[292px]">
            {diasSemana.map((dia) => (
              <div key={dia} className="text-center text-[11px] text-gray-500 font-bold h-5">{dia}</div>
            ))}

            {diasDoMesCalendario().map((dia, index) => {
              if (!dia) return <div key={`vazio-${index}`} className="h-10" />;

              const dataDia = dataISO(new Date(ano, mes, dia));
              const bloqueado = etapa === "fim" && dataInicio && dataDia < dataInicio;
              const selecionada = dataEstaSelecionada(dataDia);
              const noIntervalo = dataEstaNoIntervalo(dataDia);

              return (
                <button
                  key={dataDia}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => selecionarDia(dia)}
                  className={`h-10 rounded-lg border text-xs font-black transition ${
                    selecionada
                      ? "border-green-400 bg-green-500 text-black"
                      : noIntervalo
                      ? "border-green-500/30 bg-green-500/10 text-green-400"
                      : bloqueado
                      ? "border-gray-800 bg-[#0B1120] text-gray-700 opacity-40 cursor-not-allowed"
                      : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>
        ) : etapaMesAno === "ano" ? (
          <div className="mt-5">
            <p className="text-sm text-gray-400 mb-4">Escolha o ano</p>
            <div className="grid grid-cols-3 gap-3">
              {anosDisponiveis().map((itemAno) => (
                <button
                  key={itemAno}
                  type="button"
                  onClick={() => {
                    setAno(itemAno);
                    setEtapaMesAno("mes");
                  }}
                  className={`rounded-xl border p-3 font-bold ${
                    ano === itemAno
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                  }`}
                >
                  {itemAno}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <button type="button" onClick={() => setEtapaMesAno("ano")} className="mb-4 text-sm text-gray-400 hover:text-white">← Voltar para anos</button>
            <div className="grid grid-cols-3 gap-3">
              {meses.map((nomeMes, index) => (
                <button
                  key={nomeMes}
                  type="button"
                  onClick={() => {
                    setMes(index);
                    setModoMesAno(false);
                  }}
                  className={`rounded-xl border p-3 font-bold ${
                    mes === index
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                  }`}
                >
                  {nomeMes.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button type="button" onClick={limparPeriodoInterno} className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-2xl p-3">
            Limpar
          </button>
          <button type="button" onClick={() => setEtapa("inicio")} className="border border-green-500/50 hover:bg-green-500/10 text-green-400 font-black rounded-2xl p-3">
            Recomeçar
          </button>
        </div>
      </div>
    </div>
  );
}


function dataISO(date) {
  return date.toISOString().split("T")[0];
}

function ResumoPeriodo({ titulo, valor, ativo }) {
  return (
    <div className={`rounded-2xl border p-3 ${ativo ? "border-green-500/50 bg-green-500/10" : "border-gray-800 bg-[#0B1120]"}`}>
      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">{titulo}</p>
      <p className={`text-sm font-black mt-1 truncate ${ativo ? "text-green-400" : "text-white"}`}>{valor}</p>
    </div>
  );
}

function textoPeriodoFiltro(dataInicio, dataFim, formatarData) {
  if (dataInicio && dataFim) {
    if (dataInicio === dataFim) return formatarData(dataInicio);
    return `${formatarData(dataInicio)} até ${formatarData(dataFim)}`;
  }

  if (dataInicio) return `A partir de ${formatarData(dataInicio)}`;
  if (dataFim) return `Até ${formatarData(dataFim)}`;
  return "Selecionar período";
}

function ButtonField({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[50px] bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-2xl px-4 py-3 text-left text-sm font-bold text-white transition flex items-center justify-between gap-3"
    >
      <span className="truncate">{children}</span>
      <span className="text-gray-500 text-lg leading-none">›</span>
    </button>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
