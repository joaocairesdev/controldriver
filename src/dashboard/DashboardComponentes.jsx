import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiInfo, FiSettings } from "react-icons/fi";
import { useProgressoAnimado, useRevelarAoEntrar, useArrastarScrollHorizontal } from "./dashboardHooks";
import { corCategoria } from "./dashboardCalculos";

import uberIcon from "../assets/plataformas/uber.png";
import noveNoveIcon from "../assets/plataformas/99.png";
import ifoodIcon from "../assets/plataformas/ifood.svg";
import inDriveIcon from "../assets/plataformas/indrive.svg";
import lalamoveIcon from "../assets/plataformas/lalamove.svg";
import mercadoLivreIcon from "../assets/plataformas/mercadolivre.png";
import rappiIcon from "../assets/plataformas/rappi.png";
import shopeeIcon from "../assets/plataformas/shopee.svg";

export function DashboardHome({ paineis, abrirPainel }) {
  const cores = {
    green: "border-green-500/30 hover:border-green-400 bg-gradient-to-br from-green-500/10 to-[#111827] text-green-400",
    blue: "border-blue-500/30 hover:border-blue-400 bg-gradient-to-br from-blue-500/10 to-[#111827] text-blue-400",
    orange: "border-orange-500/30 hover:border-orange-400 bg-gradient-to-br from-orange-500/10 to-[#111827] text-orange-400",
    purple: "border-purple-500/30 hover:border-purple-400 bg-gradient-to-br from-purple-500/10 to-[#111827] text-purple-400",
  };

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl sm:text-4xl font-black">Dashboard</h2>
        <p className="text-gray-400 mt-2">Escolha uma área para visualizar os indicadores do ControlDriver.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paineis.map(({ id, titulo, descricao, Icone, destaque }) => (
          <button
            key={id}
            type="button"
            onClick={() => abrirPainel(id)}
            className={`group min-h-[190px] rounded-3xl border p-6 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${cores[destaque]}`}
          >
            <div className="w-12 h-12 rounded-2xl border border-current/25 bg-black/10 flex items-center justify-center">
              <Icone className="text-2xl" />
            </div>
            <h3 className="text-2xl font-black text-white mt-5">{titulo}</h3>
            <p className="text-sm sm:text-base leading-relaxed text-gray-400 mt-2 max-w-md">{descricao}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function DashboardPainelHeader({ painel, voltar, children }) {
  const cabecalhoRef = useRef(null);
  const [alturaCabecalho, setAlturaCabecalho] = useState(0);

  useEffect(() => {
    const elemento = cabecalhoRef.current;
    if (!elemento) return undefined;

    function atualizarAltura() {
      setAlturaCabecalho(elemento.getBoundingClientRect().height);
    }

    atualizarAltura();

    const observador = new ResizeObserver(atualizarAltura);
    observador.observe(elemento);
    window.addEventListener("resize", atualizarAltura);

    return () => {
      observador.disconnect();
      window.removeEventListener("resize", atualizarAltura);
    };
  }, [painel?.id, children]);

  if (!painel) return null;
  const Icone = painel.Icone;

  return (
    <div
      className="-mt-4 sm:-mt-4 md:landscape:-mt-8 lg:-mt-8"
      style={{ height: alturaCabecalho }}
    >
      <div
        ref={cabecalhoRef}
        className="fixed top-16 left-0 right-0 z-30 border-b border-gray-800/90 bg-[#0B1120]/95 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl md:landscape:left-72 lg:left-72"
      >
        <div className="px-4 py-3 sm:px-6 md:landscape:px-10 lg:px-10">
          <div className="max-w-[1600px] mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 min-w-0 lg:flex-1">
              <button
                type="button"
                onClick={voltar}
                className="w-10 h-10 rounded-xl border border-gray-700 hover:border-green-400 hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-green-400 transition shrink-0"
                title="Voltar aos painéis"
                aria-label="Voltar aos painéis"
              >
                <FiArrowLeft className="text-lg" />
              </button>

              <div className="min-w-0">
  <h2 className="text-xl sm:text-2xl font-black truncate">
    {painel.titulo}
  </h2>

  <p className="text-xs sm:text-sm text-gray-400 truncate">
    {painel.descricao}
  </p>
</div>
            </div>

            {children ? <div className="lg:shrink-0">{children}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PeriodoControle({ periodo, setPeriodo, textoPeriodo, abrirPeriodo, compacto = false }) {
  return (
    <div className={`${compacto ? "rounded-xl border border-gray-800/80 bg-[#111827]/85 px-3 py-2" : "rounded-2xl border border-gray-800 bg-[#0B1120] px-4 py-3 sm:px-5"} flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
      {!compacto && (
        <p className="text-sm text-gray-400 text-center lg:text-left">Escolha o intervalo para ser usado nos indicadores.</p>
      )}

      <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-gray-800 bg-[#111827] p-1 w-full sm:w-[286px]">
          {[
            ["dia", "Dia"],
            ["semana", "Semana"],
            ["mes", "Mês"],
            ["ano", "Ano"],
          ].map(([valor, label]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setPeriodo(valor)}
              className={`min-w-0 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-black transition ${
                periodo === valor ? "bg-green-500 text-black" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={abrirPeriodo}
          className="w-full sm:w-[190px] bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-gray-200 text-sm font-bold text-center transition truncate"
        >
          {textoPeriodo}
        </button>
      </div>
    </div>
  );
}

export function ResumoFinanceiroCard({ titulo, valor, destaque, formatarMoeda }) {
  const classe = destaque === "green" ? "text-green-400" : destaque === "red" ? "text-red-400" : "text-white";

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <p className="text-sm text-gray-400">{titulo}</p>
      <h3 className={`text-3xl font-black mt-2 ${classe}`}>{formatarMoeda(valor)}</h3>
    </div>
  );
}

export function ResultadoOperacionalCard({ faturamento, custos, resultado, formatarMoeda }) {
  const positivo = Number(resultado || 0) >= 0;

  return (
    <div className="rounded-[28px] border border-gray-800 bg-[#111827] overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="p-5 sm:p-6 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-800">
            <span className="text-sm text-gray-400">Faturamento bruto</span>
            <strong className="text-xl sm:text-2xl text-green-400">{formatarMoeda(faturamento)}</strong>
          </div>
          <div className="flex items-center justify-between gap-4 pt-4">
            <span className="text-sm text-gray-400">Custos de trabalho</span>
            <strong className="text-xl sm:text-2xl text-red-400">{formatarMoeda(custos)}</strong>
          </div>
        </div>

        <div className={`p-5 sm:p-6 flex items-center justify-between sm:justify-end gap-4 ${
          positivo ? "bg-green-500 text-black" : "bg-red-500 text-white"
        }`}>
          <span className={`text-sm font-black sm:hidden ${positivo ? "text-black/70" : "text-white/80"}`}>Resultado operacional</span>
          <div className="sm:text-right">
            <p className={`hidden sm:block text-sm font-black ${positivo ? "text-black/70" : "text-white/80"}`}>Resultado operacional</p>
            <h3 className="text-3xl sm:text-4xl font-black whitespace-nowrap sm:mt-1">{formatarMoeda(resultado)}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustosCategoriaCard({ titulo, dados, baseComparacao, labelBase, rateio, abrirRateio, formatarMoeda }) {
  const categorias = dados?.categorias || [];
  const total = Number(dados?.total || 0);
  const percentualBase = Number(baseComparacao || 0) > 0 ? (total / Number(baseComparacao || 0)) * 100 : 0;

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-bold">{titulo}</h3>
      </div>

      <div className="mt-5 flex flex-col items-center">
        <GraficoAnelCategorias
          categorias={categorias}
          total={total}
          percentualBase={percentualBase}
          labelBase={labelBase}
          formatarMoeda={formatarMoeda}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {categorias.length === 0 ? (
          <p className="text-sm text-gray-500 md:col-span-2">Nenhum custo encontrado neste período.</p>
        ) : (
          categorias.map((categoria) => (
            <CategoriaCustoCard
              key={categoria.nome}
              categoria={categoria}
              rateio={rateio}
              abrirRateio={abrirRateio}
              formatarMoeda={formatarMoeda}
            />
          ))
        )}
      </div>

      {rateio && !rateio?.calculado && (
        <p className="text-xs text-yellow-400 mt-4">
          Sem KM total de abastecimento no período. Categorias rateadas foram consideradas como trabalho até existir abastecimento no período.
        </p>
      )}
    </div>
  );
}

export function CategoriaCustoCard({ categoria, rateio, abrirRateio, formatarMoeda }) {
  const { ref, visivel } = useRevelarAoEntrar(0.72, "0px 0px -8% 0px");

  return (
    <div ref={ref} className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: categoria.cor }} />
          <span className="font-bold truncate" style={{ color: categoria.cor }}>{categoria.nome}</span>
          {categoria.rateado && rateio && (
            <button
              type="button"
              onClick={abrirRateio}
              className="w-7 h-7 rounded-lg border border-gray-700 hover:border-blue-400 hover:text-blue-300 flex items-center justify-center text-gray-400 transition shrink-0"
              title="Entender o rateio desta categoria"
              aria-label={`Entender o rateio de ${categoria.nome}`}
            >
              <FiInfo className="text-xs" />
            </button>
          )}
        </div>
        <span className="font-black whitespace-nowrap">{formatarMoeda(categoria.valor)}</span>
      </div>
      <div className="mt-3 h-2.5 bg-[#111827] rounded-full overflow-hidden border border-gray-800">
        <div
          className={`h-full rounded-full ${visivel ? "dashboard-progress-fill" : "w-0"}`}
          style={{
            width: visivel ? `${Math.min(Number(categoria.percentualDoFaturamento || 0), 100)}%` : "0%",
            backgroundColor: categoria.cor,
          }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {Math.round(categoria.percentualDoCusto)}% dos custos • {Math.round(categoria.percentualDoFaturamento || 0)}% do faturamento
      </p>
    </div>
  );
}


export function InvestimentosObjetivosCard({ formatarMoeda }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <p className="text-sm text-gray-400">Investimentos / Objetivos</p>
      <h3 className="text-2xl font-black mt-1">{formatarMoeda(0)}</h3>
      <p className="text-xs text-gray-500 mt-2">
        Espaço reservado para reservas, objetivos e investimentos quando essa parte for implementada.
      </p>
      <div className="mt-4 h-3 rounded-full bg-[#0B1120] border border-gray-800 overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: "0%" }} />
      </div>
    </div>
  );
}

export function ContasAtrasadasCard({ contas, total, abrirConfiguracao, formatarMoeda, formatarDataBR }) {
  return (
    <div className="relative bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <button
        type="button"
        onClick={abrirConfiguracao}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition"
        title="Configurar contas atrasadas e negativas"
        aria-label="Configurar contas atrasadas e negativas"
      >
        <FiSettings className="text-lg" />
      </button>

      <div className="pr-12">
        <p className="text-sm text-gray-400">Contas atrasadas / negativas</p>
        <h3 className="text-2xl font-black mt-1 text-red-400">{formatarMoeda(total)}</h3>
        <p className="text-xs text-gray-500 mt-1">Faturas vencidas, contas em atraso e contas negativas configuradas.</p>
      </div>

      <div className="mt-4 space-y-3">
        {contas.length === 0 ? (
          <p className="text-sm text-gray-500">Nada para mostrar conforme sua configuração.</p>
        ) : (
          contas.slice(0, 5).map((conta) => (
            <div key={conta.id} className="flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black rounded-full px-2 py-0.5 shrink-0 bg-red-500/10 text-red-300 border border-red-500/30">
                    {conta.tipo}
                  </span>
                  <p className="font-bold truncate">{conta.titulo}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {conta.data ? `${formatarDataBR(conta.data)} • ` : ""}{conta.subtitulo}
                </p>
              </div>
              <p className="font-black text-red-400 whitespace-nowrap">{formatarMoeda(conta.valor)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SaldoGeralCard({ saldoGeral, contas, abrirConfiguracao, formatarMoeda }) {
  return (
    <div className="relative bg-green-500 border border-green-400 rounded-3xl p-6 sm:p-7 text-white overflow-hidden">
      <button
        type="button"
        onClick={abrirConfiguracao}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-black/10 hover:bg-black/20 border border-white/15 flex items-center justify-center text-white/90 transition"
        title="Configurar contas do saldo"
        aria-label="Configurar contas do saldo"
      >
        <FiSettings className="text-lg" />
      </button>

      <div className="pr-12">
        <p className="text-sm font-black uppercase tracking-wide text-white/80">Saldo Atual Geral</p>
        <h2 className="text-4xl sm:text-5xl font-black mt-2">{formatarMoeda(saldoGeral)}</h2>
        <p className="text-sm text-white/80 mt-3">
          {contas.length} conta(s) incluída(s) neste saldo.
        </p>
      </div>

      <div className="mt-5 divide-y divide-white/15">
        {contas.slice(0, 6).map((conta) => (
          <div key={conta.id} className="py-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-white/85">{conta.nome}</span>
            <span className="whitespace-nowrap text-white/90">{formatarMoeda(conta.saldo_atual)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FaturamentoCard({ titulo, valor }) {
  return (
    <div className="h-full min-h-[132px] bg-gradient-to-br from-green-500/15 to-[#111827] border border-green-500/30 rounded-3xl px-6 py-5 sm:px-7 sm:py-6 flex flex-col justify-center">
      <p className="text-base font-black text-green-300">{titulo}</p>
      <h3 className="text-4xl sm:text-5xl font-black mt-3 text-white leading-none">{valor}</h3>
    </div>
  );
}

export function MetaCard({ metaLabel, metaValor, percentual, faltaMeta, formatarMoeda }) {
  const percentualSeguro = Math.max(Number(percentual || 0), 0);

  return (
    <div className="h-full min-h-[132px] bg-gradient-to-br from-blue-500/12 to-[#111827] border border-blue-500/30 rounded-3xl px-6 py-5 sm:px-7 sm:py-6 flex flex-col justify-center">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-bold text-blue-200">{metaLabel}</p>
        <span className="text-xl sm:text-2xl font-black text-green-400">{Math.round(percentualSeguro)}%</span>
      </div>
      <p className="text-3xl sm:text-4xl font-black mt-2 leading-none">{metaValor}</p>
      <div className="mt-3 h-3 rounded-full bg-[#0B1120] overflow-hidden border border-gray-800">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(percentualSeguro, 100)}%` }} />
      </div>
      <p className="text-sm text-gray-400 mt-2">
        {faltaMeta > 0 ? `Falta ${formatarMoeda(faltaMeta)}` : "Meta concluída"}
      </p>
    </div>
  );
}

export function MetricCard({ titulo, valor }) {
  return (
    <div className="h-full min-h-[132px] bg-[#111827] border border-gray-800 rounded-2xl px-4 py-4 flex flex-col justify-center min-w-0 overflow-hidden">
      <p className="text-sm font-semibold text-gray-300 leading-snug">{titulo}</p>
      <h3 className="text-xl sm:text-2xl font-black mt-3 whitespace-nowrap">{valor}</h3>
    </div>
  );
}

export function ProximasContasCard({ contas, dias, abrirConfiguracao, formatarMoeda, formatarDataBR, total }) {

  return (
    <div className="relative bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <button
        type="button"
        onClick={abrirConfiguracao}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition"
        title="Configurar contas a pagar"
        aria-label="Configurar contas a pagar"
      >
        <FiSettings className="text-lg" />
      </button>

      <div className="pr-12">
        <p className="text-sm text-gray-400">Próximas contas a pagar</p>
        <h3 className="text-2xl font-black mt-1">{formatarMoeda(total)}</h3>
        <p className="text-xs text-gray-500 mt-1">Vencimentos dos próximos {dias} dias.</p>
      </div>

      <div className="mt-4 space-y-3">
        {contas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma conta próxima encontrada.</p>
        ) : (
          contas.map((conta) => (
            <div key={conta.id} className="flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-black rounded-full px-2 py-0.5 shrink-0 ${
                    conta.tipo === "Fatura"
                      ? "bg-purple-500/10 text-purple-300 border border-purple-500/30"
                      : "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                  }`}>
                    {conta.tipo}
                  </span>
                  <p className="font-bold truncate">{conta.titulo}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatarDataBR(conta.data)} • {conta.subtitulo}
                </p>
              </div>
              <p className="font-black text-red-400 whitespace-nowrap">{formatarMoeda(conta.valor)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


export function PlataformasCard({ plataformas, total, formatarMoeda }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <h3 className="text-xl font-bold">Ganhos por plataforma</h3>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-1 scrollbar-hide xl:grid xl:grid-cols-4 xl:overflow-visible">
        {plataformas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma plataforma no período selecionado.</p>
        ) : (
          plataformas.map((item) => {
            const percentual = total > 0 ? (item.valor / total) * 100 : 0;
            const icone = iconePlataforma(item.nome);

            return (
              <div key={item.nome} className="min-w-[180px] rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
                <div className="flex items-center gap-3">
                  {icone ? (
                    <img src={icone} alt={item.nome} className="w-10 h-10 object-contain rounded-lg shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#111827] border border-gray-800 flex items-center justify-center text-xs font-black shrink-0">
                      {String(item.nome || "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold truncate">{item.nome}</p>
                    <p className="text-xs text-gray-500">{item.corridas} corrida(s)</p>
                  </div>
                </div>
                <p className="text-xl font-black mt-4">{formatarMoeda(item.valor)}</p>
                <p className="text-xs text-gray-500 mt-1">{Math.round(percentual)}% do faturamento</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function GraficoAnelCategorias({ categorias, total = 0, percentualBase = 0, labelBase = "", formatarMoeda }) {
  const lista = (categorias || []).filter((categoria) => Number(categoria.valor || 0) > 0);
  const totalCategorias = lista.reduce((soma, categoria) => soma + Number(categoria.valor || 0), 0);
  const percentualTotal = Math.max(Number(percentualBase || 0), 0);
  const voltas = Math.max(Math.ceil(percentualTotal / 100), 1);
  const chaveAnimacao = JSON.stringify({
    percentualTotal: Number(percentualTotal.toFixed(4)),
    total: Number(Number(total || 0).toFixed(2)),
    categorias: lista.map((categoria) => [categoria.nome, Number(Number(categoria.valor || 0).toFixed(2))]),
  });
  const { ref, visivel } = useRevelarAoEntrar(0.78, "0px 0px -6% 0px");
  const progressoAnel = useProgressoAnimado(visivel ? percentualTotal : 0, 2600, chaveAnimacao);
  const proporcaoAnimada = percentualTotal > 0 ? progressoAnel / percentualTotal : visivel ? 1 : 0;
  const totalAnimado = Number(total || 0) * Math.min(Math.max(proporcaoAnimada, 0), 1);

  let acumuladoGlobal = 0;
  const fragmentos = [];

  lista.forEach((categoria, indiceCategoria) => {
    const participacao = totalCategorias > 0 ? Number(categoria.valor || 0) / totalCategorias : 0;
    let restante = participacao * percentualTotal;

    while (restante > 0.0001) {
      const volta = Math.floor(acumuladoGlobal / 100);
      const inicioNaVolta = acumuladoGlobal % 100;
      const espacoNaVolta = 100 - inicioNaVolta;
      const tamanho = Math.min(restante, espacoNaVolta);

      fragmentos.push({
        ...categoria,
        indiceCategoria,
        volta,
        inicioGlobal: acumuladoGlobal,
        inicioNaVolta,
        tamanho,
      });

      acumuladoGlobal += tamanho;
      restante -= tamanho;
    }
  });

  const raioBase = 124;
  const espacamentoVolta = voltas > 1 ? 15 : 0;
  const largura = voltas > 1 ? 11 : 14;

  return (
    <div ref={ref} className="relative w-80 h-80 sm:w-[340px] sm:h-[340px] flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 300 300" aria-hidden="true">
        {Array.from({ length: voltas }, (_, volta) => {
          const raio = Math.max(raioBase - volta * espacamentoVolta, 52);
          return (
            <circle
              key={`trilho-${volta}`}
              cx="150"
              cy="150"
              r={raio}
              pathLength="100"
              fill="none"
              stroke="rgba(55,65,81,0.65)"
              strokeWidth={largura}
            />
          );
        })}

        {fragmentos.map((fragmento, indice) => {
          const tamanhoVisivel = Math.min(
            Math.max(progressoAnel - fragmento.inicioGlobal, 0),
            fragmento.tamanho
          );
          const raio = Math.max(raioBase - fragmento.volta * espacamentoVolta, 52);

          return (
            <circle
              key={`${fragmento.nome}-${fragmento.volta}-${indice}`}
              cx="150"
              cy="150"
              r={raio}
              pathLength="100"
              fill="none"
              stroke={fragmento.cor}
              strokeWidth={largura}
              strokeLinecap="butt"
              strokeDasharray={`${tamanhoVisivel} ${100 - tamanhoVisivel}`}
              strokeDashoffset={-fragmento.inicioNaVolta}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
        <span className="text-3xl sm:text-4xl font-black text-white leading-none">
          {formatarMoeda ? formatarMoeda(totalAnimado) : totalAnimado.toFixed(2)}
        </span>
        <span className="text-base text-gray-400 mt-3">{Math.round(progressoAnel)}% {labelBase}</span>
      </div>
    </div>
  );
}


export function GraficoHistoricoFaturamento({ dados, periodo, periodoLabel, formatarMoeda }) {
  const valores = (dados || []).map((item) => Number(item.valor || 0));
  const maximo = Math.max(...valores, 1);
  const { ref: revelarRef, visivel } = useRevelarAoEntrar(0.55, "0px 0px -6% 0px");
  const arrastar = useArrastarScrollHorizontal();
  const larguraMinima = periodo === "mes"
    ? "min-w-[1180px]"
    : periodo === "ano"
      ? "min-w-[880px]"
      : "min-w-[720px]";

  return (
    <div ref={revelarRef} className="rounded-3xl border border-gray-800 bg-[#111827] p-4 sm:p-5 overflow-hidden">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-xl border border-gray-700 bg-[#0B1120] px-3 py-2 text-sm font-bold text-gray-200">
          {periodoLabel}
        </div>
      </div>

      <div
        ref={arrastar.ref}
        {...arrastar.props}
        className="overflow-x-auto scrollbar-hide cursor-grab touch-pan-x"
      >
        <div className={`h-[270px] flex items-end gap-3 sm:gap-4 ${larguraMinima}`}>
          {(dados || []).map((item, indice) => {
            const valor = Number(item.valor || 0);
            const alturaPercentual = valor > 0 ? Math.max((valor / maximo) * 100, 7) : 2.5;

            return (
              <div key={`${item.label}-${indice}`} className="flex-1 min-w-[58px] h-full flex flex-col items-center justify-end">
                <span className="text-[11px] sm:text-xs font-medium text-gray-300 mb-2 whitespace-nowrap">
                  {formatarMoeda(valor)}
                </span>

                <div className="w-full max-w-[54px] h-[195px] flex items-end justify-center">
                  <div
                    className={`w-full rounded-t-lg border-x border-t border-green-400/15 shadow-[0_0_18px_rgba(34,197,94,0.10)] ${visivel ? "dashboard-bar-reveal" : "dashboard-bar-hidden"}`}
                    style={{
                      height: `${alturaPercentual}%`,
                      animationDelay: `${indice * 55}ms`,
                      opacity: valor > 0 ? 1 : 0.34,
                      background: "linear-gradient(to top, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.48) 55%, rgba(74,222,128,0.96) 100%)",
                    }}
                    title={`${item.label}: ${formatarMoeda(valor)}`}
                  />
                </div>

                <span className="text-xs sm:text-sm font-bold text-gray-400 mt-3">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DashboardAnimations() {
  return (
    <style>{`
      @keyframes dashboardProgressReveal { from { width: 0; } }
      @keyframes dashboardBarReveal { from { transform: scaleY(0); opacity: .15; } to { transform: scaleY(1); opacity: 1; } }
      .dashboard-progress-fill { animation: dashboardProgressReveal .9s cubic-bezier(.2,.8,.2,1) both; }
      .dashboard-bar-hidden { transform: scaleY(0); transform-origin: bottom; }
      .dashboard-bar-reveal { transform-origin: bottom; animation: dashboardBarReveal .95s cubic-bezier(.2,.8,.2,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .dashboard-progress-fill, .dashboard-bar-reveal { animation: none !important; transform: none !important; opacity: 1 !important; }
      }
    `}</style>
  );
}

export function iconePlataforma(nome) {
  const chave = normalizarNomePlataforma(nome);

  const icones = {
    uber: uberIcon,
    "99": noveNoveIcon,
    ifood: ifoodIcon,
    indrive: inDriveIcon,
    lalamove: lalamoveIcon,
    mercadolivre: mercadoLivreIcon,
    rappi: rappiIcon,
    shopee: shopeeIcon,
  };

  return icones[chave] || null;
}

export function normalizarNomePlataforma(nome) {
  return String(nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}


