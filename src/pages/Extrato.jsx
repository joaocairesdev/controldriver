import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import DetalhesLancamentoModal from "../components/modals/DetalhesLancamentoModal";
import ConfirmacaoModal from "../components/modals/ConfirmacaoModal";
import FeedbackModal from "../components/modals/FeedbackModal";

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
      .filter((item) => item.tipo === "saida")
      .map((item) => item.categoria)
      .filter(Boolean);

    return [...new Set(categorias)].sort();
  }, [todosLancamentos]);

  const lancamentosFiltrados = useMemo(() => {
    let lista = [...todosLancamentos];

    if (filtroTipo !== "todos" && filtroTipo !== "personalizado") {
      lista = lista.filter((item) => item.tipo === filtroTipo);
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
    abrirFeedback("aviso", "Em breve", "A edição de lançamentos será conectada na próxima etapa.");
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

    if (lancamentoAlvo.tipo === "saida") {
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

      <div className="mt-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { nome: "Todos", valor: "todos" },
            { nome: "Entrada", valor: "entrada" },
            { nome: "Entrada Avulsa", valor: "entrada_avulsa" },
            { nome: "Saída", valor: "saida" },
            { nome: "Movimentação", valor: "transferencia" },
            { nome: "Personalizado", valor: "personalizado" },
          ].map((item) => {
            const ativo = filtroTipo === item.valor;

            return (
              <button
                key={item.valor}
                type="button"
                onClick={() => selecionarFiltro(item.valor)}
                className={`px-4 py-2 rounded-xl border font-semibold transition ${
                  ativo
                    ? "bg-green-500 text-black border-green-500"
                    : "border-gray-700 text-gray-300 hover:bg-white/5"
                }`}
              >
                {item.nome}
              </button>
            );
          })}

          {(filtroTipo !== "todos" || busca) && (
            <button
              type="button"
              onClick={limparFiltros}
              className="px-4 py-2 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 font-semibold"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <div className="relative w-full xl:w-80">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
            🔍
          </span>

          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no extrato..."
            className="w-full bg-[#111827] border border-gray-700 focus:border-green-400 outline-none rounded-xl py-3 pl-11 pr-4"
          />
        </div>
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

        {lancamentosPagina.map((item) => {
          const selecionado = selecionados.includes(item.id);

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
            className={`w-full text-left bg-[#111827] border rounded-2xl p-5 flex items-center justify-between gap-4 transition cursor-pointer ${
              selecionado
                ? "border-green-400 bg-green-500/10"
                : "border-gray-800 hover:border-green-400/60"
            }`}
          >
            <div className="flex items-center gap-4">
              {modoSelecao && (
                <div
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                    selecionado
                      ? "bg-green-500 border-green-500 text-black"
                      : "border-gray-600 text-transparent"
                  }`}
                >
                  ✓
                </div>
              )}
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                  item.tipo === "entrada" || item.tipo === "entrada_avulsa"
  ? "bg-green-500/20 text-green-400"
  : item.tipo === "conta_pagar" || item.tipo === "transferencia"
  ? "bg-blue-500/20 text-blue-400"
  : "bg-red-500/20 text-red-400"
                }`}
              >
                {
  item.tipo === "entrada" || item.tipo === "entrada_avulsa"
    ? "↑"
    : item.tipo === "conta_pagar" || item.tipo === "transferencia"
    ? "→"
    : "↓"
}
              </div>

              <div>
                <p className="text-sm text-gray-500">{formatarData(item.data)}</p>
                <h2 className="text-lg font-bold">{item.titulo}</h2>
                <p className="text-sm text-gray-400 mt-1">{item.descricao}</p>
              </div>
            </div>

            <div className="text-right">
              <p
                className={`text-xl font-bold ${
                  item.tipo === "entrada" || item.tipo === "entrada_avulsa"
  ? "text-green-400"
  : item.tipo === "conta_pagar" || item.tipo === "transferencia"
  ? "text-blue-400"
  : "text-red-400"
                }`}
              >
                {
  item.tipo === "entrada" || item.tipo === "entrada_avulsa"
    ? "+"
    : item.tipo === "conta_pagar" || item.tipo === "transferencia"
    ? ""
    : "-"
} {formatarMoeda(item.valor)}
              </p>

              {(item.tipo === "entrada" || item.tipo === "entrada_avulsa") && (
                <p className="text-xs text-gray-500 mt-1">
                  Para {item.contaDestino}
                </p>
              )}

              {item.tipo === "transferencia" && (
                <>
                  <p className="text-xs text-gray-400 mt-1">
                    Movimentação entre contas
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.contaOrigem} → {item.contaDestino}
                  </p>
                </>
              )}

             {(item.tipo === "saida" || item.tipo === "conta_pagar") && (
  <>
    <p className="text-xs text-gray-400 mt-1">
      {item.tipo === "conta_pagar"
        ? `Contas a pagar - ${item.formaPagamentoTexto} Registrado`
        : item.formaPagamentoTexto}
    </p>

    {item.tipo !== "conta_pagar" && (
      <p className="text-xs text-gray-500 mt-0.5">
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
          fechar={() => setModalPersonalizadoAberto(false)}
          limpar={limparFiltros}
        />
      )}

      <DetalhesLancamentoModal
  aberto={!!lancamentoSelecionado}
  lancamento={lancamentoSelecionado}
  fechar={() => setLancamentoSelecionado(null)}
  editar={() => editarLancamento(lancamentoSelecionado)}
  pedirExclusao={() => setConfirmarExclusao(lancamentoSelecionado)}
  formatarMoeda={formatarMoeda}
  formatarData={formatarData}
  formatarHoraSemSegundos={formatarHoraSemSegundos}
/>

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

function ModalPersonalizado({ filtros, setFiltros, categorias, fechar, limpar }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Filtro personalizado</h2>
            <p className="text-gray-400 mt-2">
              Escolha período, categoria e forma de pagamento.
            </p>
          </div>

          <button
            type="button"
            onClick={fechar}
            className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <Campo label="Data inicial">
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, dataInicio: e.target.value }))
              }
              className="input-base"
            />
          </Campo>

          <Campo label="Data final">
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, dataFim: e.target.value }))
              }
              className="input-base"
            />
          </Campo>

          <Campo label="Categoria">
            <select
              value={filtros.categoria}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, categoria: e.target.value }))
              }
              className="input-base"
            >
              <option value="todas">Todas</option>
              <option value="Entrada">Entrada</option>
              {categorias.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Forma de pagamento">
            <select
              value={filtros.formaPagamento}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, formaPagamento: e.target.value }))
              }
              className="input-base"
            >
              <option value="todas">Todas</option>
              <option value="pix">Pix</option>
              <option value="debito">Débito</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="credito">Cartão de crédito</option>
            </select>
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            type="button"
            onClick={limpar}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
          >
            Limpar filtros
          </button>

          <button
            type="button"
            onClick={fechar}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalDetalhes({
  lancamento,
  fechar,
  editar,
  pedirExclusao,
  formatarMoeda,
  formatarData,
  formatarHoraSemSegundos,
}) {
  const dados = lancamento.dadosOriginais;
  const abastecimento = dados.abastecimento;
  const manutencao = dados.manutencao;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">{formatarData(lancamento.data)}</p>
            <h2 className="text-2xl font-bold mt-1">{lancamento.titulo}</h2>
            <p className="text-gray-400 mt-1">{lancamento.descricao}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={pedirExclusao}
              className="w-10 h-10 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold"
              title="Excluir"
            >
              🗑️
            </button>

            <button
              type="button"
              onClick={fechar}
              className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {lancamento.tipo === "entrada" && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DetalheItem
                titulo="Valor total"
                valor={`+ ${formatarMoeda(lancamento.valor)}`}
                destaque="green"
              />
              <DetalheItem titulo="KM rodados" valor={`${dados.km_rodados || 0} km`} />
              <DetalheItem
                titulo="Horas trabalhadas"
                valor={formatarHoraSemSegundos(dados.horas_trabalhadas)}
              />
            </div>

            <h3 className="font-bold pt-2">Plataformas</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(dados.entrada_plataformas || []).map((item, index) => {
                const total =
                  Number(item.faturamento || 0) + Number(item.valor_reembolso || 0);

                return (
                  <div
                    key={index}
                    className="bg-[#0B1120] border border-gray-800 rounded-xl p-4"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-semibold">
                          {item.plataformas?.nome || "Plataforma"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.numero_corridas || 0} corrida(s)
                        </p>
                        {item.houve_pedagio && (
                          <p className="text-xs text-gray-500 mt-1">
                            Inclui reembolso de pedágio
                          </p>
                        )}
                      </div>

                      <p className="font-bold text-green-400">
                        {formatarMoeda(total)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {lancamento.tipo === "saida" && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DetalheItem
                titulo="Valor total"
                valor={`- ${formatarMoeda(lancamento.valor)}`}
                destaque="red"
              />
              <DetalheItem titulo="Categoria" valor={dados.categoria || "-"} />
              <DetalheItem titulo="Status" valor={dados.status || "-"} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetalheItem
                titulo="Forma de pagamento"
                valor={dados.formaPagamentoTexto || "-"}
              />
              <DetalheItem titulo="Conta / Cartão" valor={dados.contaOrigem || "-"} />
              <DetalheItem
                titulo="Descrição"
                valor={dados.descricao || dados.categoria || "-"}
              />
            </div>

            {abastecimento && (
              <>
                <h3 className="font-bold pt-2">Abastecimento</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <DetalheItem
                    titulo="Combustível"
                    valor={abastecimento.tipo_combustivel || "-"}
                  />
                  <DetalheItem
                    titulo="Litros"
                    valor={`${Number(abastecimento.litros || 0).toFixed(3)} L`}
                  />
                  <DetalheItem
                    titulo="Valor/L"
                    valor={formatarMoeda(abastecimento.valor_litro || 0)}
                  />
                  <DetalheItem
                    titulo="Odômetro"
                    valor={`${Number(abastecimento.odometro || 0).toLocaleString(
                      "pt-BR"
                    )} km`}
                  />
                  <DetalheItem
                    titulo="KM rodados"
                    valor={`${Number(abastecimento.km_rodados || 0).toLocaleString(
                      "pt-BR"
                    )} km`}
                  />
                  <DetalheItem
                    titulo="Consumo"
                    valor={
                      abastecimento.consumo_km_l
                        ? `${Number(abastecimento.consumo_km_l).toFixed(2)} km/L`
                        : "-"
                    }
                  />
                </div>
              </>
            )}

            {manutencao && (
              <>
                <h3 className="font-bold pt-2">Manutenção</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DetalheItem
                    titulo="Tipo"
                    valor={manutencao.tipo_manutencao || "-"}
                  />
                  <DetalheItem titulo="Serviço" valor={manutencao.servico || "-"} />
                  <DetalheItem titulo="Oficina" valor={manutencao.oficina || "-"} />
                  <DetalheItem
                    titulo="Odômetro"
                    valor={`${Number(manutencao.odometro || 0).toLocaleString(
                      "pt-BR"
                    )} km`}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            type="button"
            onClick={editar}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={fechar}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
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

function DetalheItem({ titulo, valor, destaque }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500">{titulo}</p>

      <p
        className={`font-bold mt-1 ${
          destaque === "green"
            ? "text-green-400"
            : destaque === "red"
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}