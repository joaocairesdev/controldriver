import { useEffect, useState } from "react";
import ModalBase from "../../../shared/components/modals/ModalBase";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";

export function DocumentacaoVeiculoModal({ aberto, tipo, documento, onClose, onSalvar, salvando }) {
  const [formulario, setFormulario] = useState(() => dadosDocumento(tipo, documento));
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [dataPagamentoAberta, setDataPagamentoAberta] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    // O modal representa um documento específico a cada abertura.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormulario(dadosDocumento(tipo, documento));
    setErros({});
  }, [aberto, tipo, documento]);

  function alterar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
  }

  async function salvar() {
    const novos = {};
    if (!formulario.ano) novos.ano = "Informe o ano.";
    if (formulario.ano && (Number(formulario.ano) < 1900 || Number(formulario.ano) > 2200)) novos.ano = "Informe um ano válido.";
    if (formulario.valor === "") novos.valor = "Informe o valor.";
    if (formulario.status === "pago" && !formulario.dataPagamento) novos.dataPagamento = "Informe a data de pagamento.";
    setErros(novos);
    if (Object.keys(novos).length) { setShakeKey(Date.now()); return; }
    const sucesso = await onSalvar(formulario);
    if (sucesso) onClose();
  }

  return (
    <ModalBase aberto={aberto} onClose={onClose} titulo={tipo === "ipva" ? "IPVA" : "Licenciamento"} descricao={`Cadastro de ${tipo === "ipva" ? "IPVA" : "licenciamento"} do veículo.`} largura="max-w-xl"
      rodape={<Acoes onCancelar={onClose} onSalvar={salvar} salvando={salvando} />}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Ano" erro={erros.ano} shakeKey={shakeKey}><input inputMode="numeric" value={formulario.ano} onChange={(e) => alterar("ano", e.target.value.replace(/\D/g, "").slice(0, 4))} className={classeInput(erros.ano)} /></Campo>
          <Campo label="Valor" erro={erros.valor} shakeKey={shakeKey}><input inputMode="decimal" value={formulario.valor} onChange={(e) => alterar("valor", e.target.value.replace(/[^\d,.]/g, "").replace(",", "."))} className={classeInput(erros.valor)} /></Campo>
        </div>
        <Campo label="Situação"><div className={`mt-2 grid gap-3 ${tipo === "ipva" ? "grid-cols-2" : "grid-cols-2"}`}>
          <Opcao ativa={formulario.status === "pago"} onClick={() => alterar("status", "pago")}>Pago</Opcao>
          <Opcao ativa={formulario.status === "pendente"} onClick={() => { alterar("status", "pendente"); alterar("dataPagamento", ""); }}>Pendente</Opcao>
          {tipo === "ipva" && <Opcao ativa={formulario.status === "parcelado"} onClick={() => { alterar("status", "parcelado"); alterar("dataPagamento", ""); }}>Parcelado</Opcao>}
          {tipo === "ipva" && <Opcao ativa={formulario.status === "entrada_parcelas"} onClick={() => { alterar("status", "entrada_parcelas"); alterar("dataPagamento", ""); }}>Entrada + Parcelas</Opcao>}
        </div></Campo>
        {formulario.status === "pago" && <Campo label="Data de pagamento" erro={erros.dataPagamento} shakeKey={shakeKey}><button type="button" onClick={() => setDataPagamentoAberta(true)} className={`${classeInput(erros.dataPagamento)} text-left`}>{formulario.dataPagamento ? formatarData(formulario.dataPagamento) : "Selecionar data"}</button></Campo>}
      </div>
      <DatePickerModal aberto={dataPagamentoAberta} valor={formulario.dataPagamento} onChange={(valor) => alterar("dataPagamento", valor)} onClose={() => setDataPagamentoAberta(false)} titulo="Data de pagamento" descricao={`Escolha a data de pagamento do ${tipo === "ipva" ? "IPVA" : "licenciamento"}.`} />
    </ModalBase>
  );
}

export function AquisicaoVeiculoModal({ aberto, aquisicao, situacaoPatrimonial, onClose, onSalvar, salvando }) {
  const [dados, setDados] = useState(() => dadosAquisicao(aquisicao, situacaoPatrimonial));

  useEffect(() => {
    if (!aberto) return;
    // Sincroniza os dados patrimoniais com o veículo exibido.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDados(dadosAquisicao(aquisicao, situacaoPatrimonial));
  }, [aberto, aquisicao, situacaoPatrimonial]);

  return <ModalBase aberto={aberto} onClose={onClose} titulo="Informações patrimoniais" descricao="Valor pago, forma de aquisição e situação patrimonial do veículo." largura="max-w-xl" rodape={<Acoes onCancelar={onClose} onSalvar={() => onSalvar(dados)} salvando={salvando} />}>
    <div className="space-y-5">
      <Campo label="Valor pago"><input inputMode="decimal" value={dados.valorPago} onChange={(e) => setDados((a) => ({ ...a, valorPago: numero(e.target.value) }))} className={classeInput(false)} /></Campo>
      <Campo label="Forma de aquisição"><input value={dados.formaAquisicao} onChange={(e) => setDados((a) => ({ ...a, formaAquisicao: e.target.value }))} placeholder="Ex: à vista, consórcio" className={classeInput(false)} /></Campo>
      <Campo label="Situação patrimonial"><div className="mt-2 grid grid-cols-2 gap-3"><Opcao ativa={dados.situacaoPatrimonial === "quitado"} onClick={() => setDados((a) => ({ ...a, situacaoPatrimonial: "quitado" }))}>Quitado</Opcao><Opcao ativa={dados.situacaoPatrimonial === "financiado"} onClick={() => setDados((a) => ({ ...a, situacaoPatrimonial: "financiado" }))}>Financiado</Opcao></div></Campo>
    </div>
  </ModalBase>;
}

export function ManutencaoDetalhesModal({ aberto, manutencao, onClose, formatarMoeda }) {
  if (!manutencao) return null;
  const itens = manutencao.itens || [];
  return <ModalBase aberto={aberto} onClose={onClose} titulo={manutencao.titulo || manutencao.descricao || "Manutenção"} descricao={`${formatarData(manutencao.data)}${manutencao.odometro ? ` · ${Number(manutencao.odometro).toLocaleString("pt-BR")} km` : ""}`} largura="max-w-2xl">
    <div className="space-y-4">
      {itens.length ? itens.map((item) => <div key={item.id} className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-black">{item.descricao}</p><p className="mt-1 text-sm text-gray-400">Quantidade: {Number(item.quantidade || 0).toLocaleString("pt-BR")}</p></div>{item.valor_estimado != null && <p className="font-black">{formatarMoeda(item.valor_estimado)}</p>}</div>{item.observacoes && <p className="mt-3 text-sm text-gray-400">{item.observacoes}</p>}</div>) : <p className="rounded-2xl border border-dashed border-gray-700 p-5 text-sm text-gray-400">Este registro não possui peças, óleo, quantidades ou observações detalhadas cadastradas.</p>}
      {manutencao.observacoes && <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4"><p className="text-xs text-gray-500">Observações</p><p className="mt-1 text-sm">{manutencao.observacoes}</p></div>}
    </div>
  </ModalBase>;
}

export function ConsumoCombustivelModal({ aberto, consumo, onClose }) {
  return <ModalBase aberto={aberto} onClose={onClose} titulo={`Tipo de combustível · ${consumo?.nome || ""}`} descricao="Abastecimentos e consumo calculado em cada ciclo." largura="max-w-2xl">
    <div className="space-y-3">{(consumo?.detalhes || []).map((item) => <div key={item.id} className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4 grid grid-cols-2 sm:grid-cols-4 gap-3"><Info label="Data" valor={formatarData(item.data)} /><Info label="Valor" valor={formatarMoeda(item.valor)} /><Info label="Litros" valor={`${Number(item.quantidade || 0).toLocaleString("pt-BR")} L`} /><Info label="Consumo do ciclo" valor={item.consumo ? `${item.consumo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${consumo.unidadeConsumo}` : "Base insuficiente"} /></div>)}{!consumo?.detalhes?.length && <p className="text-sm text-gray-400">Nenhum abastecimento deste combustível.</p>}</div>
  </ModalBase>;
}

function dadosDocumento(tipo, documento) { return documento ? { id: documento.id, tipo, ano: String(documento.ano), valor: String(Number(documento.valor || 0)), status: documento.status, dataPagamento: documento.data_pagamento || "" } : { id: null, tipo, ano: String(new Date().getFullYear()), valor: "", status: "pendente", dataPagamento: "" }; }
function dadosAquisicao(aquisicao, situacaoPatrimonial) { return { valorPago: aquisicao?.valor_pago == null ? "" : String(aquisicao.valor_pago), formaAquisicao: aquisicao?.forma_aquisicao || "", situacaoPatrimonial: situacaoPatrimonial || "" }; }
function numero(valor) { return valor.replace(/[^\d,.]/g, "").replace(",", "."); }
function formatarMoeda(valor) { return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatarData(valor) { if (!valor) return "-"; const [a, m, d] = valor.split("-"); return `${d}/${m}/${a}`; }
function Acoes({ onCancelar, onSalvar, salvando }) { return <div className="grid grid-cols-2 gap-3"><button type="button" onClick={onCancelar} className="rounded-xl border border-gray-700 p-3 font-bold">Cancelar</button><button type="button" onClick={onSalvar} disabled={salvando} className="rounded-xl bg-green-500 p-3 font-bold text-black disabled:opacity-50">{salvando ? "Salvando..." : "Salvar"}</button></div>; }
function Campo({ label, erro, shakeKey, children }) { return <div><label className={`text-sm font-semibold ${erro ? "text-red-400" : "text-gray-300"}`}>{label}</label>{children}{erro && <p key={shakeKey} className="animate-shake mt-2 text-xs font-semibold text-red-400">{erro}</p>}</div>; }
function Opcao({ ativa, onClick, children }) { return <button type="button" aria-pressed={ativa} onClick={onClick} className={`rounded-xl border p-3 font-bold ${ativa ? "border-green-400 bg-green-500/10 text-green-300" : "border-gray-700 text-gray-300"}`}>{children}</button>; }
function Info({ label, valor }) { return <div><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-sm font-bold">{valor}</p></div>; }
function classeInput(erro) { return `mt-2 w-full rounded-xl border bg-[#0B1120] p-3 outline-none focus:border-green-400 ${erro ? "border-red-500" : "border-gray-700"}`; }
