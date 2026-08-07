import { useEffect, useMemo, useRef, useState } from "react";
import { FiEdit2, FiFilter, FiSearch, FiTrash2 } from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import ModalBase from "../../../shared/components/modals/ModalBase";
import { rotuloEntradaAvulsa } from "../../contratos/utils/contratosFinanceiros";
import { normalizarDescricaoRecebimentoSemanal } from "../utils/plataformasFinanceiro";

const ITENS_POR_PAGINA_CONTA = 50;

export default function ModalExtratoConta({
  aberto,
  conta,
  onClose,
  onEditarConta,
  onExcluirConta,
  formatarMoeda,
  formatarData,
}) {
  const [carregando, setCarregando] = useState(false);
  const [movimentos, setMovimentos] = useState([]);
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [modalFiltroAberto, setModalFiltroAberto] = useState(false);
  const topoListaRef = useRef(null);

  const [filtros, setFiltros] = useState({
    dataInicio: "",
    dataFim: "",
    tipos: [],
    categorias: [],
  });

  useEffect(() => {
    if (!aberto || !conta?.id) return;
    carregarExtratoConta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, conta?.id]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtros, conta?.id]);

  function textoFormaPagamento(forma) {
    const nomes = {
      pix: "Pix",
      debito: "Débito",
      dinheiro: "Dinheiro",
      boleto: "Boleto",
      boleto_parcelado: "Boleto Parcelado",
      credito: "Crédito",
      credito_avista: "Crédito à Vista",
      credito_parcelado: "Crédito Parcelado",
      tag: "TAG",
    };

    return nomes[forma] || forma || "-";
  }

  async function carregarExtratoConta() {
    setCarregando(true);

    try {
      const contaId = conta.id;

      const { data: entradasData, error: erroEntradas } = await supabase
        .from("entradas")
        .select(`
          id,
          data,
          created_at,
          conta_id,
          entrada_plataformas (
            faturamento,
            valor_reembolso,
            numero_corridas,
            plataformas ( nome )
          )
        `)
        .eq("conta_id", contaId);

      if (erroEntradas) throw erroEntradas;

      const { data: entradasAvulsasData, error: erroEntradasAvulsas } =
        await supabase
          .from("entradas_avulsas")
          .select("id, data, created_at, valor, descricao, finalidade, contrato_financeiro_id")
          .eq("conta_id", contaId);

      if (erroEntradasAvulsas) throw erroEntradasAvulsas;

      const { data: saidasData, error: erroSaidas } = await supabase
        .from("saidas")
        .select(`
          id,
          data_compra,
          created_at,
          categoria,
          descricao,
          valor_total,
          forma_pagamento,
          tipo_movimentacao,
          status
        `)
        .eq("conta_id", contaId);

      if (erroSaidas) throw erroSaidas;

      const { data: transferenciasOrigem, error: erroTransferenciasOrigem } =
        await supabase
          .from("transferencias")
          .select(
            "id, data, created_at, valor, descricao, conta_origem_id, conta_destino_id, tipo, plataforma_id, plataformas ( nome )",
          )
          .eq("conta_origem_id", contaId);

      if (erroTransferenciasOrigem) throw erroTransferenciasOrigem;

      const { data: transferenciasDestino, error: erroTransferenciasDestino } =
        await supabase
          .from("transferencias")
          .select(
            "id, data, created_at, valor, descricao, conta_origem_id, conta_destino_id, tipo, plataforma_id, plataformas ( nome )",
          )
          .eq("conta_destino_id", contaId);

      if (erroTransferenciasDestino) throw erroTransferenciasDestino;

      const idsContasTransferencias = [
        ...new Set(
          [...(transferenciasOrigem || []), ...(transferenciasDestino || [])]
            .flatMap((item) => [item.conta_origem_id, item.conta_destino_id])
            .filter(Boolean),
        ),
      ];

      let nomesContas = {};
      if (idsContasTransferencias.length > 0) {
        const { data: contasTransferencias } = await supabase
          .from("contas")
          .select("id, nome")
          .in("id", idsContasTransferencias);

        nomesContas = Object.fromEntries(
          (contasTransferencias || []).map((item) => [
            String(item.id),
            item.nome,
          ]),
        );
      }

      const entradas = (entradasData || []).map((entrada) => {
        const total = (entrada.entrada_plataformas || []).reduce(
          (soma, item) =>
            soma +
            Number(item.faturamento || 0) +
            Number(item.valor_reembolso || 0),
          0,
        );

        const plataformas = (entrada.entrada_plataformas || [])
          .map((item) => item.plataformas?.nome)
          .filter(Boolean)
          .join(", ");

        return {
          id: `entrada-${entrada.id}`,
          tipo: "entrada",
          data: entrada.data,
          created_at: entrada.created_at,
          descricao: plataformas || "Ganhos com Plataformas",
          categoria: "Entrada",
          valor: total,
          textoBusca: `entrada ganhos plataformas ${plataformas}`,
        };
      });

      const entradasAvulsas = (entradasAvulsasData || []).map((entrada) => ({
        id: `entrada-avulsa-${entrada.id}`,
        tipo: "entrada",
        data: entrada.data,
        created_at: entrada.created_at,
        descricao: entrada.descricao || "Entrada avulsa",
        categoria: rotuloEntradaAvulsa(entrada),
        valor: Number(entrada.valor || 0),
        textoBusca: `${rotuloEntradaAvulsa(entrada)} ${entrada.descricao || ""} ${entrada.finalidade || ""}`,
      }));

      const saidas = (saidasData || [])
        .filter((saida) => saida.tipo_movimentacao !== "conta_pagar")
        .map((saida) => ({
          id: `saida-${saida.id}`,
          tipo: "saida",
          data: saida.data_compra,
          created_at: saida.created_at,
          descricao: saida.descricao || saida.categoria || "Saída",
          categoria: saida.categoria || "Saída",
          valor: Number(saida.valor_total || 0),
          textoBusca: `saida ${saida.categoria || ""} ${saida.descricao || ""} ${textoFormaPagamento(saida.forma_pagamento)}`,
        }));

      const transferenciasSaida = (transferenciasOrigem || []).map(
        (transferencia) => ({
          id: `transferencia-saida-${transferencia.id}`,
          tipo: "saida",
          data: transferencia.data,
          created_at: transferencia.created_at,
          descricao: transferencia.descricao || "Transferência enviada",
          categoria: "Transferência",
          valor: Number(transferencia.valor || 0),
          textoBusca: `saida transferencia enviada ${transferencia.descricao || ""} para ${
            nomesContas[String(transferencia.conta_destino_id)] || ""
          }`,
        }),
      );

      const transferenciasEntrada = (transferenciasDestino || []).map(
        (transferencia) => {
          const nomePlataforma = transferencia.plataformas?.nome || "Plataforma";
          const creditoDireto = transferencia.tipo === "recebimento_direto_plataforma";
          const recebimentoAutomatico =
            transferencia.tipo === "recebimento_automatico_plataforma";
          const saquePlataforma = transferencia.tipo === "saque_plataforma";
          const descricao = creditoDireto
            ? `Ganhos com ${nomePlataforma}`
            : recebimentoAutomatico
              ? normalizarDescricaoRecebimentoSemanal(
                  transferencia.descricao,
                  nomePlataforma,
                )
              : saquePlataforma
                ? `Saque - ${nomePlataforma}`
                : transferencia.descricao || "Transferência recebida";
          const categoria = creditoDireto
            ? "Ganhos com Plataformas"
            : recebimentoAutomatico
              ? "Recebimento semanal automático"
              : saquePlataforma
                ? "Saque da Plataforma"
                : "Transferência";

          return {
            id: `transferencia-entrada-${transferencia.id}`,
            tipo: "entrada",
            data: transferencia.data,
            created_at: transferencia.created_at,
            descricao,
            categoria,
            valor: Number(transferencia.valor || 0),
            textoBusca: `entrada ${categoria} ${descricao} ${
              nomesContas[String(transferencia.conta_origem_id)] || ""
            }`,
          };
        },
      );

      const lista = [
        ...entradas,
        ...entradasAvulsas,
        ...saidas,
        ...transferenciasSaida,
        ...transferenciasEntrada,
      ].sort((a, b) => {
  const dataA = new Date(`${a.data || "1900-01-01"}T00:00:00`).getTime();
  const dataB = new Date(`${b.data || "1900-01-01"}T00:00:00`).getTime();

  if (dataA !== dataB) return dataB - dataA;

  const criadoA = new Date(a.created_at || 0).getTime();
  const criadoB = new Date(b.created_at || 0).getTime();

  return criadoB - criadoA;
});

      setMovimentos(lista);
    } catch (erro) {
      console.error("Erro ao carregar extrato da conta:", erro);
      setMovimentos([]);
    } finally {
      setCarregando(false);
    }
  }

  function limparFiltros() {
    setBusca("");
    setFiltros({
      dataInicio: "",
      dataFim: "",
      tipos: [],
      categorias: [],
    });
    setModalFiltroAberto(false);
  }

  const categoriasDisponiveis = useMemo(() => {
    const categorias = movimentos.map((item) => item.categoria).filter(Boolean);
    return [...new Set(categorias)].sort();
  }, [movimentos]);

  const movimentosFiltrados = useMemo(() => {
    let lista = [...movimentos];

    if (filtros.tipos.length > 0) {
      lista = lista.filter((item) => filtros.tipos.includes(item.tipo));
    }

    if (filtros.dataInicio) {
      lista = lista.filter((item) => item.data >= filtros.dataInicio);
    }

    if (filtros.dataFim) {
      lista = lista.filter((item) => item.data <= filtros.dataFim);
    }

    if ((filtros.categorias || []).length > 0) {
      lista = lista.filter((item) => filtros.categorias.includes(item.categoria));
    }

    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      lista = lista.filter((item) =>
        String(item.textoBusca || "").toLowerCase().includes(termo),
      );
    }

    return lista;
  }, [movimentos, filtros, busca]);

  const resumo = useMemo(() => {
    return movimentos.reduce(
      (total, item) => {
        if (item.tipo === "entrada") total.entradas += Number(item.valor || 0);
        if (item.tipo === "saida") total.saidas += Number(item.valor || 0);
        return total;
      },
      { entradas: 0, saidas: 0 },
    );
  }, [movimentos]);

  const totalPaginas = Math.max(
    Math.ceil(movimentosFiltrados.length / ITENS_POR_PAGINA_CONTA),
    1,
  );

  const movimentosPagina = movimentosFiltrados.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA_CONTA,
    paginaAtual * ITENS_POR_PAGINA_CONTA,
  );

  function mudarPagina(novaPagina) {
    const paginaSegura = Math.min(Math.max(Number(novaPagina || 1), 1), totalPaginas);
    setPaginaAtual(paginaSegura);

    requestAnimationFrame(() => {
      topoListaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resumoRegistros() {
    if (movimentosFiltrados.length === 0) return "Nenhuma movimentação";

    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA_CONTA + 1;
    const fim = Math.min(
      paginaAtual * ITENS_POR_PAGINA_CONTA,
      movimentosFiltrados.length,
    );

    return `Mostrando ${inicio}-${fim} de ${movimentosFiltrados.length} movimentação(s)`;
  }

  const saldoInicial = Number(conta?.saldo_inicial || 0);
  const saldoAtual = Number(conta?.saldo_atual ?? conta?.saldo_inicial ?? 0);
  const temFiltroAtivo =
    busca ||
    filtros.dataInicio ||
    filtros.dataFim ||
    filtros.tipos.length > 0 ||
    filtros.categorias.length > 0;

  return (
    <>
      <ModalBase
        aberto={aberto && !!conta}
        titulo="Extrato da conta"
        descricao={conta?.nome || ""}
        onClose={onClose}
        largura="max-w-6xl"
        z="z-50"
        acaoCabecalho={
          onEditarConta || onExcluirConta ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {onEditarConta ? (
                <button
                  type="button"
                  onClick={onEditarConta}
                  className="h-10 rounded-xl border border-gray-700 bg-[#0B1120] px-3 flex items-center justify-center gap-2 text-sm font-bold text-gray-300 hover:text-white hover:border-gray-500 transition"
                >
                  <FiEdit2 />
                  Editar Conta
                </button>
              ) : null}

              {onExcluirConta ? (
                <button
                  type="button"
                  onClick={onExcluirConta}
                  className="h-10 rounded-xl border border-gray-700 bg-[#0B1120] px-3 flex items-center justify-center gap-2 text-sm font-bold text-gray-300 hover:text-red-400 hover:border-red-500/40 transition"
                >
                  <FiTrash2 />
                  Excluir Conta
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        <div className="space-y-5" ref={topoListaRef}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ResumoCard
              titulo="Saldo inicial"
              valor={formatarMoeda(saldoInicial)}
              destaque="apagado"
            />
            <ResumoCard
              titulo="Entradas"
              valor={formatarMoeda(resumo.entradas)}
              destaque="positivo"
            />
            <ResumoCard
              titulo="Saídas"
              valor={formatarMoeda(resumo.saidas)}
              destaque="negativo"
            />
            <ResumoCard
              titulo="Saldo atual"
              valor={formatarMoeda(saldoAtual)}
              destaque={saldoAtual < 0 ? "negativoDestaque" : "destaque"}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="relative min-w-0">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <FiSearch />
              </span>
              <input
                type="text"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar neste extrato..."
                className="w-full h-12 bg-[#0B1120] border border-gray-700 focus:border-green-400 outline-none rounded-xl py-3 pl-11 pr-4"
              />
            </div>

            <button
              type="button"
              onClick={() => setModalFiltroAberto(true)}
              className={`w-12 h-12 rounded-xl border font-bold flex items-center justify-center transition ${
                temFiltroAtivo
                  ? "border-green-500/60 text-green-400 bg-green-500/10"
                  : "border-gray-700 text-gray-300 hover:bg-white/5"
              }`}
              title="Filtros do extrato da conta"
              aria-label="Filtros do extrato da conta"
            >
              <FiFilter />
            </button>
          </div>

          {temFiltroAtivo && (
            <button
              type="button"
              onClick={limparFiltros}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 font-semibold text-sm"
            >
              Limpar filtros
            </button>
          )}

          <div className="text-sm text-gray-500">
            {resumoRegistros()}
          </div>

          {carregando && (
            <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
              <p className="text-gray-400">Carregando extrato da conta...</p>
            </div>
          )}

          {!carregando && movimentosFiltrados.length === 0 && (
            <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-6 text-center">
              <p className="text-gray-400">Nenhuma movimentação encontrada.</p>
            </div>
          )}

          {!carregando && movimentosFiltrados.length > 0 && (
            <div className="space-y-3">
              {movimentosPagina.map((item) => (
                <MovimentoLinha
                  key={item.id}
                  item={item}
                  formatarMoeda={formatarMoeda}
                  formatarData={formatarData}
                />
              ))}
            </div>
          )}

          {totalPaginas > 1 && (
            <PaginacaoExtratoConta
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              mudarPagina={mudarPagina}
            />
          )}
        </div>
      </ModalBase>

      <FiltroExtratoContaModal
        aberto={modalFiltroAberto}
        filtros={filtros}
        setFiltros={setFiltros}
        categorias={categoriasDisponiveis}
        formatarData={formatarData}
        onClose={() => setModalFiltroAberto(false)}
        onLimpar={limparFiltros}
      />
    </>
  );
}

function ResumoCard({ titulo, valor, destaque = "normal" }) {
  const cor =
    destaque === "positivo"
      ? "text-green-400"
      : destaque === "negativo" || destaque === "negativoDestaque"
        ? "text-red-400"
        : destaque === "apagado"
          ? "text-gray-500"
          : "text-white";

  const textoValor = destaque.includes("destaque")
    ? "text-xl sm:text-2xl"
    : "text-lg sm:text-xl";
  const borda = destaque.includes("destaque")
    ? "border-green-500/40"
    : "border-gray-800";
  const opacidade = destaque === "apagado" ? "opacity-70" : "";

  return (
    <div className={`bg-[#0B1120] border ${borda} rounded-2xl p-4 ${opacidade}`}>
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`${textoValor} font-black mt-2 ${cor}`}>{valor}</p>
    </div>
  );
}

function MovimentoLinha({ item, formatarMoeda, formatarData }) {
  const entrada = item.tipo === "entrada";
  const sinal = entrada ? "+" : "-";
  const corValor = entrada ? "text-green-400" : "text-red-400";

  return (
    <div className="w-full bg-[#0B1120] border border-gray-800 rounded-2xl px-4 py-3 grid grid-cols-[72px_minmax(0,1fr)_auto] sm:grid-cols-[82px_minmax(0,1fr)_180px_140px] items-center gap-x-3 gap-y-1">
      <p className="text-xs text-gray-500 whitespace-nowrap">
        {formatarData(item.data)}
      </p>

      <h3 className="min-w-0 text-sm sm:text-base font-black truncate">
        {item.descricao}
      </h3>

      <p className="col-start-2 row-start-2 min-w-0 text-xs sm:col-start-3 sm:row-start-1 sm:text-sm text-gray-400 truncate">
        {item.categoria}
      </p>

      <p className={`col-start-3 row-span-2 row-start-1 text-sm sm:col-start-4 sm:row-span-1 sm:text-lg font-black whitespace-nowrap text-right ${corValor}`}>
        {sinal} {formatarMoeda(item.valor)}
      </p>
    </div>
  );
}

function FiltroExtratoContaModal({
  aberto,
  filtros,
  setFiltros,
  categorias,
  formatarData,
  onClose,
  onLimpar,
}) {
  const [modalPeriodoAberto, setModalPeriodoAberto] = useState(false);
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false);

  const periodoTexto = textoPeriodoFiltro(
    filtros.dataInicio,
    filtros.dataFim,
    formatarData,
  );

  const categoriasSelecionadas = filtros.categorias || [];
  const categoriaTexto =
    categoriasSelecionadas.length === 0
      ? "Todas as categorias"
      : categoriasSelecionadas.length === 1
        ? categoriasSelecionadas[0]
        : `${categoriasSelecionadas.length} categorias selecionadas`;

  const categoriasFiltro = categorias.map((categoria) => ({
    valor: categoria,
    titulo: categoria,
  }));

  function alternarTipo(tipo) {
    setFiltros((atual) => {
      const tiposAtuais = atual.tipos || [];

      return {
        ...atual,
        tipos: tiposAtuais.includes(tipo)
          ? tiposAtuais.filter((item) => item !== tipo)
          : [...tiposAtuais, tipo],
      };
    });
  }

  function aplicarPeriodo({ dataInicio, dataFim }) {
    setFiltros((atual) => ({
      ...atual,
      dataInicio,
      dataFim,
    }));
  }

  function limparPeriodo() {
    setFiltros((atual) => ({
      ...atual,
      dataInicio: "",
      dataFim: "",
    }));
  }

  function atualizarCategorias(lista) {
    setFiltros((atual) => ({
      ...atual,
      categorias: lista,
    }));
  }

  const tipos = [
    { valor: "entrada", titulo: "Entradas" },
    { valor: "saida", titulo: "Saídas" },
  ];

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo="Filtro do extrato"
        descricao="Filtre por tipo, período e categoria."
        onClose={onClose}
        largura="max-w-lg"
        z="z-[70]"
        rodape={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onLimpar}
              className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-2xl p-3"
            >
              Limpar filtros
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-green-500 hover:bg-green-600 text-black font-black rounded-2xl p-3"
            >
              Aplicar filtros
            </button>
          </div>
        }
      >
        <div>
          <label className="text-sm text-gray-300">Tipo</label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {tipos.map((tipo) => {
              const ativo = (filtros.tipos || []).includes(tipo.valor);

              return (
                <button
                  key={tipo.valor}
                  type="button"
                  onClick={() => alternarTipo(tipo.valor)}
                  className={`min-h-[48px] rounded-2xl border px-3 font-black transition ${
                    ativo
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                  }`}
                >
                  {tipo.titulo}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <Campo label="Período">
            <ButtonField onClick={() => setModalPeriodoAberto(true)}>
              {periodoTexto}
            </ButtonField>
          </Campo>
        </div>

        <div className="mt-5">
          <Campo label="Categoria">
            <ButtonField onClick={() => setModalCategoriasAberto(true)}>
              {categoriaTexto}
            </ButtonField>
          </Campo>
        </div>
      </ModalBase>

      <DateRangePickerModal
        aberto={modalPeriodoAberto}
        dataInicioAtual={filtros.dataInicio}
        dataFimAtual={filtros.dataFim}
        onAplicar={aplicarPeriodo}
        onLimpar={limparPeriodo}
        onClose={() => setModalPeriodoAberto(false)}
        formatarData={formatarData}
      />

      <ModalSelecaoMultipla
        aberto={modalCategoriasAberto}
        titulo="Selecionar categorias"
        descricao="Escolha uma ou mais categorias para filtrar este extrato."
        opcoes={categoriasFiltro}
        selecionados={categoriasSelecionadas}
        onChange={atualizarCategorias}
        onClose={() => setModalCategoriasAberto(false)}
        textoVazio="Nenhuma categoria disponível."
      />
    </>
  );
}

function paginasVisiveis(paginaAtual, totalPaginas) {
  const totalVisivel = Math.min(5, totalPaginas);
  let inicio = Math.max(1, paginaAtual - Math.floor(totalVisivel / 2));
  let fim = inicio + totalVisivel - 1;

  if (fim > totalPaginas) {
    fim = totalPaginas;
    inicio = Math.max(1, fim - totalVisivel + 1);
  }

  return Array.from({ length: fim - inicio + 1 }, (_, index) => inicio + index);
}

function PaginacaoExtratoConta({ paginaAtual, totalPaginas, mudarPagina }) {
  const paginas = paginasVisiveis(paginaAtual, totalPaginas);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
      <button
        type="button"
        disabled={paginaAtual === 1}
        onClick={() => mudarPagina(1)}
        className="min-w-10 h-10 px-3 rounded-xl border border-gray-700 disabled:opacity-40 hover:bg-white/5 font-bold"
        title="Primeira página"
      >
        &lt;&lt;
      </button>

      <button
        type="button"
        disabled={paginaAtual === 1}
        onClick={() => mudarPagina(paginaAtual - 1)}
        className="min-w-10 h-10 px-3 rounded-xl border border-gray-700 disabled:opacity-40 hover:bg-white/5 font-bold"
        title="Página anterior"
      >
        &lt;
      </button>

      {paginas.map((pagina) => {
        const ativa = pagina === paginaAtual;

        return (
          <button
            key={pagina}
            type="button"
            onClick={() => mudarPagina(pagina)}
            className={`min-w-10 h-10 px-3 rounded-xl border font-black transition ${
              ativa
                ? "bg-green-500 border-green-500 text-black"
                : "border-gray-700 text-gray-300 hover:bg-white/5"
            }`}
          >
            {pagina}
          </button>
        );
      })}

      <button
        type="button"
        disabled={paginaAtual === totalPaginas}
        onClick={() => mudarPagina(paginaAtual + 1)}
        className="min-w-10 h-10 px-3 rounded-xl border border-gray-700 disabled:opacity-40 hover:bg-white/5 font-bold"
        title="Próxima página"
      >
        &gt;
      </button>

      <button
        type="button"
        disabled={paginaAtual === totalPaginas}
        onClick={() => mudarPagina(totalPaginas)}
        className="min-w-10 h-10 px-3 rounded-xl border border-gray-700 disabled:opacity-40 hover:bg-white/5 font-bold"
        title="Última página"
      >
        &gt;&gt;
      </button>
    </div>
  );
}

function ModalSelecaoMultipla({
  aberto,
  titulo,
  descricao,
  opcoes,
  selecionados,
  onChange,
  onClose,
  textoVazio,
}) {
  if (!aberto) return null;

  function alternarOpcao(valor) {
    const listaAtual = selecionados || [];
    const novaLista = listaAtual.includes(valor)
      ? listaAtual.filter((item) => item !== valor)
      : [...listaAtual, valor];

    onChange(novaLista);
  }

  function limparSelecao() {
    onChange([]);
  }

  return (
    <ModalBase
      aberto={aberto}
      titulo={titulo}
      descricao={descricao}
      onClose={onClose}
      largura="max-w-lg"
      z="z-[80]"
      rodape={
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={limparSelecao}
            className="w-full border border-gray-700 hover:bg-white/5 text-white font-black rounded-2xl p-4"
          >
            Limpar seleção
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-black rounded-2xl p-4"
          >
            Aplicar
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        {opcoes.map((opcao) => {
          const ativo = (selecionados || []).includes(opcao.valor);

          return (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => alternarOpcao(opcao.valor)}
              className={`w-full min-h-[50px] rounded-2xl border px-4 py-3 text-left transition flex items-center justify-between gap-3 ${
                ativo
                  ? "border-green-400 bg-green-500/10"
                  : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
              }`}
            >
              <span className={`font-black ${ativo ? "text-green-400" : "text-white"}`}>
                {opcao.titulo}
              </span>

              <span
                className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0 ${
                  ativo
                    ? "bg-green-500 border-green-500 text-black"
                    : "border-gray-600 text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          );
        })}

        {opcoes.length === 0 && (
          <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4 text-sm text-gray-500">
            {textoVazio}
          </div>
        )}
      </div>
    </ModalBase>
  );
}

function dataISO(date) {
  return date.toISOString().split("T")[0];
}

function ResumoPeriodo({ titulo, valor, ativo }) {
  return (
    <div className={`rounded-2xl border p-3 ${ativo ? "border-green-500/50 bg-green-500/10" : "border-gray-800 bg-[#0B1120]"}`}>
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`font-black mt-1 ${ativo ? "text-green-400" : "text-white"}`}>{valor}</p>
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
      className="w-full min-h-[50px] bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl px-4 py-3 text-left font-black transition flex items-center justify-between gap-3"
    >
      <span className="truncate">{children}</span>
      <span className="text-gray-500">›</span>
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
    <ModalBase
      aberto={aberto}
      titulo="Selecionar período"
      descricao={instrucao}
      onClose={onClose}
      largura="max-w-md"
      z="z-[90]"
      acaoCabecalho={
        <div className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-black text-green-400">
          {etapa === "inicio" ? "1 de 2" : "2 de 2"}
        </div>
      }
      rodape={
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={limparPeriodoInterno}
            className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-2xl p-3"
          >
            Limpar
          </button>

          <button
            type="button"
            disabled={!dataInicio}
            onClick={() => {
              if (!dataInicio) return;
              onAplicar({ dataInicio, dataFim: dataFim || dataInicio });
              onClose();
            }}
            className="bg-green-500 hover:bg-green-600 text-black font-black rounded-2xl p-3 disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-3 gap-2">
            {anosDisponiveis().map((anoOpcao) => (
              <button
                key={anoOpcao}
                type="button"
                onClick={() => {
                  setAno(anoOpcao);
                  setEtapaMesAno("mes");
                }}
                className={`rounded-xl border p-3 font-black ${
                  anoOpcao === ano
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                }`}
              >
                {anoOpcao}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-sm text-gray-400 mb-4">Escolha o mês</p>
          <div className="grid grid-cols-3 gap-2">
            {meses.map((mesNome, index) => (
              <button
                key={mesNome}
                type="button"
                onClick={() => {
                  setMes(index);
                  setModoMesAno(false);
                }}
                className={`rounded-xl border p-3 font-black text-sm ${
                  index === mes
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                }`}
              >
                {mesNome.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}
    </ModalBase>
  );
}
