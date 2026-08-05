import { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch, FiTrash2 } from "react-icons/fi";

import ConfirmacaoModal from "../../../shared/components/modals/ConfirmacaoModal";
import ModalBase from "../../../shared/components/modals/ModalBase";
import { formatarDataBR } from "../../../shared/utils/data";
import { formatarMoeda } from "../../../shared/utils/moeda";
import {
  carregarExtratoPlataforma,
  excluirRecebimentoAutomaticoPlataforma,
} from "../services/plataformasFinanceiroService";
import {
  pesquisarMovimentacoesPlataforma,
} from "../utils/plataformasFinanceiro";

const ITENS_POR_PAGINA = 50;

export default function ExtratoPlataformaModal({
  aberto,
  plataforma,
  atualizacaoKey = 0,
  onClose,
  onEditarSaque,
  onAtualizado,
}) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [pesquisa, setPesquisa] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [detalhe, setDetalhe] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    if (!aberto || !plataforma?.id) return;
    setCarregando(true);
    setErro("");

    try {
      setDados(await carregarExtratoPlataforma(plataforma.id));
    } catch (error) {
      console.error("Erro ao carregar extrato da plataforma:", error);
      setErro(error.message || "Não foi possível carregar o extrato da plataforma.");
    } finally {
      setCarregando(false);
    }
  }, [aberto, plataforma]);

  useEffect(() => {
    const timer = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(timer);
  }, [carregar, atualizacaoKey]);

  const movimentacoes = useMemo(() => {
    return pesquisarMovimentacoesPlataforma(dados?.movimentacoes || [], pesquisa);
  }, [dados?.movimentacoes, pesquisa]);

  const totalPaginas = Math.max(1, Math.ceil(movimentacoes.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const movimentacoesPagina = movimentacoes.slice(
    (paginaSegura - 1) * ITENS_POR_PAGINA,
    paginaSegura * ITENS_POR_PAGINA,
  );
  const saldo = Number(dados?.saldo ?? plataforma?.saldo ?? 0);

  function selecionarMovimentacao(movimentacao) {
    if (movimentacao.tipo === "saque") {
      onEditarSaque?.(movimentacao);
      return;
    }

    setDetalhe(movimentacao);
  }

  async function excluirRecebimento() {
    if (!confirmarExclusao?.dadosOriginais?.id) return;
    setExcluindo(true);
    setErro("");

    try {
      await excluirRecebimentoAutomaticoPlataforma(
        confirmarExclusao.dadosOriginais.id,
      );
      setConfirmarExclusao(null);
      setDetalhe(null);
      await carregar();
      await onAtualizado?.();
    } catch (error) {
      console.error("Erro ao excluir recebimento automático:", error);
      setConfirmarExclusao(null);
      setErro(error.message || "Não foi possível excluir o recebimento automático.");
    } finally {
      setExcluindo(false);
    }
  }

  const ultimaLiquidacao = dados?.ultimaLiquidacao;

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={plataforma?.nome || "Plataforma"}
        descricao="Extrato da carteira da plataforma"
        onClose={onClose}
        largura="max-w-4xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ResumoItem titulo="Saldo atual" valor={formatarMoeda(saldo)} destaque />
            <ResumoItem
              titulo="Última liquidação"
              valor={ultimaLiquidacao ? formatarDataBR(ultimaLiquidacao.data) : "Nenhuma"}
              descricao={ultimaLiquidacao
                ? `${formatarDataBR(ultimaLiquidacao.ciclo_operacional_inicio)} a ${formatarDataBR(ultimaLiquidacao.ciclo_operacional_fim)}`
                : null}
            />
            <ResumoItem
              titulo="Próximo recebimento automático"
              valor={dados?.proximoRecebimento
                ? formatarDataBR(dados.proximoRecebimento)
                : "Não configurado"}
            />
          </div>

          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={pesquisa}
              onChange={(event) => {
                setPesquisa(event.target.value);
                setPaginaAtual(1);
              }}
              placeholder="Pesquisar por descrição, tipo, valor ou data..."
              aria-label="Pesquisar no extrato da plataforma"
              className="w-full rounded-xl border border-gray-700 bg-[#0B1120] py-3 pl-11 pr-4 outline-none focus:border-green-400"
            />
          </div>

          {carregando ? (
            <EstadoLista texto="Carregando extrato da plataforma..." />
          ) : erro ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-sm text-red-400">{erro}</p>
              <button
                type="button"
                onClick={carregar}
                className="mt-3 rounded-xl border border-red-500/50 px-3 py-2 text-sm font-bold text-red-300"
              >
                Tentar novamente
              </button>
            </div>
          ) : movimentacoes.length === 0 ? (
            <EstadoLista texto="Nenhuma movimentação encontrada para esta pesquisa." />
          ) : (
            <div className="space-y-3">
              {movimentacoesPagina.map((movimentacao) => (
                <MovimentacaoLinha
                  key={movimentacao.id}
                  movimentacao={movimentacao}
                  onClick={() => selecionarMovimentacao(movimentacao)}
                />
              ))}
              {totalPaginas > 1 ? (
                <Paginacao
                  paginaAtual={paginaSegura}
                  totalPaginas={totalPaginas}
                  onMudar={setPaginaAtual}
                />
              ) : null}
            </div>
          )}
        </div>
      </ModalBase>

      <DetalhesMovimentacaoPlataformaModal
        movimentacao={detalhe}
        plataforma={dados?.plataforma || plataforma}
        contasPorId={dados?.contasPorId || {}}
        onExcluirRecebimento={() => setConfirmarExclusao(detalhe)}
        onClose={() => setDetalhe(null)}
      />

      <ConfirmacaoModal
        aberto={Boolean(confirmarExclusao)}
        tipo="perigo"
        titulo="Excluir recebimento automático?"
        mensagem="O valor voltará imediatamente para a carteira da plataforma. O recebimento não poderá ser editado nem recuperado por esta tela."
        textoConfirmar={excluindo ? "Excluindo..." : "Excluir recebimento"}
        carregando={excluindo}
        onCancelar={() => setConfirmarExclusao(null)}
        onConfirmar={excluirRecebimento}
      />
    </>
  );
}

function ResumoItem({ titulo, valor, descricao = null, destaque = false }) {
  return (
    <div className={`rounded-2xl border bg-[#0B1120] p-4 ${
      destaque ? "border-green-500/40" : "border-gray-800"
    }`}>
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`mt-2 text-lg font-black ${destaque ? "text-green-400" : "text-white"}`}>
        {valor}
      </p>
      {descricao ? <p className="mt-1 text-xs text-gray-500">{descricao}</p> : null}
    </div>
  );
}

function EstadoLista({ texto }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5 text-center">
      <p className="text-sm text-gray-400">{texto}</p>
    </div>
  );
}

function MovimentacaoLinha({ movimentacao, onClick }) {
  const entrada = movimentacao.sinal === "entrada";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-[#0B1120] border border-gray-800 hover:border-gray-700 rounded-2xl px-4 py-3 grid grid-cols-[72px_minmax(0,1fr)_auto] sm:grid-cols-[82px_minmax(0,1fr)_180px] items-center gap-x-3 gap-y-1 text-left transition"
    >
      <p className="text-xs text-gray-500 whitespace-nowrap">
        {formatarDataBR(movimentacao.data)}
      </p>
      <div className="min-w-0 flex items-center gap-2">
        <h3 className="min-w-0 text-sm sm:text-base font-black truncate">
          {movimentacao.titulo}
        </h3>
        {movimentacao.statusTaxa ? (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            movimentacao.statusTaxa === "lancada"
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
          }`}>
            {movimentacao.statusTaxa === "lancada" ? "✓" : "⚠"} {movimentacao.statusTaxaTexto}
          </span>
        ) : null}
      </div>
      <p className="col-start-2 row-start-2 min-w-0 text-xs text-gray-400 truncate">
        {movimentacao.descricao}
      </p>
      <p className={`col-start-3 row-span-2 row-start-1 text-sm sm:text-lg font-black whitespace-nowrap text-right ${
        entrada ? "text-green-400" : "text-red-400"
      }`}>
        {entrada ? "+" : "-"} {formatarMoeda(movimentacao.valor)}
      </p>
    </button>
  );
}

function DetalhesMovimentacaoPlataformaModal({
  movimentacao,
  plataforma,
  contasPorId,
  onExcluirRecebimento,
  onClose,
}) {
  if (!movimentacao) return null;
  const dados = movimentacao.dadosOriginais || {};
  const recebimento = movimentacao.tipo === "recebimento";
  const conciliacao = movimentacao.tipo === "conciliacao";
  const ganho = movimentacao.tipo === "ganho";
  const saque = movimentacao.tipo === "saque";

  return (
    <ModalBase
      aberto={true}
      titulo={movimentacao.titulo}
      descricao={`${plataforma?.nome || "Plataforma"} • ${formatarDataBR(movimentacao.data)}`}
      onClose={onClose}
      largura="max-w-xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ganho ? (
          <>
            <Detalhe titulo="Descrição" valor={movimentacao.descricao} />
            <Detalhe titulo="Valor" valor={formatarMoeda(movimentacao.valor)} />
            <Detalhe titulo="Data" valor={formatarDataBR(movimentacao.data)} />
            <Detalhe titulo="Origem" valor={plataforma?.nome || "Plataforma"} />
          </>
        ) : null}

        {saque ? (
          <>
            <Detalhe titulo="Valor bruto" valor={formatarMoeda(movimentacao.valor)} />
            <Detalhe titulo="Taxa" valor={formatarMoeda(movimentacao.taxa)} />
            <Detalhe titulo="Valor líquido" valor={formatarMoeda(movimentacao.valorLiquido)} />
            <Detalhe titulo="Conta destino" valor={movimentacao.contaDestino || "Conta"} />
            <Detalhe titulo="Data" valor={formatarDataBR(movimentacao.data)} />
          </>
        ) : null}

        {recebimento ? (
          <>
            <Detalhe titulo="Período liquidado" valor={`${formatarDataBR(dados.ciclo_operacional_inicio)} a ${formatarDataBR(dados.ciclo_operacional_fim)}`} />
            <Detalhe titulo="Conta destino" valor={contasPorId[String(dados.conta_destino_id)] || "Conta"} />
            <Detalhe titulo="Valor" valor={formatarMoeda(movimentacao.valor)} />
            <Detalhe titulo="Data" valor={formatarDataBR(movimentacao.data)} />
            <Detalhe titulo="Origem da liquidação" valor={plataforma?.nome || "Plataforma"} />
          </>
        ) : null}

        {conciliacao ? (
          <>
            <Detalhe titulo="Origem" valor={plataforma?.nome || "Plataforma"} />
            <Detalhe titulo="Motivo" valor="Ganho lançado após o pagamento semanal" />
            <Detalhe titulo="Lançamento conciliado" valor={`Entrada #${movimentacao.entradaId || "-"}`} />
            <Detalhe titulo="Data" valor={formatarDataBR(movimentacao.data)} />
          </>
        ) : null}
      </div>

      {recebimento ? (
        <button
          type="button"
          onClick={onExcluirRecebimento}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/50 p-3 font-bold text-red-400 hover:bg-red-500/10"
        >
          <FiTrash2 />
          Excluir recebimento
        </button>
      ) : null}
    </ModalBase>
  );
}

function Detalhe({ titulo, valor }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0B1120] p-4">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="mt-1 font-bold text-white">{valor}</p>
    </div>
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

function Paginacao({ paginaAtual, totalPaginas, onMudar }) {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Paginação do extrato">
      <button
        type="button"
        disabled={paginaAtual === 1}
        onClick={() => onMudar(paginaAtual - 1)}
        className="h-10 min-w-10 rounded-xl border border-gray-700 px-3 font-bold hover:bg-white/5 disabled:opacity-40"
        aria-label="Página anterior"
      >
        &lt;
      </button>
      {paginasVisiveis(paginaAtual, totalPaginas).map((pagina) => (
        <button
          key={pagina}
          type="button"
          onClick={() => onMudar(pagina)}
          aria-current={pagina === paginaAtual ? "page" : undefined}
          className={`h-10 min-w-10 rounded-xl border px-3 font-black ${
            pagina === paginaAtual
              ? "border-green-500 bg-green-500 text-black"
              : "border-gray-700 text-gray-300 hover:bg-white/5"
          }`}
        >
          {pagina}
        </button>
      ))}
      <button
        type="button"
        disabled={paginaAtual === totalPaginas}
        onClick={() => onMudar(paginaAtual + 1)}
        className="h-10 min-w-10 rounded-xl border border-gray-700 px-3 font-bold hover:bg-white/5 disabled:opacity-40"
        aria-label="Próxima página"
      >
        &gt;
      </button>
    </nav>
  );
}
