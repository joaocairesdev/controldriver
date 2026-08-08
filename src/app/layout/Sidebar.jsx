import { useState } from "react";
import {
  FiPlusCircle,
  FiHome,
  FiFileText,
  FiTarget,
  FiCreditCard,
  FiBriefcase,
  FiTruck,
  FiAlertTriangle,
  FiSettings,
  FiRefreshCw,
  FiDollarSign,
  FiChevronDown,
} from "react-icons/fi";

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.0.0";
const APP_BUILD = import.meta.env.VITE_APP_BUILD || "local";
const PAGINAS_FINANCEIRO = ["contas", "cartoes", "contas-pagar", "renegociacoes", "emprestimos"];

export default function Sidebar({ setPagina, paginaAtual }) {
  const [financeiroAberto, setFinanceiroAberto] = useState(() => PAGINAS_FINANCEIRO.includes(paginaAtual));

  const menuPrincipal = [
    { nome: "Dashboard", pagina: "dashboard", icone: <FiHome /> },
    {
      nome: "Novo Lançamento",
      pagina: "novo-lancamento",
      icone: <FiPlusCircle />,
      ativoExtra: [
        "nova-entrada",
        "venda-produtos",
        "transferencia",
        "nova-saida",
        "novo-abastecimento",
        "nova-manutencao",
        "nova-alimentacao",
        "novo-uso-tag",
        "novo-impostos",
        "nova-outra-saida",
      ],
    },
    { nome: "Extrato", pagina: "extrato", icone: <FiFileText /> },
    { nome: "Metas", pagina: "metas", icone: <FiTarget /> },
    { nome: "Veículos", pagina: "veiculos", icone: <FiTruck /> },
  ];

  const menuFinanceiro = [
    { nome: "Contas", pagina: "contas", icone: <FiBriefcase /> },
    { nome: "Cartões", pagina: "cartoes", icone: <FiCreditCard /> },
    { nome: "Contas a Pagar", pagina: "contas-pagar", icone: <FiAlertTriangle /> },
    { nome: "Renegociações", pagina: "renegociacoes", icone: <FiRefreshCw /> },
    { nome: "Empréstimos", pagina: "emprestimos", icone: <FiDollarSign /> },
  ];

  const menuConfiguracoes = [
    {
      nome: "Configurações",
      pagina: "configuracoes-categorias",
      icone: <FiSettings />,
      ativoExtra: ["configuracoes-categorias"],
    },
  ];

  function itemAtivo(item) {
    return paginaAtual === item.pagina || item.ativoExtra?.includes(paginaAtual);
  }

  function renderItem(item) {
    const ativo = itemAtivo(item);

    return (
      <button
        key={item.nome}
        onClick={() => setPagina(item.pagina)}
        title={item.nome}
        className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition font-semibold ${
          ativo
            ? "bg-green-500 text-black"
            : "text-gray-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className="text-lg shrink-0">{item.icone}</span>
        <span className="truncate">{item.nome}</span>
      </button>
    );
  }

  return (
    <aside className="w-72 h-dvh bg-[#111827] border-r border-gray-800 p-6 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-11 h-11 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center text-green-400 font-black">
          J
        </div>

        <div className="min-w-0">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">
            Bem-vindo
          </p>
          <p className="text-white text-sm font-black truncate">Olá, João! 👋</p>
        </div>
      </div>

      <div className="border-t border-gray-700 my-6 shrink-0" />

      <nav className="space-y-2 overflow-y-auto scrollbar-hide pr-1 flex-1">
        {menuPrincipal.slice(0, 4).map(renderItem)}

        <div>
          <button
            type="button"
            onClick={() => setFinanceiroAberto((aberto) => !aberto)}
            aria-expanded={financeiroAberto}
            aria-controls="sidebar-menu-financeiro"
            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition font-semibold ${
              PAGINAS_FINANCEIRO.includes(paginaAtual)
                ? "bg-green-500/15 text-green-400"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="text-lg shrink-0"><FiDollarSign /></span>
            <span className="truncate flex-1 text-left">Financeiro</span>
            <FiChevronDown className={`shrink-0 transition-transform ${financeiroAberto ? "rotate-180" : ""}`} />
          </button>

          {financeiroAberto && (
            <div id="sidebar-menu-financeiro" className="mt-2 ml-4 pl-3 space-y-1 border-l border-gray-700">
              {menuFinanceiro.map(renderItem)}
            </div>
          )}
        </div>

        {menuPrincipal.slice(4).map(renderItem)}

        <div className="pt-4 mt-4 border-t border-dashed border-gray-700">
          {menuConfiguracoes.map(renderItem)}
        </div>
      </nav>

      <div className="pt-4 mt-4 border-t border-gray-800 shrink-0">
        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">
          ControlDriver
        </p>
        <p className="text-xs text-gray-400 mt-1">v{APP_VERSION}</p>
        <p className="text-[10px] text-gray-600 mt-0.5">Build {APP_BUILD}</p>
      </div>
    </aside>
  );
}
