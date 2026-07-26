import { useEffect, useState } from "react";
import { supabase } from "../../../services/supabase";
import BarraEtapas from "../../../shared/components/ui/BarraEtapas";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";
import ModalBase from "../../../shared/components/modals/ModalBase";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarOpcaoModal from "../../../shared/components/modals/SelecionarOpcaoModal";
import { hojeBrasil, formatarDataBR } from "../../../shared/utils/data";
import { formatarMoeda, formatarMoedaDigitada, moedaParaNumero, numeroParaMoedaInput } from "../../../shared/utils/moeda";
import { criarContratoFinanceiro, atualizarDadosContrato } from "../services/contratosFinanceirosService";
import {
  TIPOS_CREDOR,
  calcularTaxaJurosPercentual,
  dividirValorEmParcelas,
} from "../utils/contratosFinanceiros";

const CAMPOS_DATA = {
  data_contratacao: ["Data do empréstimo", "Escolha a data em que o dinheiro entrou na conta."],
  primeiro_vencimento: ["Primeiro vencimento", "Escolha a data da primeira obrigação."],
};

function estadoInicial() {
  const hoje = hojeBrasil();
  return {
    tipo_contrato: "emprestimo",
    tipo_credor: "",
    credor_nome: "",
    valor_recebido: "",
    valor_contratado: "",
    taxa_juros_percentual: "",
    data_contratacao: hoje,
    data_recebimento: hoje,
    conta_recebimento_id: "",
    descricao: "",
    modo_pagamento: "",
    quantidade_parcelas: "",
    primeiro_vencimento: hoje,
    periodicidade: "mensal",
    forma_pagamento: null,
    conta_pagamento_id: null,
    cartao_pagamento_id: null,
  };
}

function estadoDaEdicao(contrato) {
  return {
    ...estadoInicial(),
    ...contrato,
    valor_recebido: numeroParaMoedaInput(contrato.valor_recebido),
    valor_contratado: numeroParaMoedaInput(contrato.valor_contratado),
    taxa_juros_percentual: String(contrato.taxa_juros_percentual || 0).replace(".", ","),
    quantidade_parcelas: String(contrato.quantidade_parcelas),
    conta_recebimento_id: String(contrato.conta_recebimento_id || ""),
  };
}

export default function EmprestimoModal({ aberto, edicao = null, onClose, onSalvo }) {
  const [etapa, setEtapa] = useState(1);
  const [form, setForm] = useState(() => edicao?.id ? estadoDaEdicao(edicao) : estadoInicial());
  const [contas, setContas] = useState([]);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [seletor, setSeletor] = useState(null);
  const [campoData, setCampoData] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "erro", titulo: "", mensagem: "" });

  const contaRecebimento = contas.find((item) => String(item.id) === String(form.conta_recebimento_id));
  const somenteLeituraFinanceira = Boolean(edicao?.id);

  useEffect(() => {
    if (!aberto) return;
    supabase.from("contas").select("*").eq("ativo", true).order("nome").then((resContas) => {
      if (resContas.error) {
        setFeedback({ aberto: true, tipo: "erro", titulo: "Erro ao carregar", mensagem: "Não foi possível carregar as contas." });
        return;
      }
      setContas((resContas.data || []).filter((conta) => conta.tipo_conta !== "tag"));
    });
  }, [aberto]);

  const valorRecebido = moedaParaNumero(form.valor_recebido);
  const valorContratado = moedaParaNumero(form.valor_contratado);
  const taxaCalculada = calcularTaxaJurosPercentual(valorRecebido, valorContratado);
  const quantidadeParcelas = form.modo_pagamento === "avista" ? 1 : Number(form.quantidade_parcelas || 0);
  const valoresParcelas = dividirValorEmParcelas(valorContratado, quantidadeParcelas);
  const valorParcelasTexto = valoresParcelas.length
    ? valoresParcelas.every((valor) => valor === valoresParcelas[0])
      ? formatarMoeda(valoresParcelas[0])
      : `${Math.max(valoresParcelas.length - 1, 1)}x ${formatarMoeda(valoresParcelas[0])} + última ${formatarMoeda(valoresParcelas.at(-1))}`
    : "—";

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  function validarEtapa(numero) {
    const novos = {};
    if (numero === 1) {
      if (!form.tipo_credor) novos.tipo_credor = "Selecione o tipo de credor.";
      if (!form.credor_nome.trim()) novos.credor_nome = "Informe o nome do credor.";
    }
    if (numero === 2) {
      if (moedaParaNumero(form.valor_recebido) <= 0) novos.valor_recebido = "Informe o valor recebido.";
      if (moedaParaNumero(form.valor_contratado) <= 0) novos.valor_contratado = "Informe o valor contratado.";
      if (moedaParaNumero(form.valor_contratado) < moedaParaNumero(form.valor_recebido)) novos.valor_contratado = "O valor contratado deve ser igual ou maior que o recebido.";
      if (!form.data_contratacao) novos.data_contratacao = "Informe a data da contratação.";
      if (!form.conta_recebimento_id) novos.conta_recebimento_id = "Selecione a conta que recebeu o valor.";
    }
    if (numero === 3) {
      const quantidade = Number(form.quantidade_parcelas || 0);
      if (!form.modo_pagamento) novos.modo_pagamento = "Escolha a condição de pagamento.";
      if (form.modo_pagamento === "parcelado" && (!Number.isInteger(quantidade) || quantidade < 2)) novos.quantidade_parcelas = "Informe ao menos 2 parcelas inteiras.";
      if (form.modo_pagamento === "parcelado" && quantidade >= 2 && valoresParcelas.length !== quantidade) novos.quantidade_parcelas = "A quantidade deve permitir parcelas de ao menos R$ 0,01.";
      if (!form.primeiro_vencimento) novos.primeiro_vencimento = "Informe o primeiro vencimento.";
    }
    setErros(novos);
    if (Object.keys(novos).length) setShakeKey((valor) => valor + 1);
    return !Object.keys(novos).length;
  }

  function avancar() {
    if (!validarEtapa(etapa)) return;
    setErros({});
    setEtapa((atual) => Math.min(atual + 1, 3));
  }

  async function salvar() {
    if (salvando || !validarEtapa(3)) return;
    setSalvando(true);
    try {
      const dados = {
        ...form,
        credor_nome: form.credor_nome.trim(),
        valor_recebido: moedaParaNumero(form.valor_recebido),
        valor_contratado: moedaParaNumero(form.valor_contratado),
        taxa_juros_percentual: taxaCalculada,
        data_recebimento: form.data_contratacao,
        conta_recebimento_id: Number(form.conta_recebimento_id),
        quantidade_parcelas: quantidadeParcelas,
        valor_parcela: valoresParcelas[0],
        periodicidade: "mensal",
        forma_pagamento: null,
        conta_pagamento_id: null,
        cartao_pagamento_id: null,
      };
      if (edicao?.id) await atualizarDadosContrato(supabase, edicao.id, dados);
      else await criarContratoFinanceiro(supabase, dados);
      await onSalvo?.();
      onClose?.();
    } catch (error) {
      console.error(error);
      setFeedback({ aberto: true, tipo: "erro", titulo: "Erro ao salvar", mensagem: error.message || "Não foi possível salvar o empréstimo." });
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;
  const inputClass = (campo) => `w-full mt-2 rounded-xl border bg-[#0B1120] p-3 outline-none focus:border-green-400 ${erros[campo] ? "border-red-500 animate-shake" : "border-gray-700"}`;
  const opcoes = TIPOS_CREDOR;

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={edicao?.id ? "Editar empréstimo" : "Novo empréstimo"}
        descricao={edicao?.id ? "Atualize os dados descritivos sem alterar o histórico financeiro." : "Cadastre a entrada e as obrigações do contrato."}
        onClose={onClose}
        largura="max-w-3xl"
        scrollKey={etapa}
        confirmarAoFecharSeAlterado
        rodape={(
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => etapa > 1 ? (setErros({}), setEtapa(etapa - 1)) : onClose()} className="rounded-xl border border-gray-700 p-3 font-bold hover:bg-white/5">{etapa > 1 ? "Voltar" : "Cancelar"}</button>
            <button type="button" onClick={etapa < 3 ? avancar : salvar} disabled={salvando} className="rounded-xl bg-green-500 p-3 font-bold text-black hover:bg-green-600 disabled:opacity-60">{etapa < 3 ? "Continuar" : salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        )}
      >
        <BarraEtapas etapa={etapa} total={3} />

        {etapa === 1 && <div className="mt-6 space-y-5">
          <CabecalhoEtapa titulo="Quem concedeu o empréstimo?" descricao="Identifique o credor e, se quiser, acrescente uma descrição." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Tipo do credor" erro={erros.tipo_credor} shakeKey={shakeKey}><ButtonField erro={erros.tipo_credor} shakeKey={shakeKey} onClick={() => setSeletor("tipo_credor")}>{TIPOS_CREDOR.find((item) => item.valor === form.tipo_credor)?.titulo || "Selecionar"}</ButtonField></Campo>
            <Campo label="Nome do credor" erro={erros.credor_nome} shakeKey={shakeKey}><input className={inputClass("credor_nome")} value={form.credor_nome} onChange={(event) => alterar("credor_nome", event.target.value)} /></Campo>
          </div>
          <Campo label="Descrição (opcional)"><input className={inputClass("descricao")} value={form.descricao || ""} onChange={(event) => alterar("descricao", event.target.value)} /></Campo>
        </div>}

        {etapa === 2 && <div className="mt-6 space-y-4">
          <CabecalhoEtapa titulo="Dados do empréstimo" descricao="Informe onde e quanto foi recebido. Os juros são calculados automaticamente." />
          {somenteLeituraFinanceira && <p className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-300">Valores, datas e conta de recebimento são preservados após a criação. Ajuste parcelas futuras na tela do contrato.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Data do empréstimo" erro={erros.data_contratacao} shakeKey={shakeKey}><ButtonField erro={erros.data_contratacao} shakeKey={shakeKey} onClick={() => !somenteLeituraFinanceira && setCampoData("data_contratacao")}>{formatarDataBR(form.data_contratacao)}</ButtonField></Campo>
            <Campo label="Conta que recebeu o dinheiro" erro={erros.conta_recebimento_id} shakeKey={shakeKey}><ButtonField erro={erros.conta_recebimento_id} shakeKey={shakeKey} onClick={() => !somenteLeituraFinanceira && setSeletor("conta_recebimento")}>{contaRecebimento?.nome || "Selecionar"}</ButtonField></Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Valor recebido" erro={erros.valor_recebido} shakeKey={shakeKey}><input disabled={somenteLeituraFinanceira} inputMode="numeric" className={inputClass("valor_recebido")} value={form.valor_recebido} onChange={(event) => alterar("valor_recebido", formatarMoedaDigitada(event.target.value))} /></Campo>
            <Campo label="Valor contratado" erro={erros.valor_contratado} shakeKey={shakeKey}><input disabled={somenteLeituraFinanceira} inputMode="numeric" className={inputClass("valor_contratado")} value={form.valor_contratado} onChange={(event) => alterar("valor_contratado", formatarMoedaDigitada(event.target.value))} /></Campo>
            <Campo label="Taxa de juros calculada"><input readOnly value={`${taxaCalculada.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`} className={`${inputClass("taxa_juros_percentual")} cursor-not-allowed text-gray-300`} /></Campo>
          </div>
        </div>}

        {etapa === 3 && <div className="mt-6 space-y-4">
          <CabecalhoEtapa titulo="Como o empréstimo será devolvido?" descricao="Defina apenas a obrigação contratual. A forma real será escolhida ao pagar cada conta." />
          <Campo label="Condição de pagamento" erro={erros.modo_pagamento} shakeKey={shakeKey}><div className="mt-2 grid grid-cols-2 gap-3">{[["avista", "Pagamento único"], ["parcelado", "Parcelado"]].map(([valor, titulo]) => <button disabled={somenteLeituraFinanceira} key={valor} type="button" onClick={() => { alterar("modo_pagamento", valor); if (valor === "avista") alterar("quantidade_parcelas", "1"); }} className={`rounded-xl border p-3 font-bold ${form.modo_pagamento === valor ? "border-green-400 bg-green-500/10 text-green-400" : "border-gray-700 bg-[#0B1120]"}`}>{titulo}</button>)}</div></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            {form.modo_pagamento === "parcelado" && <Campo label="Quantidade de parcelas" erro={erros.quantidade_parcelas} shakeKey={shakeKey}><input disabled={somenteLeituraFinanceira} type="number" min="2" className={inputClass("quantidade_parcelas")} value={form.quantidade_parcelas} onChange={(event) => alterar("quantidade_parcelas", event.target.value)} /></Campo>}
            <Campo label="Primeiro vencimento" erro={erros.primeiro_vencimento} shakeKey={shakeKey}><ButtonField erro={erros.primeiro_vencimento} shakeKey={shakeKey} onClick={() => !somenteLeituraFinanceira && setCampoData("primeiro_vencimento")}>{formatarDataBR(form.primeiro_vencimento)}</ButtonField></Campo>
            <Campo label={form.modo_pagamento === "avista" ? "Valor do pagamento" : "Valor calculado da parcela"}>
              <input readOnly value={valorParcelasTexto} className={`${inputClass("valor_parcela")} cursor-not-allowed text-gray-300`} />
            </Campo>
          </div>
          <div className="mt-6 border-t border-gray-800 pt-5">
            <h3 className="text-lg font-bold">Resumo</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Resumo label="Credor" valor={form.credor_nome || "—"} />
              <Resumo label="Data do empréstimo" valor={formatarDataBR(form.data_contratacao)} />
              <Resumo label="Conta que recebeu" valor={contaRecebimento?.nome || "—"} />
              <Resumo label="Valor recebido" valor={formatarMoeda(valorRecebido)} />
              <Resumo label="Valor contratado" valor={formatarMoeda(valorContratado)} />
              <Resumo label="Juros calculados" valor={`${taxaCalculada.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`} />
              <Resumo label="Condição" valor={form.modo_pagamento === "avista" ? "Pagamento único" : form.modo_pagamento === "parcelado" ? "Parcelado" : "—"} />
              {form.modo_pagamento === "parcelado" && <Resumo label="Quantidade" valor={`${quantidadeParcelas} parcelas`} />}
              <Resumo label="Valor por parcela" valor={valorParcelasTexto} />
              <Resumo label="Primeiro vencimento" valor={formatarDataBR(form.primeiro_vencimento)} />
            </div>
          </div>
        </div>}
      </ModalBase>

      <SelecionarOpcaoModal aberto={seletor === "tipo_credor"} titulo="Selecionar tipo do credor" descricao="Escolha uma das opções disponíveis." opcoes={opcoes} valor={form.tipo_credor} onSelecionar={(valor) => alterar("tipo_credor", valor)} onClose={() => setSeletor(null)} />
      <SelecionarContaModal aberto={seletor === "conta_recebimento"} contas={contas} contaId={form.conta_recebimento_id} onSelecionar={(id) => alterar("conta_recebimento_id", id)} onClose={() => setSeletor(null)} formatarMoeda={formatarMoeda} />
      <DatePickerModal aberto={Boolean(campoData)} valor={campoData ? form[campoData] : ""} onChange={(valor) => alterar(campoData, valor)} onClose={() => setCampoData(null)} titulo={CAMPOS_DATA[campoData]?.[0]} descricao={CAMPOS_DATA[campoData]?.[1]} />
      <FeedbackModal aberto={feedback.aberto} tipo={feedback.tipo} titulo={feedback.titulo} mensagem={feedback.mensagem} onClose={() => setFeedback((atual) => ({ ...atual, aberto: false }))} />
    </>
  );
}

function Resumo({ label, valor }) {
  return <div className="rounded-xl border border-gray-800 bg-[#0B1120] p-4"><p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 font-bold text-white">{valor}</p></div>;
}

function CabecalhoEtapa({ titulo, descricao }) {
  return <div><h3 className="text-xl font-black">{titulo}</h3><p className="mt-1 text-sm text-gray-400">{descricao}</p></div>;
}
