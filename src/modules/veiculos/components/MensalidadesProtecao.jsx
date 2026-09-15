import { useState } from "react";
import ModalBase from "../../../shared/components/modals/ModalBase";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";
import { formatarDataBR } from "../../../shared/utils/data";
import { nomeCartaoComFinal } from "../../cartoes/utils/cartoesUtils";
import { mensalidadePodeSerLancada } from "../services/mensalidadesProtecaoService";

const FORMAS = [
  { valor: "pix", titulo: "Pix" },
  { valor: "debito", titulo: "Débito" },
  { valor: "dinheiro", titulo: "Dinheiro" },
  { valor: "credito_avista", titulo: "Cartão de crédito" },
  { valor: "boleto", titulo: "Boleto" },
];
const ehCredito = (forma) => forma === "credito_avista" || forma === "credito_parcelado";

function origemTexto(forma, contaId, cartaoId, contas, cartoes) {
  if (ehCredito(forma)) {
    const cartao = cartoes.find((item) => String(item.id) === String(cartaoId));
    return cartao ? nomeCartaoComFinal(cartao) : "Selecionar cartão";
  }
  if (forma === "boleto") return "Boleto";
  return contas.find((item) => String(item.id) === String(contaId))?.nome || "Selecionar conta";
}

export default function MensalidadesProtecao({ protecao, agenda, contas, cartoes, formatarMoeda, onLancar, salvando }) {
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [seletor, setSeletor] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  if (!agenda) return null;

  function abrir(item) {
    setItemSelecionado(item);
    setFormulario({
      valor: String(item.valor),
      dataEfetiva: item.data_vencimento,
      formaPagamento: agenda.plano.forma_pagamento_prevista,
      contaId: agenda.plano.conta_pagamento_id ? String(agenda.plano.conta_pagamento_id) : "",
      cartaoId: agenda.plano.cartao_pagamento_id ? String(agenda.plano.cartao_pagamento_id) : "",
    });
    setErros({});
  }

  function alterar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: null }));
  }

  async function confirmar() {
    const invalidos = {};
    if (!Number.isFinite(Number(formulario.valor)) || Number(formulario.valor) <= 0) invalidos.valor = "Informe um valor maior que zero.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formulario.dataEfetiva)) invalidos.dataEfetiva = "Informe a data efetiva.";
    if (!formulario.formaPagamento) invalidos.formaPagamento = "Selecione a forma de pagamento.";
    if (ehCredito(formulario.formaPagamento) && !formulario.cartaoId) invalidos.cartaoId = "Selecione o cartão.";
    if (!ehCredito(formulario.formaPagamento) && formulario.formaPagamento !== "boleto" && !formulario.contaId) invalidos.contaId = "Selecione a conta.";
    if (Object.keys(invalidos).length) {
      setErros(invalidos);
      setShakeKey((atual) => atual + 1);
      return;
    }
    const concluido = await onLancar({ parcelaId: itemSelecionado.id, ...formulario });
    if (concluido) setItemSelecionado(null);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Resumo titulo="Custo previsto" valor={agenda.previsto} formatarMoeda={formatarMoeda} />
        <Resumo titulo="Total lançado" valor={agenda.lancado} formatarMoeda={formatarMoeda} />
        <Resumo titulo="Total pago" valor={agenda.pago} formatarMoeda={formatarMoeda} />
        <Resumo titulo="Restante previsto" valor={agenda.restantePrevisto} formatarMoeda={formatarMoeda} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wide text-gray-500">Agenda de mensalidades</p>
        {agenda.itens.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-800 p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">{item.numero} de {agenda.itens.length} · {formatarDataBR(item.data_vencimento)}</p>
              <p className="text-sm text-gray-400">Previsto: {formatarMoeda(item.valor)} · {origemTexto(agenda.plano.forma_pagamento_prevista, agenda.plano.conta_pagamento_id, agenda.plano.cartao_pagamento_id, contas, cartoes)}</p>
              {item.saida && <p className="text-sm text-green-300">Lançado: {formatarMoeda(item.saida.valor_total)} em {formatarDataBR(item.saida.data_compra)} · {origemTexto(item.saida.forma_pagamento, item.saida.conta_id, item.saida.cartao_id, contas, cartoes)}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-300">{item.statusVisual}</span>
              {mensalidadePodeSerLancada({ protecao, contrato: agenda.contrato, plano: agenda.plano, parcela: item, saida: item.saida }) && (
                <button type="button" onClick={() => abrir(item)} className="rounded-xl border border-green-500/40 px-3 py-2 text-sm font-bold text-green-300 hover:bg-green-500/10">Lançar cobrança</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {itemSelecionado && formulario && (
        <ModalBase aberto titulo={`Lançar mensalidade ${itemSelecionado.numero} de ${agenda.itens.length}`} onClose={() => !salvando && setItemSelecionado(null)} largura="max-w-md" rodape={<button type="button" disabled={salvando} onClick={confirmar} className="w-full rounded-xl bg-green-500 p-3 font-bold text-black disabled:opacity-50">{salvando ? "Lançando..." : "Confirmar lançamento"}</button>}>
          <div className="space-y-4">
            <p className="text-sm">{protecao.nome_protecao} · Mensalidade {itemSelecionado.numero} de {agenda.itens.length}</p>
            <div className="rounded-xl border border-gray-700 p-3 text-sm">
              <p>Data prevista: {formatarDataBR(itemSelecionado.data_vencimento)}</p>
              <p>Valor previsto: {formatarMoeda(itemSelecionado.valor)}</p>
              <p>Forma prevista: {origemTexto(agenda.plano.forma_pagamento_prevista, agenda.plano.conta_pagamento_id, agenda.plano.cartao_pagamento_id, contas, cartoes)}</p>
            </div>
            <Campo label="Valor efetivamente cobrado" erro={erros.valor} shakeKey={shakeKey}><input key={erros.valor ? shakeKey : "ok"} type="number" min="0.01" step="0.01" value={formulario.valor} onChange={(evento) => alterar("valor", evento.target.value)} className={`mt-2 w-full rounded-xl border bg-transparent p-3 ${erros.valor ? "border-red-500 animate-shake" : "border-gray-700"}`} /></Campo>
            <Campo label="Data efetiva do lançamento" erro={erros.dataEfetiva} shakeKey={shakeKey}><ButtonField erro={erros.dataEfetiva} shakeKey={shakeKey} onClick={() => setSeletor("data")}>{formatarDataBR(formulario.dataEfetiva) || "Selecionar data"}</ButtonField></Campo>
            <Campo label="Forma efetivamente utilizada" erro={erros.formaPagamento} shakeKey={shakeKey}><ButtonField erro={erros.formaPagamento} shakeKey={shakeKey} onClick={() => setSeletor("forma")}>{FORMAS.find((item) => item.valor === formulario.formaPagamento)?.titulo || "Selecionar"}</ButtonField></Campo>
            {formulario.formaPagamento !== "boleto" && <Campo label={ehCredito(formulario.formaPagamento) ? "Cartão efetivo" : "Conta efetiva"} erro={erros[ehCredito(formulario.formaPagamento) ? "cartaoId" : "contaId"]} shakeKey={shakeKey}><ButtonField erro={erros[ehCredito(formulario.formaPagamento) ? "cartaoId" : "contaId"]} shakeKey={shakeKey} onClick={() => setSeletor(ehCredito(formulario.formaPagamento) ? "cartao" : "conta")}>{origemTexto(formulario.formaPagamento, formulario.contaId, formulario.cartaoId, contas, cartoes)}</ButtonField></Campo>}
          </div>
        </ModalBase>
      )}
      <SelecionarFormaPagamentoModal aberto={seletor === "forma"} formasPagamento={FORMAS} formaPagamento={formulario?.formaPagamento || ""} onSelecionar={(valor) => { alterar("formaPagamento", valor); setSeletor(null); }} onClose={() => setSeletor(null)} />
      <SelecionarContaModal aberto={seletor === "conta"} contas={contas} contaId={formulario?.contaId || ""} onSelecionar={(valor) => { alterar("contaId", valor); setSeletor(null); }} onClose={() => setSeletor(null)} formatarMoeda={formatarMoeda} />
      <SelecionarCartaoModal aberto={seletor === "cartao"} cartoes={cartoes} cartaoId={formulario?.cartaoId || ""} onSelecionar={(valor) => { alterar("cartaoId", valor); setSeletor(null); }} onClose={() => setSeletor(null)} formatarMoeda={formatarMoeda} />
      <DatePickerModal aberto={seletor === "data"} valor={formulario?.dataEfetiva || ""} onChange={(valor) => alterar("dataEfetiva", valor)} onClose={() => setSeletor(null)} />
    </div>
  );
}

function Resumo({ titulo, valor, formatarMoeda }) {
  return <div className="rounded-xl border border-gray-800 p-3"><p className="text-xs text-gray-400">{titulo}</p><p className="mt-1 font-bold">{formatarMoeda(valor)}</p></div>;
}
