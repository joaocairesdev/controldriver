import { obterConfigPlataforma } from "../../utils/plataformasIcons";

export default function DetalhesLancamentoModal({
  aberto,
  lancamento,
  fechar,
  editar,
  pedirExclusao,
  formatarMoeda,
  formatarData,
  formatarHoraSemSegundos,
}) {
  if (!aberto || !lancamento) return null;

  const dados = lancamento.dadosOriginais || {};
  const abastecimento = dados.abastecimento;
  const manutencao = dados.manutencao;
  const isContaPagar = lancamento.tipo === "conta_pagar";
  const isSaida = lancamento.tipo === "saida";
  const isEntrada = lancamento.tipo === "entrada";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">{formatarData(lancamento.data)}</p>
            <h2 className="text-2xl font-bold mt-1">{lancamento.titulo}</h2>
            <p className="text-gray-400 mt-1">{lancamento.descricao}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={pedirExclusao}
              className="w-10 h-10 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold"
              title="Excluir"
            >
              🗑️
            </button>

            <button
              type="button"
              onClick={fechar}
              className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {isEntrada && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DetalheItem
                titulo="Valor total"
                valor={`+ ${formatarMoeda(lancamento.valor)}`}
                destaque="green"
              />
              <DetalheItem titulo="KM rodados" valor={`${dados.km_rodados || 0} km`} />
              <DetalheItem
                titulo="Horas trabalhadas"
                valor={formatarHoraSemSegundos(dados.horas_trabalhadas)}
              />
            </div>
            <h3 className="font-bold pt-2">Plataformas</h3>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {(dados.entrada_plataformas || []).map((item, index) => {
  const nomePlataforma = item.plataformas?.nome || "Plataforma";
  const config = obterConfigPlataforma(nomePlataforma);

  const valorCorridas = Number(item.faturamento || 0);
  const valorPedagio = Number(item.valor_reembolso || 0);
  const total = valorCorridas + valorPedagio;

  const IconeFallback = config?.icon;

  return (
    <div
      key={index}
      className="bg-[#0B1120] border border-gray-800 rounded-xl p-4"
    >
      <div className="flex justify-between gap-4">
  <div className="flex items-center gap-3">
    {config?.imagem ? (
      <img
        src={config.imagem}
        alt={nomePlataforma}
        className="w-14 h-14 object-contain"
      />
    ) : (
      <div className="w-8 h-8 bg-gray-700 rounded-md" />
    )}

    <p className="font-semibold">
      {nomePlataforma}
    </p>
  </div>

  <p className="text-xl font-bold  text-green-400  whitespace-nowrap flex items-center">
    {formatarMoeda(total)}
  </p>
</div>

<div className="mt-10 space-y-1">
  <div className="flex justify-between text-white/50 text-sm">
    <span>{item.numero_corridas || 0} corridas</span>
    <span>{formatarMoeda(valorCorridas)}</span>
  </div>

  {valorPedagio > 0 && (
    <div className="flex justify-between text-white/50 text-sm">
      <span>Reembolso de Pedágio</span>
      <span>{formatarMoeda(valorPedagio)}</span>
    </div>
  )}
</div>
    </div>
  );
})}
</div>
          </div>
        )}

        {(isSaida || isContaPagar) && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DetalheItem
                titulo={isContaPagar ? "Valor registrado" : "Valor total"}
                valor={
                  isContaPagar
                    ? formatarMoeda(lancamento.valor)
                    : `- ${formatarMoeda(lancamento.valor)}`
                }
                destaque={isContaPagar ? "blue" : "red"}
              />
              <DetalheItem titulo="Categoria" valor={dados.categoria || "-"} />
              <DetalheItem titulo="Status" valor={dados.status || "-"} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetalheItem
                titulo="Forma"
                valor={
                  isContaPagar
                    ? `Contas a pagar - ${dados.formaPagamentoTexto || "Boleto"}`
                    : dados.formaPagamentoTexto || "-"
                }
              />

              {isContaPagar ? (
                <DetalheItem
                  titulo="Vencimento"
                  valor={formatarData(dados.data_vencimento)}
                />
              ) : (
                <DetalheItem titulo="Conta / Cartão" valor={dados.contaOrigem || "-"} />
              )}

              <DetalheItem
                titulo="Descrição"
                valor={dados.descricao || dados.categoria || "-"}
              />
            </div>

            {abastecimento && (
              <>
                <h3 className="font-bold pt-2">Abastecimento</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <DetalheItem titulo="Combustível" valor={abastecimento.tipo_combustivel || "-"} />
                  <DetalheItem titulo="Litros" valor={`${Number(abastecimento.litros || 0).toFixed(3)} L`} />
                  <DetalheItem titulo="Valor/L" valor={formatarMoeda(abastecimento.valor_litro || 0)} />
                  <DetalheItem titulo="Odômetro" valor={`${Number(abastecimento.odometro || 0).toLocaleString("pt-BR")} km`} />
                  <DetalheItem titulo="KM rodados" valor={`${Number(abastecimento.km_rodados || 0).toLocaleString("pt-BR")} km`} />
                  <DetalheItem
                    titulo="Consumo"
                    valor={
                      abastecimento.consumo_km_l
                        ? `${Number(abastecimento.consumo_km_l).toFixed(2)} km/L`
                        : "-"
                    }
                  />
                </div>
              </>
            )}

            {manutencao && (
              <>
                <h3 className="font-bold pt-2">Manutenção</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DetalheItem titulo="Tipo" valor={manutencao.tipo_manutencao || "-"} />
                  <DetalheItem titulo="Serviço" valor={manutencao.servico || "-"} />
                  <DetalheItem titulo="Oficina" valor={manutencao.oficina || "-"} />
                  <DetalheItem
                    titulo="Odômetro"
                    valor={`${Number(manutencao.odometro || 0).toLocaleString("pt-BR")} km`}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            type="button"
            onClick={editar}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={fechar}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalheItem({ titulo, valor, destaque }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500">{titulo}</p>

      <p
        className={`font-bold mt-1 ${
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