import { useEffect, useMemo, useState } from "react";
import ModalBase from "../../../shared/components/modals/ModalBase";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import SelecionarParcelasModal from "../../../shared/components/modals/SelecionarParcelasModal";

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

  tipoProtecaoVeiculo,
  setTipoProtecaoVeiculo,
  nomeProtecaoVeiculo,
  setNomeProtecaoVeiculo,
  inicioVigenciaProtecao,
  setInicioVigenciaProtecao,
  fimVigenciaProtecao,
  setFimVigenciaProtecao,
  formaPagamentoProtecao,
  setFormaPagamentoProtecao,
  valorProtecao,
  setValorProtecao,
  numeroParcelasProtecao,
  setNumeroParcelasProtecao,
  parcelasPagasProtecao,
  setParcelasPagasProtecao,
  primeiroVencimentoProtecao,
  setPrimeiroVencimentoProtecao,
  contaProtecaoId,
  setContaProtecaoId,
  cartaoProtecaoId,
  setCartaoProtecaoId,

  contasBanco,
  cartoes,
  formasRecargaTag,
  textoFormaRecargaTag,
  textoContaRecargaTag,
  textoCartaoRecargaTag,
  formasPagamentoProtecao,
  textoFormaPagamentoProtecao,
  textoContaProtecao,
  textoCartaoProtecao,
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  somenteNumeros,
}) {
  const [etapa, setEtapa] = useState(1);

  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);

  const [modalInicioVigenciaAberto, setModalInicioVigenciaAberto] = useState(false);
  const [modalFimVigenciaAberto, setModalFimVigenciaAberto] = useState(false);
  const [modalPrimeiroVencimentoAberto, setModalPrimeiroVencimentoAberto] = useState(false);
  const [modalFormaProtecaoAberto, setModalFormaProtecaoAberto] = useState(false);
  const [modalContaProtecaoAberto, setModalContaProtecaoAberto] = useState(false);
  const [modalCartaoProtecaoAberto, setModalCartaoProtecaoAberto] = useState(false);
  const [modalParcelasProtecaoAberto, setModalParcelasProtecaoAberto] = useState(false);

  const [modalFormaRecargaTagAberto, setModalFormaRecargaTagAberto] = useState(false);
  const [modalContaRecargaTagAberto, setModalContaRecargaTagAberto] = useState(false);
  const [modalCartaoRecargaTagAberto, setModalCartaoRecargaTagAberto] = useState(false);

  const temProtecao = tipoProtecaoVeiculo !== "nenhuma";
  const protecaoParcelada = ["credito_parcelado", "boleto_parcelado"].includes(formaPagamentoProtecao);
  const protecaoUsaConta = ["pix", "debito", "dinheiro"].includes(formaPagamentoProtecao);
  const protecaoUsaCartao = ["credito_avista", "credito_parcelado"].includes(formaPagamentoProtecao);
  const tagPrePaga = tipoTag === "pre_paga";
  const tagPosPaga = tipoTag === "pos_paga";


  const tituloEtapa = useMemo(() => {
    if (etapa === 1) return "Cadastro do veículo";
    if (etapa === 2) return "Proteção";
    return "TAG do veículo";
  }, [etapa]);

  const descricaoEtapa = useMemo(() => {
    if (etapa === 1) return "Informe os dados principais do carro.";
    if (etapa === 2) return "Informe se o carro possui proteção e como ela será controlada no financeiro.";
    return "Configure a TAG vinculada ao veículo, se existir.";
  }, [etapa]);

  useEffect(() => {
    if (aberto) setEtapa(1);
  }, [aberto, veiculoEditando?.id]);

  if (!aberto) return null;

  function selecionarCategoria(valor) {
    onSelecionarCategoria?.(valor);
    setModalCategoriaAberto(false);
  }

  function formatarDataBR(dataISO) {
    if (!dataISO) return "Selecionar data";
    const [ano, mes, dia] = String(dataISO).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function irProximaEtapa() {
    setEtapa((atual) => Math.min(atual + 1, 3));
  }

  function voltarEtapa() {
    setEtapa((atual) => Math.max(atual - 1, 1));
  }

  function selecionarFormaProtecao(valor) {
    setFormaPagamentoProtecao(valor);

    if (["credito_avista", "credito_parcelado"].includes(valor)) {
      setContaProtecaoId("");
    } else {
      setCartaoProtecaoId("");
    }

    if (!["credito_parcelado", "boleto_parcelado"].includes(valor)) {
      setNumeroParcelasProtecao("1");
      setParcelasPagasProtecao("0");
    } else if (Number(numeroParcelasProtecao || 0) < 2) {
      setNumeroParcelasProtecao("12");
    }
  }

  function selecionarFormaRecargaTag(valor) {
    setFormaRecargaTag(valor);

    if (valor === "credito_avista") {
      setContaRecargaTagId("");
    } else {
      setCartaoRecargaTagId("");
    }
  }

  function alternarProtecao() {
    setTipoProtecaoVeiculo(temProtecao ? "nenhuma" : "protecao_veicular");
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={veiculoEditando ? "Editar Veículo" : "Novo Veículo"}
        descricao={descricaoEtapa}
        onClose={onClose}
        largura="max-w-2xl"
        z="z-[50]"
      
        confirmarAoFecharSeAlterado>
        <div>
          <IndicadorEtapas etapa={etapa} />

          {etapa === 1 && (
            <section className="mt-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white">Veículo</h3>
                <p className="text-gray-400 text-sm mt-1">Informe os dados principais do carro.</p>
              </div>
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
                <CampoTextoComSufixo
                  label="KM Inicial"
                  value={odometroInicial}
                  placeholder="Ex: 125000"
                  suffix="km"
                  inputMode="numeric"
                  onChange={(valor) => setOdometroInicial(somenteNumeros(valor))}
                />

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
            </section>
          )}

          {etapa === 2 && (
            <section className="mt-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white">Proteção</h3>
                <p className="text-gray-400 text-sm mt-1">Informe se o carro possui proteção e como ela será controlada no financeiro.</p>
              </div>
              <div className="bg-[#0B1120] border border-gray-700 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-white">Possui proteção?</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Ative apenas se quiser controlar essa despesa no financeiro.
                    </p>
                  </div>

                  <SwitchButton ativo={temProtecao} onClick={alternarProtecao} />
                </div>

                {temProtecao && (
                  <div className="mt-5 space-y-4">
                    <InputTexto
                      label="Nome da proteção"
                      value={nomeProtecaoVeiculo}
                      placeholder="Ex: Suhai, Porto Seguro, APVS"
                      onChange={setNomeProtecaoVeiculo}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <CampoDataBotao
                        label="Início da vigência"
                        value={inicioVigenciaProtecao}
                        formatarDataBR={formatarDataBR}
                        onClick={() => setModalInicioVigenciaAberto(true)}
                      />

                      <CampoDataBotao
                        label="Fim da vigência"
                        value={fimVigenciaProtecao}
                        formatarDataBR={formatarDataBR}
                        onClick={() => setModalFimVigenciaAberto(true)}
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-300">Forma de pagamento</label>

                      <button
                        type="button"
                        onClick={() => setModalFormaProtecaoAberto(true)}
                        className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                      >
                        {textoFormaPagamentoProtecao(formaPagamentoProtecao)}
                      </button>
                    </div>

                    {protecaoUsaConta && (
                      <div>
                        <label className="text-sm text-gray-300">Conta usada no pagamento</label>

                        <button
                          type="button"
                          onClick={() => setModalContaProtecaoAberto(true)}
                          className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                        >
                          {textoContaProtecao(contaProtecaoId)}
                        </button>
                      </div>
                    )}

                    {protecaoUsaCartao && (
                      <div>
                        <label className="text-sm text-gray-300">Cartão usado no pagamento</label>

                        <button
                          type="button"
                          onClick={() => setModalCartaoProtecaoAberto(true)}
                          className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                        >
                          {textoCartaoProtecao(cartaoProtecaoId)}
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <CampoMoeda
                        label={protecaoParcelada ? "Valor da parcela" : "Valor total"}
                        value={valorProtecao}
                        placeholder="0,00"
                        onChange={(valor) => setValorProtecao(formatarMoedaDigitada(valor))}
                      />

                      <CampoDataBotao
                        label="Próximo vencimento em aberto"
                        value={primeiroVencimentoProtecao}
                        formatarDataBR={formatarDataBR}
                        onClick={() => setModalPrimeiroVencimentoAberto(true)}
                      />
                    </div>

                    {protecaoParcelada && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-300">Total de parcelas</label>
                          <button
                            type="button"
                            onClick={() => setModalParcelasProtecaoAberto(true)}
                            className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                          >
                            {numeroParcelasProtecao || "Selecionar"}x
                          </button>
                        </div>

                        <InputTexto
                          label="Parcelas já pagas"
                          value={parcelasPagasProtecao}
                          placeholder="Ex: 5"
                          onChange={(valor) => setParcelasPagasProtecao(somenteNumeros(valor))}
                        />
                      </div>
                    )}

                    {valorProtecao && Number(moedaParaNumero(valorProtecao)) > 0 && (
                      <div className="bg-[#111827] border border-gray-800 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Resumo da proteção</p>
                        <p className="text-sm text-gray-300 mt-1">
                          {protecaoParcelada
                            ? `O app vai considerar ${parcelasPagasProtecao || 0} de ${numeroParcelasProtecao || 0} parcelas já pagas e gerar apenas as próximas em aberto.`
                            : "O app vai registrar a proteção conforme a forma de pagamento escolhida."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {etapa === 3 && (
            <section className="mt-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white">TAG</h3>
                <p className="text-gray-400 text-sm mt-1">Configure a TAG vinculada ao veículo, se existir.</p>
              </div>
              <div className="bg-[#0B1120] border border-gray-700 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-white">Possui TAG?</p>
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
                      label={tagPosPaga ? "Saldo/debito inicial da TAG" : "Saldo inicial da TAG"}
                      value={saldoInicialTag}
                      placeholder="0,00 ou -15,00"
                      onChange={(valor) => setSaldoInicialTag(formatarMoedaDigitada(valor, true))}
                    />

                    {tagPosPaga && (
                      <div className="border border-gray-700 rounded-2xl p-4 space-y-4">
                        <div>
                          <p className="font-bold text-white">Pagamento da TAG pós-paga</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Defina onde a cobrança mensal da TAG será lançada.
                          </p>
                        </div>

                        <div>
                          <label className="text-sm text-gray-300">Forma de pagamento</label>

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
                      </div>
                    )}

                    {tagPrePaga && (
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

                              <CampoTextoComSufixo
                                label="Gatilho"
                                value={percentualGatilhoTag}
                                placeholder="30"
                                suffix="%"
                                inputMode="numeric"
                                onChange={(valor) =>
                                  setPercentualGatilhoTag(
                                    somenteNumeros(valor).slice(0, 3)
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label className="text-sm text-gray-300">Forma de pagamento da recarga:</label>

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
            </section>
          )}

          <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 -mx-1 pt-4 pb-1 bg-[#111827]">
            {etapa > 1 ? (
              <button
                type="button"
                onClick={voltarEtapa}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Voltar
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>
            )}

            {etapa < 3 ? (
              <button
                type="button"
                onClick={irProximaEtapa}
                className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                Próximo
              </button>
            ) : (
              <button
                type="button"
                onClick={onSalvar}
                className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                {veiculoEditando ? "Salvar Alterações" : "Salvar"}
              </button>
            )}
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

      <DatePickerModal
        aberto={modalInicioVigenciaAberto}
        valor={inicioVigenciaProtecao}
        onChange={setInicioVigenciaProtecao}
        onClose={() => setModalInicioVigenciaAberto(false)}
        titulo="Início da vigência"
        descricao="Escolha quando a proteção começou."
      />

      <DatePickerModal
        aberto={modalFimVigenciaAberto}
        valor={fimVigenciaProtecao}
        onChange={setFimVigenciaProtecao}
        onClose={() => setModalFimVigenciaAberto(false)}
        titulo="Fim da vigência"
        descricao="Escolha quando a proteção termina."
      />

      <DatePickerModal
        aberto={modalPrimeiroVencimentoAberto}
        valor={primeiroVencimentoProtecao}
        onChange={setPrimeiroVencimentoProtecao}
        onClose={() => setModalPrimeiroVencimentoAberto(false)}
        titulo="Próximo vencimento em aberto"
        descricao="Escolha o vencimento da próxima parcela que ainda precisa controlar."
      />

      <SelecionarFormaPagamentoModal
        aberto={modalFormaProtecaoAberto}
        formasPagamento={formasPagamentoProtecao}
        formaPagamento={formaPagamentoProtecao}
        onSelecionar={selecionarFormaProtecao}
        onClose={() => setModalFormaProtecaoAberto(false)}
      />

      <SelecionarContaModal
        aberto={modalContaProtecaoAberto}
        contas={contasBanco}
        contaId={contaProtecaoId}
        onSelecionar={setContaProtecaoId}
        onClose={() => setModalContaProtecaoAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartaoProtecaoAberto}
        cartoes={cartoes}
        cartaoId={cartaoProtecaoId}
        onSelecionar={setCartaoProtecaoId}
        onClose={() => setModalCartaoProtecaoAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarParcelasModal
        aberto={modalParcelasProtecaoAberto}
        numeroParcelas={numeroParcelasProtecao}
        onSelecionar={setNumeroParcelasProtecao}
        onClose={() => setModalParcelasProtecaoAberto(false)}
      />

      <SelecionarFormaPagamentoModal
        aberto={modalFormaRecargaTagAberto}
        formasPagamento={formasRecargaTag}
        formaPagamento={formaRecargaTag}
        onSelecionar={selecionarFormaRecargaTag}
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

function IndicadorEtapas({ etapa }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-6">
      {Array.from({ length: 3 }, (_, index) => {
        const ativo = etapa >= index + 1;

        return (
          <div
            key={index + 1}
            className={`h-2 rounded-full ${ativo ? "bg-green-500" : "bg-gray-800"}`}
          />
        );
      })}
    </div>
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

function CampoTextoComSufixo({
  label,
  value,
  placeholder,
  suffix,
  inputMode = "text",
  onChange,
}) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>

      <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden focus-within:border-green-400">
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent p-3 outline-none"
        />

        {suffix ? <span className="px-3 text-gray-400">{suffix}</span> : null}
      </div>
    </div>
  );
}

function CampoDataBotao({ label, value, onClick, formatarDataBR }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>

      <button
        type="button"
        onClick={onClick}
        className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
      >
        {formatarDataBR(value)}
      </button>
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

