import { FiInfo, FiSettings } from "react-icons/fi";
import { useProgressoAnimado, useRevelarAoEntrar, useArrastarScrollHorizontal } from "../hooks/dashboardHooks";
import { iconePlataforma } from "../utils/dashboardPlataformas";

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
          className="w-full sm:w-[190px] bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-gray-200 text-sm font-bold text-center leading-tight whitespace-pre-line transition"
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

export function CustosCategoriaCard({
  titulo,
  dados,
  baseComparacao,
  labelBase,
  rateio,
  abrirRateio,
  formatarMoeda,
  indicadores = [],
  tema = "trabalho",
}) {
  const categorias = dados?.categorias || [];
  const total = Number(dados?.total || 0);
  const percentualBase = Number(baseComparacao || 0) > 0 ? (total / Number(baseComparacao || 0)) * 100 : 0;
  const temaPessoal = tema === "pessoal";

  return (
    <div className={`h-auto xl:h-full bg-[#111827] border rounded-3xl p-5 ${temaPessoal ? "border-purple-500/35" : "border-green-500/35"}`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={`text-xl font-black ${temaPessoal ? "text-purple-300" : "text-green-300"}`}>{titulo}</h3>
      </div>

      {indicadores.length > 0 && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3 gap-2">
          {indicadores.map((indicador) => (
            <div key={indicador.titulo} className="rounded-2xl border border-gray-800 bg-[#0B1120] p-3 min-w-0">
              <p className="text-xs text-gray-400">{indicador.titulo}</p>
              <p className={`text-lg font-black mt-1 truncate ${indicador.destaque || "text-white"}`}>
                {formatarMoeda(indicador.valor)}
              </p>
            </div>
          ))}
        </div>
      )}

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

export function ContasAtrasadasCard({ contas, total, abrirPagina, formatarMoeda, formatarDataBR }) {
  return (
    <div
      className="relative bg-[#111827] border border-gray-800 hover:border-red-500/45 rounded-3xl p-5 cursor-pointer transition"
      onClick={abrirPagina}
      onKeyDown={(evento) => {
        if (evento.target === evento.currentTarget && (evento.key === "Enter" || evento.key === " ")) {
          evento.preventDefault();
          abrirPagina?.();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div>
        <p className="text-sm text-gray-400">Contas vencidas</p>
        <h3 className="text-2xl font-black mt-1 text-red-400">{formatarMoeda(total)}</h3>
        <p className="text-xs text-gray-500 mt-1">Todas as faturas e contas vencidas, da mais antiga para a mais recente.</p>
      </div>

      <div className="mt-4 space-y-3">
        {contas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma conta vencida encontrada.</p>
        ) : (
          contas.map((conta) => (
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

export function SaldoGeralCard({
  saldoGeral,
  contas,
  plataformas = [],
  quantidadePlataformasSaldo = plataformas.length,
  abrirConfiguracao,
  abrirPagina,
  formatarMoeda,
}) {
  return (
    <div
      className="relative bg-green-500 border border-green-400 hover:border-white rounded-3xl p-6 sm:p-7 text-white overflow-hidden cursor-pointer transition"
      onClick={abrirPagina}
      onKeyDown={(evento) => {
        if (evento.target === evento.currentTarget && (evento.key === "Enter" || evento.key === " ")) {
          evento.preventDefault();
          abrirPagina?.();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <button
        type="button"
        onClick={(evento) => {
          evento.stopPropagation();
          abrirConfiguracao();
        }}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-black/10 hover:bg-black/20 border border-white/15 flex items-center justify-center text-white/90 transition"
        title="Configurar contas do saldo"
        aria-label="Configurar contas do saldo"
      >
        <FiSettings className="text-lg" />
      </button>

      <div className="pr-12">
        <p className="text-sm font-black uppercase tracking-wide text-white/80">Saldo Consolidado</p>
        <h2 className="text-4xl sm:text-5xl font-black mt-2">{formatarMoeda(saldoGeral)}</h2>
        <p className="text-sm text-white/80 mt-3">
          {contas.length} conta(s) e {quantidadePlataformasSaldo} plataforma(s) incluída(s) neste saldo.
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

      {plataformas.length > 0 && (
        <div className="mt-5 border-t border-white/20 pt-4">
          <p className="text-xs font-black uppercase tracking-wide text-white/70">Saldos nas plataformas</p>
          <div className="mt-2 divide-y divide-white/15">
            {plataformas.map((plataforma) => (
              <div key={plataforma.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-white/85">{plataforma.nome}</span>
                <span className="whitespace-nowrap text-white/90">{formatarMoeda(plataforma.saldo)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IndicadorBadge({ tipo }) {
  const classe = tipo === "Média"
    ? "bg-purple-500/20 text-purple-300"
    : "bg-blue-500/20 text-blue-300";

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ${classe}`}>
      {tipo}
    </span>
  );
}

export function FaturamentoCard({ titulo, valor }) {
  return (
    <div className="h-full min-h-[132px] bg-gradient-to-br from-green-500/15 to-[#111827] border border-green-500/30 rounded-3xl px-6 py-5 sm:px-7 sm:py-6 flex flex-col justify-center min-w-0">
      <p className="text-base font-black text-green-300 break-words">{titulo}</p>
      <h3 className="text-4xl sm:text-5xl font-black mt-3 text-white leading-none break-words [overflow-wrap:anywhere]">{valor}</h3>
    </div>
  );
}

export function MetaCard({ metaLabel, metaValor, percentual, faltaMeta, formatarMoeda }) {
  const percentualSeguro = Math.max(Number(percentual || 0), 0);

  return (
    <div className="h-full min-h-[132px] bg-gradient-to-br from-blue-500/12 to-[#111827] border border-blue-500/30 rounded-3xl px-6 py-5 sm:px-7 sm:py-6 flex flex-col justify-center min-w-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-bold text-blue-200 break-words">{metaLabel}</p>
        <span className="text-xl sm:text-2xl font-black text-green-400">{Math.round(percentualSeguro)}%</span>
      </div>
      <p className="text-3xl sm:text-4xl font-black mt-2 leading-none break-words [overflow-wrap:anywhere]">{metaValor}</p>
      <div className="mt-3 h-3 rounded-full bg-[#0B1120] overflow-hidden border border-gray-800">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(percentualSeguro, 100)}%` }} />
      </div>
      <p className="text-sm text-gray-400 mt-2">
        {faltaMeta > 0 ? `Falta ${formatarMoeda(faltaMeta)}` : "Meta concluída"}
      </p>
    </div>
  );
}

export function MetricCard({ titulo, valor, badge }) {
  return (
    <div className="h-full min-h-[132px] bg-[#111827] border border-gray-800 rounded-2xl px-4 py-4 flex flex-col items-start min-w-0">
      <IndicadorBadge tipo={badge} />
      <p className="text-sm font-semibold text-gray-300 leading-snug mt-2 break-words">{titulo}</p>
      <h3 className="text-xl sm:text-2xl font-black leading-tight mt-2 break-words [overflow-wrap:anywhere]">{valor}</h3>
    </div>
  );
}

export function ProximasContasCard({ contas, abrirPagina, formatarMoeda, formatarDataBR, total }) {

  return (
    <div
      className="relative bg-[#111827] border border-gray-800 hover:border-blue-500/45 rounded-3xl p-5 cursor-pointer transition"
      onClick={abrirPagina}
      onKeyDown={(evento) => {
        if (evento.target === evento.currentTarget && (evento.key === "Enter" || evento.key === " ")) {
          evento.preventDefault();
          abrirPagina?.();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div>
        <p className="text-sm text-gray-400">Próximas contas a vencer</p>
        <h3 className="text-2xl font-black mt-1">{formatarMoeda(total)}</h3>
        <p className="text-xs text-gray-500 mt-1">Todos os vencimentos dos próximos 30 dias.</p>
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

  const quantidadeVoltasVisiveis = Math.ceil(progressoAnel / 100);
  const camadasAnel = Array.from({ length: quantidadeVoltasVisiveis }, (_, indice) => quantidadeVoltasVisiveis - indice - 1)
    .map((volta) => {
      const fragmentosDaVolta = fragmentos.filter((fragmento) => fragmento.volta === volta);
      const paradas = ["transparent 0%"];
      let fimAnterior = 0;

      fragmentosDaVolta.forEach((fragmento) => {
        const tamanhoVisivel = Math.min(
          Math.max(progressoAnel - fragmento.inicioGlobal, 0),
          fragmento.tamanho
        );

        if (tamanhoVisivel <= 0) return;

        const inicio = fragmento.inicioNaVolta;
        const fim = Math.min(inicio + tamanhoVisivel, 100);
        const escurecimento = Number((100 * (1 - Math.pow(0.91, volta))).toFixed(2));
        const cor = volta > 0
          ? `color-mix(in srgb, ${fragmento.cor}, black ${escurecimento}%)`
          : fragmento.cor;

        if (inicio > fimAnterior) {
          paradas.push(`transparent ${fimAnterior}%`, `transparent ${inicio}%`);
        }

        paradas.push(`${cor} ${inicio}%`, `${cor} ${fim}%`);
        fimAnterior = fim;
      });

      paradas.push(`transparent ${fimAnterior}%`, "transparent 100%");
      return `conic-gradient(${paradas.join(", ")})`;
    });

  const fundoAnel = [
    ...camadasAnel,
    "conic-gradient(rgba(55,65,81,0.65) 0% 100%)",
  ].join(", ");

  return (
    <div ref={ref} className="relative w-full max-w-80 aspect-square sm:w-[340px] sm:max-w-[340px] flex items-center justify-center">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: fundoAnel,
          WebkitMaskImage: "radial-gradient(circle closest-side, transparent 0 78%, #000 78.5% 87%, transparent 87.5%)",
          maskImage: "radial-gradient(circle closest-side, transparent 0 78%, #000 78.5% 87%, transparent 87.5%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
        <span className="text-3xl sm:text-4xl font-black text-white leading-none">
          {formatarMoeda ? formatarMoeda(totalAnimado) : totalAnimado.toFixed(2)}
        </span>
        <span className="text-base text-gray-400 mt-3">{Math.round(progressoAnel)}% {labelBase}</span>
      </div>
    </div>
  );
}


export function GraficoHistoricoFaturamento({ dados, periodo, periodoLabel, formatarMoeda, selecionadoIndex, onSelecionar }) {
  const valores = (dados || []).map((item) => Number(item.valor || 0));
  const maximo = Math.max(...valores, 1);
  const { ref: revelarRef, visivel } = useRevelarAoEntrar(0.55, "0px 0px -6% 0px");
  const { ref: arrastarRef, props: arrastarProps } = useArrastarScrollHorizontal();
  const larguraMinima = periodo === "mes"
    ? "min-w-[1180px]"
    : periodo === "ano"
      ? "min-w-[880px]"
      : "min-w-[720px]";
  const temSelecao = selecionadoIndex !== null && selecionadoIndex !== undefined;

  return (
    <div ref={revelarRef} className="rounded-3xl border border-gray-800 bg-[#111827] p-4 sm:p-5 overflow-hidden">
      <div className="mb-4">
        <div className="inline-flex items-center rounded-xl border border-gray-700 bg-[#0B1120] px-3 py-2 text-sm font-bold text-gray-200">
          {periodoLabel}
        </div>
      </div>

      <div
        ref={arrastarRef}
        {...arrastarProps}
        className="overflow-x-auto scrollbar-hide cursor-grab touch-pan-y"
        style={{ touchAction: "pan-y pinch-zoom" }}
      >
        <div className={`h-[270px] flex items-end gap-3 sm:gap-4 ${larguraMinima}`}>
          {(dados || []).map((item, indice) => {
            const valor = Number(item.valor || 0);
            const alturaPercentual = valor > 0 ? Math.max((valor / maximo) * 100, 7) : 2.5;
            const selecionado = selecionadoIndex === indice;
            const itemAtenuado = temSelecao && !selecionado;

            return (
              <button
                key={`${item.label}-${indice}`}
                type="button"
                onClick={() => onSelecionar?.(item, indice)}
                aria-pressed={selecionadoIndex === indice}
                aria-label={`Filtrar indicadores por ${item.label}`}
                className={`flex-1 min-w-[58px] h-full flex flex-col items-center justify-end transition-opacity ${itemAtenuado ? "opacity-55" : "opacity-100"}`}
              >
                <span className={`text-[11px] sm:text-xs font-medium mb-2 whitespace-nowrap ${selecionado ? "text-white" : itemAtenuado ? "text-gray-500" : "text-gray-300"}`}>
                  {formatarMoeda(valor)}
                </span>

                <div className="w-full max-w-[54px] h-[195px] flex items-end justify-center">
                  <div
                    className={`w-full rounded-t-lg border-x border-t ${itemAtenuado ? "border-gray-500/15 shadow-none" : "border-green-400/15 shadow-[0_0_18px_rgba(34,197,94,0.10)]"} ${visivel ? "dashboard-bar-reveal" : "dashboard-bar-hidden"}`}
                    style={{
                      height: `${alturaPercentual}%`,
                      animationDelay: `${indice * 55}ms`,
                      opacity: valor > 0 ? 1 : 0.34,
                      background: itemAtenuado
                        ? "linear-gradient(to top, rgba(75,85,99,0.10) 0%, rgba(107,114,128,0.38) 55%, rgba(156,163,175,0.72) 100%)"
                        : "linear-gradient(to top, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.48) 55%, rgba(74,222,128,0.96) 100%)",
                    }}
                    title={`${item.label}: ${formatarMoeda(valor)}`}
                  />
                </div>

                <span className={`text-xs sm:text-sm font-bold mt-3 ${selecionado ? "text-white" : itemAtenuado ? "text-gray-500" : "text-gray-400"}`}>{item.label}</span>
              </button>
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
