import { useEffect, useRef, useState } from "react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import CronometroJornada from "./components/CronometroJornada";
import MobileBottomNav from "./components/MobileBottomNav";

import Dashboard from "./pages/Dashboard";
import NovaEntrada from "./pages/NovaEntrada";
import NovoLancamento from "./pages/NovoLancamento";
import Contas from "./pages/Contas";
import Cartoes from "./pages/Cartoes";
import Veiculos from "./pages/Veiculos";
import NovaSaida from "./pages/NovaSaida";
import Extrato from "./pages/Extrato";
import ContasPagar from "./pages/ContasPagar";
import Metas from "./pages/Metas";
import Categorias from "./pages/Categorias";

export default function App() {
  const [pagina, setPagina] = useState("dashboard");
  const [menuAberto, setMenuAberto] = useState(false);
  const [jornadaParaGanhos, setJornadaParaGanhos] = useState(null);
  const [cronometroEstado, setCronometroEstado] = useState({
    status: "sem_jornada",
    tempoFormatado: "00:00:00",
    contagemRegressiva: null,
  });

  const toqueInicialX = useRef(null);
  const toqueInicialY = useRef(null);

  useEffect(() => {
    function aoIniciarToque(evento) {
      const toque = evento.touches?.[0];
      if (!toque) return;

      toqueInicialX.current = toque.clientX;
      toqueInicialY.current = toque.clientY;
    }

    function aoFinalizarToque(evento) {
      const toque = evento.changedTouches?.[0];
      if (!toque) return;

      const inicioX = toqueInicialX.current;
      const inicioY = toqueInicialY.current;

      if (inicioX === null || inicioY === null) return;

      const deltaX = toque.clientX - inicioX;
      const deltaY = toque.clientY - inicioY;
      const movimentoHorizontal =
        Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4;

      if (!movimentoHorizontal) return;

      if (!menuAberto && inicioX <= 28 && deltaX > 0) {
        setMenuAberto(true);
      }

      if (menuAberto && deltaX < 0) {
        setMenuAberto(false);
      }

      toqueInicialX.current = null;
      toqueInicialY.current = null;
    }

    window.addEventListener("touchstart", aoIniciarToque, { passive: true });
    window.addEventListener("touchend", aoFinalizarToque, { passive: true });

    return () => {
      window.removeEventListener("touchstart", aoIniciarToque);
      window.removeEventListener("touchend", aoFinalizarToque);
    };
  }, [menuAberto]);

  useEffect(() => {
    function bloquearPullToRefresh(evento) {
      const alvo = evento.target;
      const areaRolavel = alvo?.closest?.("[data-scroll-container='true']");
      const scrollTop = areaRolavel
        ? areaRolavel.scrollTop
        : document.documentElement.scrollTop;

      if (scrollTop <= 0 && evento.touches?.length === 1) {
        const toque = evento.touches[0];
        const inicioY = toqueInicialY.current;

        if (inicioY !== null && toque.clientY > inicioY) {
          evento.preventDefault();
        }
      }
    }

    document.body.style.overscrollBehaviorY = "none";
    document.documentElement.style.overscrollBehaviorY = "none";

    window.addEventListener("touchmove", bloquearPullToRefresh, { passive: false });

    return () => {
      window.removeEventListener("touchmove", bloquearPullToRefresh);
      document.body.style.overscrollBehaviorY = "";
      document.documentElement.style.overscrollBehaviorY = "";
    };
  }, []);

  function navegarPara(novaPagina) {
    console.log("Mudando para:", novaPagina);
    setPagina(novaPagina);
    setMenuAberto(false);
  }

  function abrirCronometroJornada() {
    window.dispatchEvent(new CustomEvent("abrir-cronometro-jornada"));
  }

  const cronometroVisivel =
    cronometroEstado.status === "em_andamento" ||
    cronometroEstado.status === "pausada" ||
    cronometroEstado.status === "aguardando_km" ||
    cronometroEstado.contagemRegressiva !== null;

  return (
    <div className="h-dvh bg-[#0B1120] text-white flex overflow-hidden overscroll-none">
      <div className="hidden lg:block h-dvh shrink-0">
        <Sidebar setPagina={navegarPara} paginaAtual={pagina} />
      </div>

      {menuAberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMenuAberto(false)}
          />

          <div
            className="relative w-72 max-w-[85vw] h-full"
            onTouchStart={(evento) => {
              const toque = evento.touches?.[0];
              if (!toque) return;
              toqueInicialX.current = toque.clientX;
              toqueInicialY.current = toque.clientY;
            }}
            onTouchEnd={(evento) => {
              const toque = evento.changedTouches?.[0];

              if (
                !toque ||
                toqueInicialX.current === null ||
                toqueInicialY.current === null
              ) {
                return;
              }

              const deltaX = toque.clientX - toqueInicialX.current;
              const deltaY = toque.clientY - toqueInicialY.current;

              if (deltaX < -60 && Math.abs(deltaX) > Math.abs(deltaY)) {
                setMenuAberto(false);
              }
            }}
          >
            <Sidebar setPagina={navegarPara} paginaAtual={pagina} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden overscroll-none">
        <Topbar
          menuAberto={menuAberto}
          abrirMenu={() => setMenuAberto(true)}
          abrirInicio={() => navegarPara("dashboard")}
          abrirCronometro={abrirCronometroJornada}
          abrirConfiguracoes={() => navegarPara("configuracoes-categorias")}
          cronometroStatus={cronometroEstado.status}
          cronometroTempo={cronometroEstado.tempoFormatado}
          cronometroContagem={cronometroEstado.contagemRegressiva}
        />

        <main data-scroll-container="true" className="flex-1 min-w-0 overflow-y-auto scrollbar-hide overscroll-contain pt-20 p-4 pb-28 sm:p-6 sm:pt-20 sm:pb-10 lg:p-10 lg:pt-24">
          {pagina === "dashboard" && <Dashboard />}

          {pagina === "novo-lancamento" && (
            <NovoLancamento
              abrirEntrada={() => navegarPara("nova-entrada")}
              abrirVendaProdutos={() => navegarPara("venda-produtos")}
              abrirTransferencia={() => navegarPara("transferencia")}
              abrirAbastecimento={() => navegarPara("novo-abastecimento")}
              abrirManutencao={() => navegarPara("nova-manutencao")}
              abrirAlimentacao={() => navegarPara("nova-alimentacao")}
              abrirUsoTag={() => navegarPara("novo-uso-tag")}
              abrirImpostos={() => navegarPara("novo-impostos")}
              abrirOutros={() => navegarPara("nova-outra-saida")}
              jornadaParaGanhos={jornadaParaGanhos}
              limparJornadaParaGanhos={() => setJornadaParaGanhos(null)}
            />
          )}

          {pagina === "nova-entrada" && <NovaEntrada setPagina={navegarPara} />}

          {pagina === "venda-produtos" && (
            <TelaEmConstrucao
              titulo="Venda de Produtos"
              descricao="Aqui vamos controlar vendas dentro do carro, lucro e futuramente estoque."
              voltar={() => navegarPara("novo-lancamento")}
            />
          )}

          {pagina === "transferencia" && (
            <TelaEmConstrucao
              titulo="Transferência"
              descricao="Aqui vamos movimentar valores entre contas, carteira e outros recebimentos."
              voltar={() => navegarPara("novo-lancamento")}
            />
          )}

          {pagina === "contas" && <Contas />}

          {pagina === "contas-pagar" && <ContasPagar />}

          {pagina === "metas" && <Metas />}

          {pagina === "cartoes" && <Cartoes />}

          {pagina === "veiculos" && <Veiculos />}

          {pagina === "extrato" && <Extrato />}

          {pagina === "configuracoes-categorias" && <Categorias />}

          {pagina === "nova-saida" && <NovaSaida setPagina={navegarPara} />}

          {pagina === "novo-abastecimento" && (
            <NovaSaida categoriaInicial="Abastecimento" setPagina={navegarPara} />
          )}

          {pagina === "nova-manutencao" && (
            <NovaSaida categoriaInicial="Manutenção" setPagina={navegarPara} />
          )}

          {pagina === "nova-alimentacao" && (
            <NovaSaida categoriaInicial="Alimentação" setPagina={navegarPara} />
          )}

          {pagina === "novo-uso-tag" && (
            <NovaSaida categoriaInicial="Pedágio" setPagina={navegarPara} />
          )}

          {pagina === "novo-impostos" && (
            <NovaSaida categoriaInicial="Impostos" setPagina={navegarPara} />
          )}

          {pagina === "nova-outra-saida" && (
            <NovaSaida categoriaInicial="Outros" setPagina={navegarPara} />
          )}
        </main>

        <CronometroJornada
          onEstadoChange={setCronometroEstado}
          onLancarGanhos={(jornadaResumo) => {
            setJornadaParaGanhos(jornadaResumo);
            navegarPara("novo-lancamento");
          }}
        />

        {cronometroVisivel && (
          <button
            type="button"
            onClick={abrirCronometroJornada}
            className="lg:hidden fixed left-4 right-4 bottom-24 z-40 rounded-2xl border border-green-500/40 bg-[#111827]/95 backdrop-blur px-4 py-3 shadow-2xl shadow-black/40 flex items-center justify-between gap-3"
            title="Abrir cronômetro"
            aria-label="Abrir cronômetro"
          >
            <div className="min-w-0 text-left">
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wide">
                Jornada
              </p>
              <p className="text-sm font-black text-white truncate">
                {cronometroEstado.status === "pausada"
                  ? "Pausada"
                  : cronometroEstado.status === "aguardando_km"
                  ? "Aguardando KM"
                  : cronometroEstado.contagemRegressiva !== null
                  ? "Iniciando"
                  : "Em andamento"}
              </p>
            </div>

            <span className="rounded-xl bg-green-500/10 border border-green-500/40 px-3 py-2 text-green-400 font-black tabular-nums text-sm">
              {cronometroEstado.contagemRegressiva !== null
                ? `00:00:0${cronometroEstado.contagemRegressiva}`
                : cronometroEstado.tempoFormatado}
            </span>
          </button>
        )}

        <MobileBottomNav
          paginaAtual={pagina}
          setPagina={navegarPara}
        />
      </div>
    </div>
  );
}

function TelaEmConstrucao({ titulo, descricao, voltar }) {
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
          <h1 className="text-3xl font-bold">{titulo}</h1>
          <p className="text-gray-400 mt-1">{descricao}</p>
        </div>
      </div>

      <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-8">
        <h2 className="text-xl font-bold text-green-400">Em construção</h2>
        <p className="text-gray-400 mt-2">
          A rota já está pronta. Agora podemos criar essa tela com calma sem quebrar o fluxo.
        </p>
      </div>
    </div>
  );
}
