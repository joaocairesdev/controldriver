import { useState } from "react";
import ModalBase from "./ModalBase";
import SelecionarFormaPagamentoModal from "./SelecionarFormaPagamentoModal";
import SelecionarContaModal from "./SelecionarContaModal";
import SelecionarCartaoModal from "./SelecionarCartaoModal";

export default function VeiculoModal({
  aberto,
  veiculoEditando,
  categoriasVeiculo,
  categoriaVeiculo,
  nomeCategoria,
  onSelecionarCategoria,
  onClose,
  onSalvar,

  marca,
  setMarca,
  modelo,
  setModelo,
  ano,
  setAno,
  placa,
  setPlaca,
  odometroInicial,
  setOdometroInicial,

  possuiTag,
  setPossuiTag,
  nomeTag,
  setNomeTag,
  tipoTag,
  setTipoTag,
  saldoInicialTag,
  setSaldoInicialTag,
  recargaAutomaticaTag,
  setRecargaAutomaticaTag,
  valorRecargaTag,
  setValorRecargaTag,
  percentualGatilhoTag,
  setPercentualGatilhoTag,
  formaRecargaTag,
  setFormaRecargaTag,
  contaRecargaTagId,
  setContaRecargaTagId,
  cartaoRecargaTagId,
  setCartaoRecargaTagId,

  contasBanco,
  cartoes,
  formasRecargaTag,
  textoFormaRecargaTag,
  textoContaRecargaTag,
  textoCartaoRecargaTag,
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  somenteNumeros,
}) {
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [modalFormaRecargaTagAberto, setModalFormaRecargaTagAberto] = useState(false);
  const [modalContaRecargaTagAberto, setModalContaRecargaTagAberto] = useState(false);
  const [modalCartaoRecargaTagAberto, setModalCartaoRecargaTagAberto] = useState(false);

  if (!aberto) return null;

  function selecionarCategoria(valor) {
    onSelecionarCategoria?.(valor);
    setModalCategoriaAberto(false);
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={veiculoEditando ? "Editar Veículo" : "Novo Veículo"}
        descricao={
          veiculoEditando
            ? "Altere os dados do veículo cadastrado."
            : "Cadastre um veículo para controlar km, consumo, histórico e TAG."
        }
        onClose={onClose}
        largura="max-w-2xl"
        z="z-[50]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputTexto
              label="Marca"
              value={marca}
              placeholder="Ex: Nissan"
              onChange={setMarca}
            />

            <InputTexto
              label="Modelo"
              value={modelo}
              placeholder="Ex: Versa"
              onChange={setModelo}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputTexto
              label="Ano"
              value={ano}
              placeholder="Ex: 2019"
              onChange={(valor) => setAno(somenteNumeros(valor).slice(0, 4))}
            />

            <InputTexto
              label="Placa"
              value={placa}
              placeholder="Ex: ABC1D23"
              onChange={(valor) => setPlaca(valor.toUpperCase().slice(0, 8))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-300">KM Inicial</label>

              <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden focus-within:border-green-400">
                <input
                  type="text"
                  inputMode="numeric"
                  value={odometroInicial}
                  placeholder="Ex: 125000"
                  onChange={(e) => setOdometroInicial(somenteNumeros(e.target.value))}
                  className="w-full bg-transparent p-3 outline-none"
                />

                <span className="px-3 text-gray-400">km</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300">Categoria do veículo</label>

              <button
                type="button"
                onClick={() => setModalCategoriaAberto(true)}
                className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
              >
                {nomeCategoria(categoriaVeiculo)}
              </button>
            </div>
          </div>

          <div className="bg-[#0B1120] border border-gray-700 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-white">Este veículo possui TAG?</p>
                <p className="text-xs text-gray-400 mt-1">
                  A TAG fica vinculada à placa deste veículo.
                </p>
              </div>

              <SwitchButton ativo={possuiTag} onClick={() => setPossuiTag(!possuiTag)} />
            </div>

            {possuiTag && (
              <div className="mt-5 space-y-4">
                <InputTexto
                  label="Nome da TAG"
                  value={nomeTag}
                  placeholder="Ex: Veloe"
                  onChange={setNomeTag}
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoTag("pre_paga")}
                    className={`rounded-xl border p-3 font-bold ${
                      tipoTag === "pre_paga"
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : "border-gray-700 text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    Pré-paga
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTipoTag("pos_paga");
                      setRecargaAutomaticaTag(false);
                    }}
                    className={`rounded-xl border p-3 font-bold ${
                      tipoTag === "pos_paga"
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : "border-gray-700 text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    Pós-paga
                  </button>
                </div>

                <CampoMoeda
                  label="Saldo inicial da TAG"
                  value={saldoInicialTag}
                  placeholder="0,00 ou -15,00"
                  onChange={(valor) => setSaldoInicialTag(formatarMoedaDigitada(valor, true))}
                />

                {tipoTag === "pre_paga" && (
                  <div className="border border-gray-700 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-white">Recarga automática</p>
                        <p className="text-xs text-gray-400 mt-1">
                          O app vai sugerir a recarga quando o uso atingir o gatilho.
                        </p>
                      </div>

                      <SwitchButton
                        ativo={recargaAutomaticaTag}
                        onClick={() => setRecargaAutomaticaTag(!recargaAutomaticaTag)}
                      />
                    </div>

                    {recargaAutomaticaTag && (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <CampoMoeda
                            label="Valor da recarga"
                            value={valorRecargaTag}
                            placeholder="30,00"
                            onChange={(valor) => setValorRecargaTag(formatarMoedaDigitada(valor))}
                          />

                          <div>
                            <label className="text-sm text-gray-300">Gatilho (%)</label>

                            <input
                              type="text"
                              inputMode="numeric"
                              value={percentualGatilhoTag}
                              placeholder="30"
                              onChange={(e) =>
                                setPercentualGatilhoTag(
                                  somenteNumeros(e.target.value).slice(0, 3)
                                )
                              }
                              className="w-full mt-2 bg-[#111827] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-gray-300">Recarga automática em:</label>

                          <button
                            type="button"
                            onClick={() => setModalFormaRecargaTagAberto(true)}
                            className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                          >
                            {textoFormaRecargaTag(formaRecargaTag)}
                          </button>
                        </div>

                        {formaRecargaTag === "credito_avista" ? (
                          <div>
                            <label className="text-sm text-gray-300">Cartão vinculado</label>

                            <button
                              type="button"
                              onClick={() => setModalCartaoRecargaTagAberto(true)}
                              className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                            >
                              {textoCartaoRecargaTag(cartaoRecargaTagId)}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <label className="text-sm text-gray-300">Conta vinculada</label>

                            <button
                              type="button"
                              onClick={() => setModalContaRecargaTagAberto(true)}
                              className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                            >
                              {textoContaRecargaTag(contaRecargaTagId)}
                            </button>
                          </div>
                        )}

                        {valorRecargaTag && Number(moedaParaNumero(valorRecargaTag)) > 0 && (
                          <div className="bg-[#111827] border border-gray-800 rounded-xl p-3">
                            <p className="text-xs text-gray-500">Resumo da recarga automática</p>
                            <p className="text-sm text-gray-300 mt-1">
                              Valor padrão:{" "}
                              <span className="font-bold text-green-400">
                                {formatarMoeda(moedaParaNumero(valorRecargaTag))}
                              </span>
                              . Gatilho:{" "}
                              <span className="font-bold text-white">
                                {percentualGatilhoTag || 30}%
                              </span>
                              .
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 -mx-1 pt-4 pb-1 bg-[#111827]">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onSalvar}
              className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              {veiculoEditando ? "Salvar Alterações" : "Salvar"}
            </button>
          </div>
        </div>
      </ModalBase>

      <ModalBase
        aberto={modalCategoriaAberto}
        titulo="Categoria do veículo"
        descricao="Isso define automaticamente combustíveis e recarga elétrica."
        onClose={() => setModalCategoriaAberto(false)}
        z="z-[60]"
        largura="max-w-md"
      >
        <div className="space-y-3">
          {categoriasVeiculo.map((item) => (
            <button
              key={item.valor}
              type="button"
              onClick={() => selecionarCategoria(item.valor)}
              className={`w-full text-left rounded-xl border p-4 ${
                categoriaVeiculo === item.valor
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
              }`}
            >
              <p className="font-bold">{item.nome}</p>
              <p className="text-xs text-gray-400 mt-1">{item.descricao}</p>
            </button>
          ))}
        </div>
      </ModalBase>

      <SelecionarFormaPagamentoModal
        aberto={modalFormaRecargaTagAberto}
        formasPagamento={formasRecargaTag}
        formaPagamento={formaRecargaTag}
        onSelecionar={(valor) => {
          setFormaRecargaTag(valor);
          if (valor === "credito_avista") setContaRecargaTagId("");
          else setCartaoRecargaTagId("");
        }}
        onClose={() => setModalFormaRecargaTagAberto(false)}
      />

      <SelecionarContaModal
        aberto={modalContaRecargaTagAberto}
        contas={contasBanco}
        contaId={contaRecargaTagId}
        onSelecionar={setContaRecargaTagId}
        onClose={() => setModalContaRecargaTagAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartaoRecargaTagAberto}
        cartoes={cartoes}
        cartaoId={cartaoRecargaTagId}
        onSelecionar={setCartaoRecargaTagId}
        onClose={() => setModalCartaoRecargaTagAberto(false)}
        formatarMoeda={formatarMoeda}
      />
    </>
  );
}

function InputTexto({ label, value, placeholder, onChange }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
      />
    </div>
  );
}

function CampoMoeda({ label, value, placeholder, onChange }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>

      <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden focus-within:border-green-400">
        <span className="px-3 text-gray-400">R$</span>

        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent p-3 outline-none"
        />
      </div>
    </div>
  );
}

function SwitchButton({ ativo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-14 h-8 rounded-full transition shrink-0 ${
        ativo ? "bg-green-500" : "bg-gray-700"
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition ${
          ativo ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}
