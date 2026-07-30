import { useEffect, useMemo, useState } from "react";
import { FiDollarSign, FiEdit2, FiFileText, FiPlus, FiSlash, FiTrash2 } from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import ParcelasContrato from "../../../shared/components/financeiro/ParcelasContrato";
import ResumoContrato from "../../../shared/components/financeiro/ResumoContrato";
import TelaParcelaContrato, { CabecalhoVoltar } from "../../../shared/components/financeiro/TelaParcelaContrato";
import ConfirmacaoModal from "../../../shared/components/modals/ConfirmacaoModal";
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";
import { formatarDataBR } from "../../../shared/utils/data";
import { formatarMoeda } from "../../../shared/utils/moeda";
import RegistrarPagamentoModal from "../../contas/components/RegistrarPagamentoModal";
import EmprestimoModal from "../components/EmprestimoModal";
import {
  atualizarParcelaFutura,
  buscarContratosFinanceiros,
  cancelarParcelasFuturas,
  excluirContratoFinanceiro,
  quitarContratoAntecipadamente,
} from "../services/contratosFinanceirosService";
import { calcularResumoContrato, contratoPossuiHistoricoProtegido } from "../utils/contratosFinanceiros";

const STATUS = { ativo: "Ativo", quitado: "Quitado", cancelado: "Cancelado" };

export default function Emprestimos() {
  const [contratos, setContratos] = useState([]);
  const [contas, setContas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalCadastro, setModalCadastro] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState(null);
  const [parcelaSelecionada, setParcelaSelecionada] = useState(null);
  const [edicaoContrato, setEdicaoContrato] = useState(null);
  const [parcelaPagamento, setParcelaPagamento] = useState(null);
  const [quitacaoContrato, setQuitacaoContrato] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });

  useEffect(() => { carregarDados(); }, []);

  async function carregarDados() {
    setCarregando(true);
    try {
      const [lista, resContas] = await Promise.all([
        buscarContratosFinanceiros(supabase),
        supabase.from("contas").select("*").eq("ativo", true).order("nome"),
      ]);
      if (resContas.error) throw resContas.error;
      setContratos(lista);
      setContas((resContas.data || []).filter((conta) => conta.tipo_conta !== "tag"));
      setContratoSelecionado((atual) => atual
        ? lista.find((item) => String(item.id) === String(atual.id)) || null
        : null);
      setParcelaSelecionada((atual) => {
        if (!atual) return null;
        const contrato = lista.find((item) => String(item.id) === String(atual.contratoId));
        const parcela = contrato?.parcelas.find((item) => String(item.id) === String(atual.id));
        return parcela ? { ...parcela, contratoId: contrato.id } : null;
      });
      return lista;
    } catch (error) {
      console.error(error);
      setFeedback({ aberto: true, tipo: "erro", titulo: "Erro ao carregar", mensagem: error.message || "Não foi possível carregar os empréstimos. Confira se a migration foi aplicada." });
      return [];
    } finally {
      setCarregando(false);
    }
  }

  const totais = useMemo(() => contratos.reduce((acc, contrato) => {
    const resumo = calcularResumoContrato(contrato);
    acc.recebido += Number(contrato.valor_recebido || 0);
    acc.pago += resumo.totalPago;
    acc.saldo += resumo.saldoDevedor;
    if (contrato.status === "ativo") acc.ativos += 1;
    return acc;
  }, { recebido: 0, pago: 0, saldo: 0, ativos: 0 }), [contratos]);

  function concluirAcao(titulo, mensagem) {
    setConfirmacao(null);
    setContratoSelecionado(null);
    setParcelaSelecionada(null);
    carregarDados();
    setFeedback({ aberto: true, tipo: "sucesso", titulo, mensagem });
  }

  async function confirmarAcao() {
    if (!confirmacao || processando) return;
    setProcessando(true);
    try {
      if (confirmacao.tipo === "excluir") {
        await excluirContratoFinanceiro(supabase, confirmacao.contrato);
        concluirAcao("Empréstimo excluído", "A entrada e as parcelas sem histórico foram removidas com segurança.");
      } else {
        await cancelarParcelasFuturas(supabase, confirmacao.contrato);
        concluirAcao("Parcelas canceladas", "As parcelas futuras sem pagamento foram canceladas.");
      }
    } catch (error) {
      console.error(error);
      setFeedback({ aberto: true, tipo: "erro", titulo: "Não foi possível concluir", mensagem: error.message || "Tente novamente." });
    } finally {
      setProcessando(false);
    }
  }

  function solicitarExclusao(contrato) {
    if (contratoPossuiHistoricoProtegido(contrato)) {
      setFeedback({ aberto: true, tipo: "aviso", titulo: "Empréstimo protegido", mensagem: "Este empréstimo possui pagamentos ou histórico protegido e não pode ser excluído." });
      return;
    }
    setConfirmacao({ tipo: "excluir", contrato });
  }

  async function salvarItemParcela(parcela, itemId, ajuste) {
    const itensBase = [{
      id: contratoSelecionado.id,
      nome: contratoSelecionado.credor_nome,
      valor: parcela.valorPrevisto,
    }];
    await atualizarParcelaFutura(
      supabase,
      parcela,
      itemId,
      ajuste,
      itensBase,
      contratoSelecionado.credor_nome
    );
    await carregarDados();
    setFeedback({ aberto: true, tipo: "sucesso", titulo: "Item atualizado", mensagem: "O valor da parcela e a Conta a Pagar foram atualizados sem recalcular o contrato." });
  }

  return (
    <div>
      {parcelaSelecionada && contratoSelecionado ? (
        <TelaParcelaContrato
          parcela={parcelaSelecionada}
          itensBase={[{ id: contratoSelecionado.id, nome: contratoSelecionado.credor_nome, valor: parcelaSelecionada.valorPrevisto }]}
          nomePadrao={contratoSelecionado.credor_nome}
          onVoltar={() => setParcelaSelecionada(null)}
          onSalvarItem={salvarItemParcela}
          onPagar={(parcela) => setParcelaPagamento(parcela.cobranca)}
        />
      ) : contratoSelecionado ? (
        <TelaContratoEmprestimo
          contrato={contratoSelecionado}
          contas={contas}
          onVoltar={() => setContratoSelecionado(null)}
          onSelecionarParcela={(parcela) => setParcelaSelecionada({ ...parcela, contratoId: contratoSelecionado.id })}
          onEditar={() => { setEdicaoContrato(contratoSelecionado); setContratoSelecionado(null); }}
          onExcluir={() => solicitarExclusao(contratoSelecionado)}
          onQuitar={() => { setQuitacaoContrato(contratoSelecionado); setContratoSelecionado(null); }}
          onCancelar={() => setConfirmacao({ tipo: "cancelar", contrato: contratoSelecionado })}
        />
      ) : (
        <ListaEmprestimos
          carregando={carregando}
          contratos={contratos}
          totais={totais}
          onNovo={() => setModalCadastro(true)}
          onSelecionar={setContratoSelecionado}
        />
      )}

      {(modalCadastro || edicaoContrato) && (
        <EmprestimoModal
          key={edicaoContrato?.id || "novo"}
          aberto
          edicao={edicaoContrato}
          onClose={() => { setModalCadastro(false); setEdicaoContrato(null); }}
          onSalvo={carregarDados}
        />
      )}

      {parcelaPagamento && (
        <RegistrarPagamentoModal
          aberto
          contaPagar={parcelaPagamento}
          contas={contas}
          saldoContaPagar={(conta) => Math.max(Number(conta?.valor_total || 0) - Number(conta?.valor_pago || 0), 0)}
          onClose={() => setParcelaPagamento(null)}
          onSalvo={async () => {
            setParcelaPagamento(null);
            await carregarDados();
            setFeedback({ aberto: true, tipo: "sucesso", titulo: "Pagamento registrado", mensagem: "A parcela e o saldo do contrato foram atualizados." });
          }}
        />
      )}

      {quitacaoContrato && (
        <RegistrarPagamentoModal
          aberto
          contaPagar={{ id: `quitacao-${quitacaoContrato.id}`, descricao: `Quitação antecipada - ${quitacaoContrato.credor_nome}`, categoria: "Empréstimo", valor_total: calcularResumoContrato(quitacaoContrato).saldoDevedor, valor_pago: 0 }}
          contas={contas}
          saldoContaPagar={(conta) => Number(conta?.valor_total || 0)}
          exigirValorIntegral
          onConfirmarPersonalizado={(pagamento) => quitarContratoAntecipadamente(supabase, quitacaoContrato, pagamento)}
          onClose={() => setQuitacaoContrato(null)}
          onSalvo={async () => {
            setQuitacaoContrato(null);
            await carregarDados();
            setFeedback({ aberto: true, tipo: "sucesso", titulo: "Empréstimo quitado", mensagem: "A forma real de pagamento e a quitação do contrato foram registradas." });
          }}
        />
      )}

      <ConfirmacaoModal
        aberto={Boolean(confirmacao)}
        tipo="perigo"
        titulo={confirmacao?.tipo === "excluir" ? "Excluir empréstimo?" : "Cancelar parcelas futuras?"}
        mensagem={confirmacao?.tipo === "excluir"
          ? "A entrada recebida e todas as parcelas ainda sem pagamento serão removidas. Esta ação não pode ser desfeita."
          : "Somente parcelas futuras ainda sem pagamentos serão canceladas. Pagamentos já registrados serão preservados."}
        textoConfirmar={confirmacao?.tipo === "excluir" ? "Excluir empréstimo" : "Cancelar futuras"}
        carregando={processando}
        onCancelar={() => setConfirmacao(null)}
        onConfirmar={confirmarAcao}
      />
      <FeedbackModal aberto={feedback.aberto} tipo={feedback.tipo} titulo={feedback.titulo} mensagem={feedback.mensagem} onClose={() => setFeedback((atual) => ({ ...atual, aberto: false }))} />
    </div>
  );
}

function ListaEmprestimos({ carregando, contratos, totais, onNovo, onSelecionar }) {
  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-3xl font-bold">Empréstimos</h1><p className="mt-2 text-gray-400">Acompanhe contratos, parcelas, pagamentos e saldo devedor.</p></div>
      <button type="button" onClick={onNovo} className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-5 py-3 font-black text-black hover:bg-green-600"><FiPlus /> Novo empréstimo</button>
    </div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ResumoCard titulo="Contratos ativos" valor={totais.ativos} />
      <ResumoCard titulo="Total recebido" valor={formatarMoeda(totais.recebido)} />
      <ResumoCard titulo="Total pago" valor={formatarMoeda(totais.pago)} />
      <ResumoCard titulo="Saldo devedor" valor={formatarMoeda(totais.saldo)} destaque />
    </div>
    {carregando ? (
      <div className="mt-8 rounded-2xl border border-gray-800 bg-[#111827] p-6 text-gray-400">Carregando empréstimos...</div>
    ) : contratos.length ? (
      <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {contratos.map((contrato) => <ContratoCard key={contrato.id} contrato={contrato} onClick={() => onSelecionar(contrato)} />)}
      </div>
    ) : (
      <div className="mt-8 rounded-2xl border border-gray-800 bg-[#111827] p-8 text-center"><FiFileText className="mx-auto h-10 w-10 text-gray-600" /><h2 className="mt-4 text-xl font-bold">Nenhum empréstimo cadastrado</h2><p className="mt-2 text-gray-400">Cadastre o primeiro contrato para gerar a entrada e os vencimentos.</p></div>
    )}
  </>;
}

function TelaContratoEmprestimo({ contrato, contas, onVoltar, onSelecionarParcela, onEditar, onExcluir, onQuitar, onCancelar }) {
  const resumo = calcularResumoContrato(contrato);
  const contaRecebimento = contas.find((item) => String(item.id) === String(contrato.conta_recebimento_id));
  return <div>
    <CabecalhoVoltar
      voltar={onVoltar}
      titulo={contrato.credor_nome}
      descricao={contrato.descricao || "Empréstimo"}
      acoes={<><BotaoIcone onClick={onEditar} label="Editar empréstimo"><FiEdit2 /></BotaoIcone><BotaoIcone onClick={onExcluir} label="Excluir empréstimo" perigo><FiTrash2 /></BotaoIcone></>}
    />
    <ResumoContrato itens={[
      { titulo: "Instituição", valor: contrato.credor_nome },
      { titulo: "Quantidade de parcelas", valor: contrato.quantidade_parcelas },
      { titulo: "Parcelas pagas", valor: resumo.parcelasPagas },
      { titulo: "Parcelas restantes", valor: Math.max(Number(contrato.quantidade_parcelas || 0) - resumo.parcelasPagas, 0) },
      { titulo: "Saldo contratado", valor: formatarMoeda(contrato.valor_contratado) },
      { titulo: "Saldo devedor", valor: formatarMoeda(resumo.saldoDevedor), destaque: true },
      { titulo: "Valor da parcela", valor: formatarMoeda(contrato.valor_parcela) },
    ]} />
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Conta que recebeu" valor={contaRecebimento?.nome || "—"} /><Info label="Data do contrato" valor={formatarDataBR(contrato.data_contratacao)} /></div>
    <div className="mt-6 flex flex-wrap gap-2"><Acao icone={<FiDollarSign />} texto="Quitação antecipada" onClick={onQuitar} disabled={contrato.status !== "ativo" || resumo.saldoDevedor <= 0} /><Acao icone={<FiSlash />} texto="Cancelar futuras" onClick={onCancelar} perigo disabled={contrato.status !== "ativo"} /></div>
    <ParcelasContrato parcelas={contrato.parcelas} onSelecionar={onSelecionarParcela} />
  </div>;
}

function ResumoCard({ titulo, valor, destaque = false }) {
  return <div className={`rounded-2xl border p-5 ${destaque ? "border-yellow-500/30 bg-yellow-500/10" : "border-gray-800 bg-[#111827]"}`}><p className="text-sm text-gray-400">{titulo}</p><p className={`mt-2 text-2xl font-black ${destaque ? "text-yellow-400" : "text-white"}`}>{valor}</p></div>;
}

function ContratoCard({ contrato, onClick }) {
  const resumo = calcularResumoContrato(contrato);
  return <button type="button" onClick={onClick} className="rounded-2xl border border-gray-800 bg-[#111827] p-5 text-left transition hover:border-green-400/70">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-black">{contrato.credor_nome}</h2><p className="mt-1 truncate text-sm text-gray-400">{contrato.descricao || "Empréstimo"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${contrato.status === "ativo" ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-300"}`}>{STATUS[contrato.status] || contrato.status}</span></div>
    <p className="mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">Saldo devedor</p><p className="mt-1 text-2xl font-black text-yellow-400">{formatarMoeda(resumo.saldoDevedor)}</p>
    <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-400"><span>Pago: <strong className="text-white">{formatarMoeda(resumo.totalPago)}</strong></span><span>Próximo: <strong className="text-white">{formatarDataBR(resumo.proximoVencimento) || "—"}</strong></span></div>
  </button>;
}

function BotaoIcone({ onClick, label, perigo, children }) {
  return <button type="button" onClick={onClick} className={`flex h-10 w-10 items-center justify-center rounded-xl border border-gray-700 ${perigo ? "text-red-400" : ""}`} aria-label={label} title={label}>{children}</button>;
}
function Acao({ icone, texto, onClick, perigo = false, disabled = false }) { return <button type="button" onClick={onClick} disabled={disabled} className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${perigo ? "border-red-500/40 text-red-400 hover:bg-red-500/10" : "border-gray-700 hover:bg-white/5"}`}>{icone}{texto}</button>; }
function Info({ label, valor }) { return <div className="rounded-xl border border-gray-800 bg-[#0B1120] p-4"><p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 font-bold">{valor}</p></div>; }
