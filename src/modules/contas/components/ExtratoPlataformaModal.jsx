import { useCallback, useEffect, useMemo, useState } from "react";

import ModalBase from "../../../shared/components/modals/ModalBase";
import { formatarDataBR } from "../../../shared/utils/data";
import { formatarMoeda } from "../../../shared/utils/moeda";
import { carregarExtratoPlataforma } from "../services/plataformasFinanceiroService";
import {
  calcularSaldoExtratoPlataforma,
  filtrarMovimentacoesPlataforma,
} from "../utils/plataformasFinanceiro";

const FILTROS = [
  { valor: "todos", titulo: "Todos" },
  { valor: "ganho", titulo: "Ganhos" },
  { valor: "saque", titulo: "Saques" },
  { valor: "recebimento", titulo: "Recebimentos" },
  { valor: "taxa", titulo: "Taxas" },
  { valor: "conciliacao", titulo: "Conciliações" },
];

export default function ExtratoPlataformaModal({
  aberto,
  plataforma,
  atualizacaoKey = 0,
  onClose,
  onEditarGanho,
  onEditarSaque,
}) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [detalhe, setDetalhe] = useState(null);

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
    return filtrarMovimentacoesPlataforma(dados?.movimentacoes || [], filtro);
  }, [dados?.movimentacoes, filtro]);

  const saldo = useMemo(
    () => calcularSaldoExtratoPlataforma(dados?.movimentacoes || []),
    [dados?.movimentacoes],
  );

  function selecionarMovimentacao(movimentacao) {
    if (movimentacao.tipo === "ganho") {
      onEditarGanho?.(movimentacao);
      return;
    }

    if (["saque", "taxa"].includes(movimentacao.tipo)) {
      onEditarSaque?.(movimentacao);
      return;
    }

    setDetalhe(movimentacao);
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

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTROS.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setFiltro(opcao.valor)}
                aria-pressed={filtro === opcao.valor}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                  filtro === opcao.valor
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 text-gray-300 hover:bg-white/5"
                }`}
              >
                {opcao.titulo}
              </button>
            ))}
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
            <EstadoLista texto="Nenhuma movimentação encontrada para este filtro." />
          ) : (
            <div className="space-y-3">
              {movimentacoes.map((movimentacao) => (
                <MovimentacaoLinha
                  key={movimentacao.id}
                  movimentacao={movimentacao}
                  onClick={() => selecionarMovimentacao(movimentacao)}
                />
              ))}
            </div>
          )}
        </div>
      </ModalBase>

      <DetalhesMovimentacaoPlataformaModal
        movimentacao={detalhe}
        plataforma={dados?.plataforma || plataforma}
        contasPorId={dados?.contasPorId || {}}
        onClose={() => setDetalhe(null)}
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
  onClose,
}) {
  if (!movimentacao) return null;
  const dados = movimentacao.dadosOriginais || {};
  const recebimento = movimentacao.tipo === "recebimento";
  const conciliacao = movimentacao.tipo === "conciliacao";

  return (
    <ModalBase
      aberto={true}
      titulo={movimentacao.titulo}
      descricao={`${plataforma?.nome || "Plataforma"} • ${formatarDataBR(movimentacao.data)}`}
      onClose={onClose}
      largura="max-w-xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <Detalhe titulo="Motivo" valor="Ganho lançado após a liquidação do ciclo" />
            <Detalhe titulo="Lançamento conciliado" valor={`Entrada #${movimentacao.entradaId || "-"}`} />
            <Detalhe titulo="Data" valor={formatarDataBR(movimentacao.data)} />
          </>
        ) : null}
      </div>
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
