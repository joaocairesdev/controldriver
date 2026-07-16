export const CONFIG_MOEDA = {
  locale: "pt-BR",
  currency: "BRL",
};

export function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatarMoedaDigitada(valor) {
  const texto = String(valor ?? "");
  const somenteDigitos = texto.replace(/\D/g, "");

  if (!somenteDigitos) return "";

  const digitosSemZerosNaFrente = somenteDigitos.replace(/^0+/, "");

  if (!digitosSemZerosNaFrente) return "";

  const centavos = Number(digitosSemZerosNaFrente);

  return (centavos / 100).toLocaleString(CONFIG_MOEDA.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moedaParaNumero(valor) {
  if (!valor) return 0;

  return Number(
    String(valor)
      .replace(/\./g, "")
      .replace(",", ".")
  );
}

export function numeroParaMoedaInput(valor) {
  return Number(valor || 0)
    .toFixed(2)
    .replace(".", ",");
}

export function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}
