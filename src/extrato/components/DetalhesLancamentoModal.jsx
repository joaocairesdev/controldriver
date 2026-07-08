import { FiEdit2, FiTrash2, FiTrendingUp, FiArrowRight } from "react-icons/fi";
import { obterConfigPlataforma } from "../../utils/plataformasIcons";
import ModalBase from "../../components/modals/ModalBase";

export default function DetalhesLancamentoModal({
  aberto,
  lancamento,
  fechar,
  editar,
  editarTurno,
  pedirExclusao,
  formatarMoeda,
  formatarData,
  formatarHoraSemSegundos,
}) {
  if (!aberto || !lancamento) return null;

  const dados = lancamento.dadosOriginais || {};
  const abastecimento = dados.abastecimento;
  const recargaEletrica = dados.recargaEletrica;
  const manutencao = dados.manutencao;
  const tag = dados.tag;

  const isGrupoEntrada = lancamento.tipo === "entrada_agrupada";
  const isEntrada = lancamento.tipo === "entrada";
  const isEntradaAvulsa = lancamento.tipo === "entrada_avulsa";
  const isTransferencia = lancamento.tipo === "transferencia";
  const isContaPagar = lancamento.tipo === "conta_pagar";
  const isSaida = lancamento.tipo === "saida";
  const isSaidaOuConta = isSaida || isContaPagar;

  const sinalValor = isEntrada || isEntradaAvulsa || isGrupoEntrada ? "+" : isSaida ? "-" : "";
  const corValor = isEntrada || isEntradaAvulsa || isGrupoEntrada
    ? "text-green-400"
    : isTransferencia || isContaPagar
      ? "text-blue-400"
      : "text-red-400";

  return (
    <ModalBase
      aberto={aberto}
      titulo={isGrupoEntrada ? "Ganhos do dia" : lancamento.titulo}
      descricao={`${formatarData(lancamento.data)} • ${lancamento.descricao || "Lançamento"}`}
      onClose={fechar}
      largura="max-w-2xl"
      acaoCabecalho={
        !isGrupoEntrada ? (
          <button
            type="button"
            onClick={pedirExclusao}
            className="w-10 h-10 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold flex items-center justify-center"
            title="Excluir"
            aria-label="Excluir lançamento"
          >
            <FiTrash2 />
          </button>
        ) : null
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">
            {isGrupoEntrada ? "Total agrupado" : isTransferencia ? "Valor movimentado" : "Valor"}
          </p>
          <p className={`text-3xl font-black mt-2 ${corValor}`}>
            {sinalValor} {formatarMoeda(lancamento.valor)}
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoLinha titulo="Data" valor={formatarData(lancamento.data)} />
            {isTransferencia ? (
              <InfoLinha
                titulo="Movimentação"
                valor={`${lancamento.contaOrigem || "Origem"} → ${lancamento.contaDestino || "Destino"}`}
              />
            ) : isEntrada || isEntradaAvulsa || isGrupoEntrada ? (
              <InfoLinha titulo="Destino" valor={lancamento.contaDestino || "Conta"} />
            ) : (
              <InfoLinha
                titulo={isContaPagar ? "Vencimento" : "Conta / Cartão"}
                valor={isContaPagar ? formatarData(dados.data_vencimento) : dados.contaOrigem || "-"}
              />
            )}
          </div>
        </div>

        {isGrupoEntrada && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black">Turnos do dia</h3>
              <span className="text-xs text-gray-500 font-bold">
                {dados.turnos?.length || 0} lançamento(s)
              </span>
            </div>

            {(dados.turnos || []).map((turno, index) => (
              <TurnoCard
                key={turno.id || index}
                turno={turno}
                index={index}
                editarTurno={editarTurno}
                formatarMoeda={formatarMoeda}
                formatarHoraSemSegundos={formatarHoraSemSegundos}
              />
            ))}
          </div>
        )}

        {isEntrada && (
          <DetalhesEntrada
            dados={dados}
            formatarMoeda={formatarMoeda}
            formatarHoraSemSegundos={formatarHoraSemSegundos}
          />
        )}

        {isEntradaAvulsa && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetalheItem titulo="Tipo" valor="Entrada avulsa" />
            {dados.finalidade ? (
              <DetalheItem
                titulo="Finalidade"
                valor={dados.finalidade === "pessoal" ? "Pessoal" : "Trabalho"}
              />
            ) : null}
            <DetalheItem titulo="Conta" valor={lancamento.contaDestino || "-"} />
            <DetalheItem titulo="Descrição" valor={dados.descricao || lancamento.descricao || "-"} />
          </div>
        )}

        {isTransferencia && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetalheItem titulo="Origem" valor={lancamento.contaOrigem || "-"} />
            <DetalheItem titulo="Destino" valor={lancamento.contaDestino || "-"} />
            <DetalheItem titulo="Descrição" valor={dados.descricao || lancamento.descricao || "-"} />
          </div>
        )}

        {isSaidaOuConta && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetalheItem titulo="Categoria" valor={dados.categoria || "-"} />
              <DetalheItem
                titulo="Forma"
                valor={isContaPagar ? `Contas a pagar - ${dados.formaPagamentoTexto || "Boleto"}` : dados.formaPagamentoTexto || "-"}
              />
              <DetalheItem titulo="Status" valor={dados.status || "-"} />
              <DetalheItem titulo="Descrição" valor={dados.descricao || dados.categoria || "-"} />
            </div>

            {abastecimento && (
              <SecaoEspecial titulo="Abastecimento">
                <DetalheItem titulo="Combustível" valor={abastecimento.tipo_combustivel || "-"} />
                <DetalheItem titulo="Litros" valor={`${Number(abastecimento.litros || 0).toFixed(3)} L`} />
                <DetalheItem titulo="Valor/L" valor={formatarMoeda(abastecimento.valor_litro || 0)} />
                <DetalheItem titulo="Odômetro" valor={`${Number(abastecimento.odometro || 0).toLocaleString("pt-BR")} km`} />
                <DetalheItem titulo="KM rodados" valor={`${Number(abastecimento.km_rodados || 0).toLocaleString("pt-BR")} km`} />
                <DetalheItem
                  titulo="Consumo"
                  valor={abastecimento.consumo_km_l ? `${Number(abastecimento.consumo_km_l).toFixed(2)} km/L` : "-"}
                />
              </SecaoEspecial>
            )}

            {recargaEletrica && (
              <SecaoEspecial titulo="Recarga elétrica">
                <DetalheItem titulo="KWh" valor={`${Number(recargaEletrica.kwh || 0).toLocaleString("pt-BR")} kWh`} />
                <DetalheItem titulo="Valor/kWh" valor={formatarMoeda(recargaEletrica.valor_kwh || 0)} />
                <DetalheItem titulo="KM rodados" valor={`${Number(recargaEletrica.km_rodados || 0).toLocaleString("pt-BR")} km`} />
              </SecaoEspecial>
            )}

            {manutencao && (
              <SecaoEspecial titulo="Manutenção">
                <DetalheItem titulo="Tipo" valor={manutencao.tipo_manutencao || "-"} />
                <DetalheItem titulo="Serviço" valor={manutencao.servico || "-"} />
                <DetalheItem titulo="Oficina" valor={manutencao.oficina || "-"} />
                <DetalheItem titulo="Odômetro" valor={`${Number(manutencao.odometro || 0).toLocaleString("pt-BR")} km`} />
              </SecaoEspecial>
            )}

            {tag && (
              <SecaoEspecial titulo="TAG">
                <DetalheItem titulo="Tipo" valor={tag.tipo_uso || tag.tipo || "-"} />
                <DetalheItem titulo="Local" valor={tag.local || tag.descricao || "-"} />
                <DetalheItem titulo="Veículo" valor={tag.veiculo_nome || "-"} />
              </SecaoEspecial>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          {!isGrupoEntrada ? (
            <button
              type="button"
              onClick={editar}
              className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3 flex items-center justify-center gap-2"
            >
              <FiEdit2 /> Editar
            </button>
          ) : (
            <button
              type="button"
              onClick={fechar}
              className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
            >
              Voltar
            </button>
          )}

          <button
            type="button"
            onClick={fechar}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

function DetalhesEntrada({ dados, formatarMoeda, formatarHoraSemSegundos }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DetalheItem titulo="KM rodados" valor={`${dados.km_rodados || 0} km`} />
        <DetalheItem titulo="Horas trabalhadas" valor={formatarHoraSemSegundos(dados.horas_trabalhadas)} />
      </div>

      <h3 className="font-black pt-1">Plataformas</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(dados.entrada_plataformas || []).map((item, index) => {
          const nomePlataforma = item.plataformas?.nome || "Plataforma";
          const config = obterConfigPlataforma(nomePlataforma);
          const valorCorridas = Number(item.faturamento || 0);
          const valorPedagio = Number(item.valor_reembolso || 0);
          const total = valorCorridas + valorPedagio;

          return (
            <div key={item.id || index} className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
              <div className="flex justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {config?.imagem ? (
                    <img src={config.imagem} alt={nomePlataforma} className="w-12 h-12 object-contain shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-700 rounded-xl shrink-0 flex items-center justify-center text-gray-400">
                      <FiTrendingUp />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{nomePlataforma}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.numero_corridas || 0} corrida(s)</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-green-400 whitespace-nowrap">{formatarMoeda(total)}</p>
              </div>

              {valorPedagio > 0 && (
                <div className="mt-3 text-xs text-gray-500 flex justify-between gap-3">
                  <span>Reembolso de pedágio</span>
                  <span>{formatarMoeda(valorPedagio)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TurnoCard({ turno, index, editarTurno, formatarMoeda, formatarHoraSemSegundos }) {
  const dados = turno.dadosOriginais || {};

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Turno {index + 1}</p>
          <h4 className="font-black mt-1 truncate">{turno.descricao || "Plataformas"}</h4>
          <p className="text-xs text-gray-500 mt-1">
            {dados.km_rodados || 0} km • {formatarHoraSemSegundos(dados.horas_trabalhadas)} • {turno.contaDestino || "Conta"}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="font-black text-green-400">+ {formatarMoeda(turno.valor)}</p>
          <button
            type="button"
            onClick={() => editarTurno?.(turno)}
            className="mt-2 text-xs text-green-400 hover:text-green-300 font-bold inline-flex items-center gap-1"
          >
            Editar <FiArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

function SecaoEspecial({ titulo, children }) {
  return (
    <div className="space-y-3">
      <h3 className="font-black pt-1">{titulo}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function InfoLinha({ titulo, valor }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="text-sm font-bold text-white mt-1 break-words">{valor || "-"}</p>
    </div>
  );
}

function DetalheItem({ titulo, valor, destaque }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p
        className={`font-bold mt-1 break-words ${
          destaque === "green"
            ? "text-green-400"
            : destaque === "red"
              ? "text-red-400"
              : destaque === "blue"
                ? "text-blue-400"
                : "text-white"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
