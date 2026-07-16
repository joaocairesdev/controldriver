import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

import {
  FiTrendingUp,
  FiShoppingBag,
  FiRefreshCw,
  FiDroplet,
  FiTool,
  FiTag,
  FiMoreHorizontal,
  FiPlusCircle,
  FiCalendar,
  FiClipboard,
} from "react-icons/fi";

import TagModal from "../../modules/tag/components/TagModal";
import TransferenciaModal from "../../modules/transferencias/components/TransferenciaModal";
import EntradaAvulsaModal from "../../modules/entradas/components/EntradaAvulsaModal";
import SaidaModal from "../../modules/saidas/components/SaidaModal";
import AbastecimentoOuRecargaModal from "../../modules/abastecimentos/components/AbastecimentoOuRecargaModal";
import ManutencaoModal from "../../modules/manutencoes/components/ManutencaoModal";
import GanhosPlataformaModal from "../../modules/entradas/components/GanhosPlataformaModal";
import ModalBase from "../../shared/components/modals/ModalBase";

export default function NovoLancamento({
  abrirVendaProdutos,
  jornadaParaGanhos = null,
  limparJornadaParaGanhos,
}) {
  const [modalTagAberto, setModalTagAberto] = useState(false);
  const [modalTransferenciaAberto, setModalTransferenciaAberto] =
    useState(false);
  const [modalEntradaAvulsaAberto, setModalEntradaAvulsaAberto] =
    useState(false);
  const [modalGanhosAberto, setModalGanhosAberto] = useState(false);
  const [possuiTagCadastrada, setPossuiTagCadastrada] = useState(false);
  const [carregandoTag, setCarregandoTag] = useState(true);

  const [modalAbastecimentoAberto, setModalAbastecimentoAberto] = useState(false);
  const [modalEscolhaManutencaoAberto, setModalEscolhaManutencaoAberto] = useState(false);
  const [modalManutencaoSimplesAberto, setModalManutencaoSimplesAberto] = useState(false);
  const [modalManutencaoAberto, setModalManutencaoAberto] = useState(false);

  const [modalOutrasDespesasAberto, setModalOutrasDespesasAberto] =
    useState(false);
  const [modalDespesasFuturasAberto, setModalDespesasFuturasAberto] =
    useState(false);

  useEffect(() => {
    if (!jornadaParaGanhos) return;
    setModalGanhosAberto(true);
  }, [jornadaParaGanhos]);

  useEffect(() => {
    verificarTagCadastrada();
  }, []);

  async function verificarTagCadastrada() {
    setCarregandoTag(true);

    const { data, error } = await supabase
      .from("contas")
      .select("id, veiculo_id")
      .eq("ativo", true)
      .eq("tipo_conta", "tag")
      .not("veiculo_id", "is", null)
      .limit(1);

    if (error) {
      console.error("Erro ao verificar TAG cadastrada:", error);
      setPossuiTagCadastrada(false);
      setCarregandoTag(false);
      return;
    }

    setPossuiTagCadastrada((data || []).length > 0);
    setCarregandoTag(false);
  }

  const entradas = [
    {
      titulo: "Ganhos de Plataforma",
      descricao: "Uber, 99, iFood e outros apps",
      icon: <FiTrendingUp />,
      cor: "green",
      acao: () => setModalGanhosAberto(true),
    },
    {
      titulo: "Venda de Produtos",
      descricao: "Renda extra dentro do carro",
      icon: <FiShoppingBag />,
      cor: "cyan",
      acao: abrirVendaProdutos,
    },
    {
      titulo: "Entrada Avulsa",
      descricao: "Pix recebido, depósito ou reembolso",
      icon: <FiPlusCircle />,
      cor: "blue",
      acao: () => setModalEntradaAvulsaAberto(true),
    },
  ];

  const movimentacoes = [
    {
      titulo: "Transferência",
      descricao: "Entre contas, carteira",
      icon: <FiRefreshCw />,
      cor: "indigo",
      acao: () => setModalTransferenciaAberto(true),
    },
  ];

  const operacao = [
    {
      titulo: "Abastecimento / Recarga",
      descricao: "Combustível, recargas eletricas e controle de consumo",
      icon: <FiDroplet />,
      cor: "orange",
      acao: () => setModalAbastecimentoAberto(true),
    },
    {
      titulo: "Manutenção",
      descricao: "Serviços, revisões e peças",
      icon: <FiTool />,
      cor: "yellow",
      acao: () => setModalEscolhaManutencaoAberto(true),
    },
    ...(!carregandoTag && possuiTagCadastrada
      ? [
          {
            titulo: "Uso da TAG",
            descricao: "Pedágio, estacionamento e recarga usado pela TAG",
            icon: <FiTag />,
            cor: "purple",
            acao: () => setModalTagAberto(true),
          },
        ]
      : []),
  ];

  const despesas = [
    {
      titulo: "Outras Despesas",
      descricao: "Despesas de trabalho ou despesas pessoais",
      icon: <FiMoreHorizontal />,
      cor: "pink",
      acao: () => setModalOutrasDespesasAberto(true),
    },
    {
      titulo: "Despesas Futuras",
      descricao: "Boletos, contas da casa e vencimentos",
      icon: <FiCalendar />,
      cor: "gray",
      acao: () => setModalDespesasFuturasAberto(true),
    },
  ];

  const estilos = {
    green: "border-green-500 bg-green-500/10 text-green-400",
    cyan: "border-cyan-500 bg-cyan-500/10 text-cyan-400",
    blue: "border-blue-500 bg-blue-500/10 text-blue-400",
    orange: "border-orange-500 bg-orange-500/10 text-orange-400",
    yellow: "border-yellow-500 bg-yellow-500/10 text-yellow-400",
    red: "border-red-500 bg-red-500/10 text-red-400",
    purple: "border-purple-500 bg-purple-500/10 text-purple-400",
    gray: "border-gray-600 bg-gray-500/10 text-gray-300",
    teal: "border-teal-500 bg-teal-500/10 text-teal-400",
indigo: "border-indigo-500 bg-indigo-500/10 text-indigo-400",
pink: "border-pink-500 bg-pink-500/10 text-pink-400",
slate: "border-slate-500 bg-slate-500/10 text-slate-300",
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Novo Lançamento</h1>

      <p className="text-gray-400 mt-2">
        Selecione o tipo de movimentação que deseja registrar
      </p>

      <Secao titulo="Entradas" cards={entradas} estilos={estilos} />
      <Secao titulo="Movimentações" cards={movimentacoes} estilos={estilos} />
      <Secao titulo="Veículo / Operação" cards={operacao} estilos={estilos} />
      <Secao titulo="Despesas" cards={despesas} estilos={estilos} />

      <GanhosPlataformaModal
        key={jornadaParaGanhos?.id || "ganhos-manual"}
        aberto={modalGanhosAberto}
        jornadaInicial={jornadaParaGanhos}
        onClose={() => {
          setModalGanhosAberto(false);
          limparJornadaParaGanhos?.();
        }}
      />

      <TagModal
        aberto={modalTagAberto}
        onClose={() => setModalTagAberto(false)}
      />

      <TransferenciaModal
        aberto={modalTransferenciaAberto}
        onClose={() => setModalTransferenciaAberto(false)}
      />

      <EntradaAvulsaModal
        aberto={modalEntradaAvulsaAberto}
        onClose={() => setModalEntradaAvulsaAberto(false)}
      />



      <AbastecimentoOuRecargaModal
        aberto={modalAbastecimentoAberto}
        onClose={() => setModalAbastecimentoAberto(false)}
      />

      <EscolhaManutencaoModal
        aberto={modalEscolhaManutencaoAberto}
        onClose={() => setModalEscolhaManutencaoAberto(false)}
        onRegistroSimples={() => {
          setModalEscolhaManutencaoAberto(false);
          setModalManutencaoSimplesAberto(true);
        }}
        onRegistroCompleto={() => {
          setModalEscolhaManutencaoAberto(false);
          setModalManutencaoAberto(true);
        }}
      />

      <SaidaModal
        aberto={modalManutencaoSimplesAberto}
        onClose={() => setModalManutencaoSimplesAberto(false)}
        titulo="Manutenção (Registrar Despesa)"
        descricaoModal="Registre os gastos com peças, mão de obra e outros custos relacionados à manutenção."
        categoriaInicial="Manutenção"
        categoriaBloqueada={true}
      />

      <ManutencaoModal
        aberto={modalManutencaoAberto}
        onClose={() => setModalManutencaoAberto(false)}
      />

      <SaidaModal
        aberto={modalOutrasDespesasAberto}
        onClose={() => setModalOutrasDespesasAberto(false)}
        titulo="Outras Despesas"
        descricaoModal="Registre lavagem, acessórios, impostos, multas e outros gastos gerais."
      />

      <SaidaModal
        aberto={modalDespesasFuturasAberto}
        onClose={() => setModalDespesasFuturasAberto(false)}
        titulo="Despesas Futuras"
        descricaoModal="Registre boletos, contas a pagar e vencimentos futuros."
        modo="futura"
      />
    </div>
  );
}

function EscolhaManutencaoModal({
  aberto,
  onClose,
  onRegistroSimples,
  onRegistroCompleto,
}) {
  if (!aberto) return null;

  return (
    <ModalBase
      aberto={aberto}
      titulo="Manutenção"
      descricao="Escolha entre registrar uma despesa ou atualizar o histórico de manutenções do veículo."
      onClose={onClose}
      largura="max-w-2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onRegistroSimples}
          className="rounded-2xl border border-yellow-500 bg-yellow-500/10 p-5 text-left hover:scale-[1.02] transition"
        >
          <div className="w-12 h-12 rounded-xl border border-yellow-500/60 bg-yellow-500/10 text-yellow-400 flex items-center justify-center text-2xl mb-4">
            <FiClipboard />
          </div>
          <h3 className="text-lg font-black text-white">Registrar Despesa</h3>
          <p className="text-sm text-gray-400 mt-2">
            Registre os gastos com peças, mão de obra e outros custos relacionados à manutenção.
          </p>
        </button>

        <button
          type="button"
          onClick={onRegistroCompleto}
          className="rounded-2xl border border-green-500 bg-green-500/10 p-5 text-left hover:scale-[1.02] transition"
        >
          <div className="w-12 h-12 rounded-xl border border-green-500/60 bg-green-500/10 text-green-400 flex items-center justify-center text-2xl mb-4">
            <FiTool />
          </div>
          <h3 className="text-lg font-black text-white">Atualizar Histórico</h3>
          <p className="text-sm text-gray-400 mt-2">
            Informe os serviços realizados para manter o histórico de manutenções do veículo atualizado.
          </p>
        </button>
      </div>
    </ModalBase>
  );
}

function Secao({ titulo, cards, estilos }) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">{titulo}</h2>
        <div className="h-px flex-1 border-t border-dashed border-gray-700" />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => (
          <LancamentoCard key={card.titulo} card={card} estilos={estilos} />
        ))}
      </div>
    </section>
  );
}

function LancamentoCard({ card, estilos }) {
  return (
    <button
      type="button"
      onClick={card.acao}
      className={`min-h-40 rounded-2xl border p-6 flex flex-col items-center justify-center text-center hover:scale-[1.02] transition ${estilos[card.cor]}`}
    >
      <div className="text-3xl mb-4">{card.icon}</div>
      <h2 className="text-lg font-bold text-white">{card.titulo}</h2>
      <p className="text-sm mt-2 text-gray-400">{card.descricao}</p>
    </button>
  );
}

