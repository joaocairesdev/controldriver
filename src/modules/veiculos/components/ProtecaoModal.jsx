import { useMemo, useState } from "react";

import ModalBase from "../../../shared/components/modals/ModalBase";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import SelecionarOpcaoModal from "../../../shared/components/modals/SelecionarOpcaoModal";
import SelecionarParcelasModal from "../../../shared/components/modals/SelecionarParcelasModal";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";
import { dividirValorEmParcelas } from "../../contratos/utils/contratosFinanceiros";
import { formatarDataBR } from "../../../shared/utils/data";
import { formatarMoedaDigitada, moedaParaNumero, numeroParaMoedaInput } from "../../../shared/utils/moeda";
import { nomeCartaoComFinal } from "../../cartoes/utils/cartoesUtils";

const FORMAS_CONTRATACAO = [
  { valor: "pagamento_unico", titulo: "Pagamento único" },
  { valor: "mensal", titulo: "Mensal" },
  { valor: "parcelado", titulo: "Parcelado" },
  { valor: "entrada_parcelas", titulo: "Entrada + Parcelas" },
];

const FORMAS_PAGAMENTO = [
  { valor: "pix", titulo: "Pix" },
  { valor: "debito", titulo: "Débito" },
  { valor: "dinheiro", titulo: "Dinheiro" },
  { valor: "credito_avista", titulo: "Cartão de crédito" },
  { valor: "boleto", titulo: "Boleto" },
];

function origemVazia() {
  return { formaPagamento: "", contaId: "", cartaoId: "" };
}

function criarFormulario(protecao) {
  const formaExistente = protecao?.forma_pagamento === "boleto_parcelado"
    ? "boleto"
    : protecao?.forma_pagamento || "";
  const origem = {
    formaPagamento: formaExistente,
    contaId: protecao?.conta_id ? String(protecao.conta_id) : "",
    cartaoId: protecao?.cartao_id ? String(protecao.cartao_id) : "",
  };
  const parcelado = Number(protecao?.numero_parcelas || 1) > 1;
  const valorTotal = Number(protecao?.valor_total || 0);
  const valorParcela = Number(protecao?.valor_parcela || 0);
  return {
    tipoProtecao: protecao?.tipo_protecao || "protecao_veicular",
    nomeProtecao: protecao?.nome_protecao || "",
    inicioVigencia: protecao?.inicio_vigencia || "",
    fimVigencia: protecao?.fim_vigencia || "",
    formaContratacao: parcelado ? "parcelado" : "pagamento_unico",
    pagamentoUnico: {
      valor: valorTotal ? numeroParaMoedaInput(valorTotal) : "",
      dataPagamento: protecao?.primeiro_vencimento_pendente || "",
      ...origem,
    },
    mensal: { valorMensal: "", primeiroVencimento: "", ...origemVazia() },
    parcelado: {
      valorTotal: valorTotal ? numeroParaMoedaInput(valorTotal) : "",
      numeroParcelas: parcelado ? String(protecao.numero_parcelas) : "12",
      primeiroVencimento: protecao?.primeiro_vencimento_pendente || "",
      ...origem,
    },
    entrada: { valor: "", dataPagamento: "", ...origemVazia() },
    parcelas: {
      numeroParcelas: "12",
      valorParcela: valorParcela ? numeroParaMoedaInput(valorParcela) : "",
      primeiroVencimento: "",
      ...origemVazia(),
    },
  };
}

export default function ProtecaoModal({
  aberto,
  protecao,
  acao = "",
  contas,
  cartoes,
  formatarMoeda,
  onClose,
  onSalvar,
}) {
  const [formulario, setFormulario] = useState(() => criarFormulario(protecao));
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [modalContratacao, setModalContratacao] = useState(false);
  const [seletor, setSeletor] = useState(null);

  const valorParcelaCalculado = useMemo(() => {
    const valores = dividirValorEmParcelas(
      moedaParaNumero(formulario.parcelado.valorTotal),
      Number(formulario.parcelado.numeroParcelas || 0),
    );
    return valores[0] ? numeroParaMoedaInput(valores[0]) : "";
  }, [formulario.parcelado.numeroParcelas, formulario.parcelado.valorTotal]);

  function alterar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    limparErro(campo);
  }

  function alterarGrupo(grupo, campo, valor) {
    setFormulario((atual) => ({
      ...atual,
      [grupo]: { ...atual[grupo], [campo]: valor },
    }));
    limparErro(`${grupo}.${campo}`);
  }

  function limparErro(campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
  }

  function validarOrigem(grupo, novos) {
    const dados = formulario[grupo];
    if (!dados.formaPagamento) novos[`${grupo}.formaPagamento`] = "Selecione a forma de pagamento.";
    if (dados.formaPagamento === "credito_avista" && !dados.cartaoId) {
      novos[`${grupo}.cartaoId`] = "Selecione o cartão.";
    }
    if (dados.formaPagamento && !["credito_avista", "boleto"].includes(dados.formaPagamento) && !dados.contaId) {
      novos[`${grupo}.contaId`] = "Selecione a conta.";
    }
  }

  function validar() {
    const novos = {};
    if (!formulario.nomeProtecao.trim()) novos.nomeProtecao = "Informe o nome da proteção.";
    if (!formulario.inicioVigencia) novos.inicioVigencia = "Informe o início da vigência.";
    if (!formulario.fimVigencia) novos.fimVigencia = "Informe o fim da vigência.";
    if (formulario.inicioVigencia && formulario.fimVigencia && formulario.fimVigencia < formulario.inicioVigencia) {
      novos.fimVigencia = "O fim não pode ser anterior ao início.";
    }

    if (formulario.formaContratacao === "pagamento_unico") {
      if (moedaParaNumero(formulario.pagamentoUnico.valor) <= 0) novos["pagamentoUnico.valor"] = "Informe o valor.";
      if (!formulario.pagamentoUnico.dataPagamento) novos["pagamentoUnico.dataPagamento"] = "Informe a data do pagamento.";
      validarOrigem("pagamentoUnico", novos);
    }
    if (formulario.formaContratacao === "mensal") {
      if (moedaParaNumero(formulario.mensal.valorMensal) <= 0) novos["mensal.valorMensal"] = "Informe o valor mensal.";
      if (!formulario.mensal.primeiroVencimento) novos["mensal.primeiroVencimento"] = "Informe o primeiro vencimento.";
      if (formulario.mensal.primeiroVencimento && formulario.fimVigencia && formulario.mensal.primeiroVencimento > formulario.fimVigencia) {
        novos["mensal.primeiroVencimento"] = "O primeiro vencimento deve estar dentro da vigência.";
      }
      validarOrigem("mensal", novos);
    }
    if (formulario.formaContratacao === "parcelado") {
      if (moedaParaNumero(formulario.parcelado.valorTotal) <= 0) novos["parcelado.valorTotal"] = "Informe o valor total.";
      if (Number(formulario.parcelado.numeroParcelas || 0) < 2) novos["parcelado.numeroParcelas"] = "Informe pelo menos 2 parcelas.";
      if (!formulario.parcelado.primeiroVencimento) novos["parcelado.primeiroVencimento"] = "Informe o primeiro vencimento.";
      validarOrigem("parcelado", novos);
    }
    if (formulario.formaContratacao === "entrada_parcelas") {
      if (moedaParaNumero(formulario.entrada.valor) <= 0) novos["entrada.valor"] = "Informe o valor da entrada.";
      if (!formulario.entrada.dataPagamento) novos["entrada.dataPagamento"] = "Informe a data da entrada.";
      validarOrigem("entrada", novos);
      if (Number(formulario.parcelas.numeroParcelas || 0) < 2) novos["parcelas.numeroParcelas"] = "Informe pelo menos 2 parcelas.";
      if (moedaParaNumero(formulario.parcelas.valorParcela) <= 0) novos["parcelas.valorParcela"] = "Informe o valor da parcela.";
      if (!formulario.parcelas.primeiroVencimento) novos["parcelas.primeiroVencimento"] = "Informe o primeiro vencimento.";
      validarOrigem("parcelas", novos);
    }

    setErros(novos);
    if (Object.keys(novos).length) setShakeKey(Date.now());
    return Object.keys(novos).length === 0;
  }

  async function salvar() {
    if (acao !== "cancelar" && !validar()) return;
    setSalvando(true);
    try {
      const resultado = await onSalvar(acao === "cancelar" ? null : {
        ...formulario,
        pagamentoUnico: { ...formulario.pagamentoUnico, valor: moedaParaNumero(formulario.pagamentoUnico.valor) },
        mensal: { ...formulario.mensal, valorMensal: moedaParaNumero(formulario.mensal.valorMensal) },
        parcelado: { ...formulario.parcelado, valorTotal: moedaParaNumero(formulario.parcelado.valorTotal) },
        entrada: { ...formulario.entrada, valor: moedaParaNumero(formulario.entrada.valor) },
        parcelas: { ...formulario.parcelas, valorParcela: moedaParaNumero(formulario.parcelas.valorParcela) },
      });
      if (resultado !== false) onClose();
    } finally {
      setSalvando(false);
    }
  }

  function selecionarFormaPagamento(valor) {
    const grupo = seletor.grupo;
    alterarGrupo(grupo, "formaPagamento", valor);
    alterarGrupo(grupo, "contaId", valor === "credito_avista" || valor === "boleto" ? "" : formulario[grupo].contaId);
    alterarGrupo(grupo, "cartaoId", valor === "credito_avista" ? formulario[grupo].cartaoId : "");
  }

  if (acao === "cancelar") {
    return (
      <ModalBase aberto={aberto} titulo="Cancelar proteção" onClose={onClose} largura="max-w-md">
        <p className="text-gray-300">Deseja cancelar a proteção <strong className="text-white">{protecao?.nome_protecao}</strong>?</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-700 p-3 font-bold hover:bg-white/5">Voltar</button>
          <button type="button" onClick={salvar} disabled={salvando} className="rounded-xl bg-red-500 p-3 font-bold text-white hover:bg-red-600 disabled:opacity-50">{salvando ? "Cancelando..." : "Cancelar proteção"}</button>
        </div>
      </ModalBase>
    );
  }

  const grupoAtivo = seletor?.grupo ? formulario[seletor.grupo] : null;
  return (
    <>
      <ModalBase aberto={aberto} titulo={acao === "renovar" ? "Renovar proteção" : acao === "substituir" ? "Substituir proteção" : "Cadastrar proteção"} descricao="Informe a vigência e como as cobranças serão controladas no financeiro." onClose={onClose} largura="max-w-2xl" confirmarAoFecharSeAlterado>
        <div className="space-y-5">
          <InputTexto label="Nome da proteção" value={formulario.nomeProtecao} onChange={(valor) => alterar("nomeProtecao", valor)} erro={erros.nomeProtecao} shakeKey={shakeKey} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CampoData label="Início da vigência" valor={formulario.inicioVigencia} erro={erros.inicioVigencia} shakeKey={shakeKey} onClick={() => setSeletor({ tipo: "data", campo: "inicioVigencia" })} />
            <CampoData label="Fim da vigência" valor={formulario.fimVigencia} erro={erros.fimVigencia} shakeKey={shakeKey} onClick={() => setSeletor({ tipo: "data", campo: "fimVigencia" })} />
          </div>
          <Campo label="Forma de contratação">
            <ButtonField onClick={() => setModalContratacao(true)}>{FORMAS_CONTRATACAO.find((item) => item.valor === formulario.formaContratacao)?.titulo}</ButtonField>
          </Campo>

          {formulario.formaContratacao === "pagamento_unico" && <BlocoPagamento titulo="Pagamento único" grupo="pagamentoUnico" dados={formulario.pagamentoUnico} campos={[{ campo: "valor", label: "Valor", tipo: "moeda" }, { campo: "dataPagamento", label: "Data do pagamento", tipo: "data" }]} erros={erros} shakeKey={shakeKey} alterarGrupo={alterarGrupo} abrirSeletor={setSeletor} contas={contas} cartoes={cartoes} />}
          {formulario.formaContratacao === "mensal" && <BlocoPagamento titulo="Mensalidade" grupo="mensal" dados={formulario.mensal} campos={[{ campo: "valorMensal", label: "Valor mensal", tipo: "moeda" }, { campo: "primeiroVencimento", label: "Primeiro vencimento", tipo: "data" }]} erros={erros} shakeKey={shakeKey} alterarGrupo={alterarGrupo} abrirSeletor={setSeletor} contas={contas} cartoes={cartoes} />}
          {formulario.formaContratacao === "parcelado" && (
            <BlocoPagamento titulo="Parcelamento" grupo="parcelado" dados={formulario.parcelado} campos={[{ campo: "valorTotal", label: "Valor total", tipo: "moeda" }, { campo: "numeroParcelas", label: "Quantidade de parcelas", tipo: "parcelas" }, { campo: "valorCalculado", label: "Valor da parcela", tipo: "leitura", valor: valorParcelaCalculado ? `R$ ${valorParcelaCalculado}` : "—" }, { campo: "primeiroVencimento", label: "Primeiro vencimento", tipo: "data" }]} erros={erros} shakeKey={shakeKey} alterarGrupo={alterarGrupo} abrirSeletor={setSeletor} contas={contas} cartoes={cartoes} />
          )}
          {formulario.formaContratacao === "entrada_parcelas" && (
            <>
              <BlocoPagamento titulo="Entrada" grupo="entrada" dados={formulario.entrada} campos={[{ campo: "valor", label: "Valor da entrada", tipo: "moeda" }, { campo: "dataPagamento", label: "Data da entrada", tipo: "data" }]} erros={erros} shakeKey={shakeKey} alterarGrupo={alterarGrupo} abrirSeletor={setSeletor} contas={contas} cartoes={cartoes} />
              <BlocoPagamento titulo="Parcelas" grupo="parcelas" dados={formulario.parcelas} campos={[{ campo: "numeroParcelas", label: "Quantidade de parcelas", tipo: "parcelas" }, { campo: "valorParcela", label: "Valor da parcela", tipo: "moeda" }, { campo: "primeiroVencimento", label: "Primeiro vencimento", tipo: "data" }]} erros={erros} shakeKey={shakeKey} alterarGrupo={alterarGrupo} abrirSeletor={setSeletor} contas={contas} cartoes={cartoes} />
            </>
          )}

          <div className="sticky bottom-0 grid grid-cols-2 gap-3 bg-[#111827] pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-700 p-3 font-bold hover:bg-white/5">Cancelar</button>
            <button type="button" onClick={salvar} disabled={salvando} className="rounded-xl bg-green-500 p-3 font-bold text-black hover:bg-green-600 disabled:opacity-50">{salvando ? "Salvando..." : "Salvar proteção"}</button>
          </div>
        </div>
      </ModalBase>

      <SelecionarOpcaoModal aberto={modalContratacao} titulo="Forma de contratação" descricao="Escolha como a proteção foi contratada." opcoes={FORMAS_CONTRATACAO} valor={formulario.formaContratacao} onSelecionar={(valor) => alterar("formaContratacao", valor)} onClose={() => setModalContratacao(false)} />
      <SelecionarFormaPagamentoModal aberto={seletor?.tipo === "forma"} formasPagamento={FORMAS_PAGAMENTO} formaPagamento={grupoAtivo?.formaPagamento || ""} onSelecionar={selecionarFormaPagamento} onClose={() => setSeletor(null)} />
      <SelecionarContaModal aberto={seletor?.tipo === "conta"} contas={contas} contaId={grupoAtivo?.contaId || ""} onSelecionar={(valor) => alterarGrupo(seletor.grupo, "contaId", valor)} onClose={() => setSeletor(null)} formatarMoeda={formatarMoeda} />
      <SelecionarCartaoModal aberto={seletor?.tipo === "cartao"} cartoes={cartoes} cartaoId={grupoAtivo?.cartaoId || ""} onSelecionar={(valor) => alterarGrupo(seletor.grupo, "cartaoId", valor)} onClose={() => setSeletor(null)} formatarMoeda={formatarMoeda} />
      <SelecionarParcelasModal aberto={seletor?.tipo === "parcelas"} numeroParcelas={grupoAtivo?.numeroParcelas || "2"} onSelecionar={(valor) => alterarGrupo(seletor.grupo, "numeroParcelas", valor)} onClose={() => setSeletor(null)} />
      <DatePickerModal aberto={seletor?.tipo === "data"} valor={seletor?.grupo ? formulario[seletor.grupo]?.[seletor.campo] : formulario[seletor?.campo] || ""} onChange={(valor) => seletor.grupo ? alterarGrupo(seletor.grupo, seletor.campo, valor) : alterar(seletor.campo, valor)} onClose={() => setSeletor(null)} />
    </>
  );
}

function BlocoPagamento({ titulo, grupo, dados, campos, erros, shakeKey, alterarGrupo, abrirSeletor, contas, cartoes }) {
  const credito = dados.formaPagamento === "credito_avista";
  const boleto = dados.formaPagamento === "boleto";
  const erroOrigem = erros[`${grupo}.${credito ? "cartaoId" : "contaId"}`];
  return (
    <section className="space-y-4 rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
      <h3 className="font-black text-white">{titulo}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {campos.map((campo) => campo.tipo === "moeda" ? (
          <CampoMoeda key={campo.campo} label={campo.label} value={dados[campo.campo]} erro={erros[`${grupo}.${campo.campo}`]} shakeKey={shakeKey} onChange={(valor) => alterarGrupo(grupo, campo.campo, formatarMoedaDigitada(valor))} />
        ) : campo.tipo === "data" ? (
          <CampoData key={campo.campo} label={campo.label} valor={dados[campo.campo]} erro={erros[`${grupo}.${campo.campo}`]} shakeKey={shakeKey} onClick={() => abrirSeletor({ tipo: "data", grupo, campo: campo.campo })} />
        ) : campo.tipo === "parcelas" ? (
          <Campo key={campo.campo} label={campo.label} erro={erros[`${grupo}.${campo.campo}`]} shakeKey={shakeKey}><ButtonField erro={erros[`${grupo}.${campo.campo}`]} shakeKey={shakeKey} onClick={() => abrirSeletor({ tipo: "parcelas", grupo })}>{dados.numeroParcelas || "Selecionar"}x</ButtonField></Campo>
        ) : (
          <Campo key={campo.campo} label={campo.label}><div className="mt-2 rounded-xl border border-gray-700 bg-[#111827] p-3 text-gray-300">{campo.valor}</div></Campo>
        ))}
        <Campo label="Forma de pagamento" erro={erros[`${grupo}.formaPagamento`]} shakeKey={shakeKey}><ButtonField erro={erros[`${grupo}.formaPagamento`]} shakeKey={shakeKey} onClick={() => abrirSeletor({ tipo: "forma", grupo })}>{FORMAS_PAGAMENTO.find((item) => item.valor === dados.formaPagamento)?.titulo || "Selecionar"}</ButtonField></Campo>
        {!boleto && <Campo label={credito ? "Cartão" : "Conta"} erro={erroOrigem} shakeKey={shakeKey}><ButtonField erro={erroOrigem} shakeKey={shakeKey} onClick={() => abrirSeletor({ tipo: credito ? "cartao" : "conta", grupo })}>{credito ? (cartoes.find((item) => String(item.id) === String(dados.cartaoId)) ? nomeCartaoComFinal(cartoes.find((item) => String(item.id) === String(dados.cartaoId))) : "Selecionar cartão") : contas.find((item) => String(item.id) === String(dados.contaId))?.nome || "Selecionar conta"}</ButtonField></Campo>}
      </div>
    </section>
  );
}

function InputTexto({ label, value, onChange, erro, shakeKey }) {
  return <Campo label={label} erro={erro} shakeKey={shakeKey}><input value={value} onChange={(event) => onChange(event.target.value)} className={`mt-2 w-full rounded-xl border bg-[#0B1120] p-3 outline-none focus:border-green-400 ${erro ? "animate-shake border-red-500" : "border-gray-700"}`} /></Campo>;
}

function CampoMoeda({ label, value, onChange, erro, shakeKey }) {
  return <Campo label={label} erro={erro} shakeKey={shakeKey}><div className={`mt-2 flex overflow-hidden rounded-xl border bg-[#111827] focus-within:border-green-400 ${erro ? "animate-shake border-red-500" : "border-gray-700"}`}><span className="px-3 py-3 text-gray-400">R$</span><input value={value} inputMode="decimal" onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent p-3 pl-0 outline-none" /></div></Campo>;
}

function CampoData({ label, valor, onClick, erro, shakeKey }) {
  return <Campo label={label} erro={erro} shakeKey={shakeKey}><ButtonField erro={erro} shakeKey={shakeKey} onClick={onClick}>{valor ? formatarDataBR(valor) : "Selecionar data"}</ButtonField></Campo>;
}
