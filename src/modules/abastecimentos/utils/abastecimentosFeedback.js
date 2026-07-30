export function criarFeedbackAbastecimento({
  consumoKmLitro,
  possuiAbastecimentoAnterior,
}) {
  const consumo = Number(consumoKmLitro || 0);
  const consumoDisponivel =
    Boolean(possuiAbastecimentoAnterior)
    && Number.isFinite(consumo)
    && consumo > 0;

  return {
    titulo: "⛽ Abastecimento salvo com sucesso!",
    mensagem: consumoDisponivel
      ? "Seu consumo médio foi de"
      : "O consumo será calculado automaticamente no próximo abastecimento.",
    destaque: consumoDisponivel
      ? `${consumo.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} km/L`
      : "",
    textoBotao: "OK",
  };
}
