export const CHAVES_PREFERENCIAS = Object.freeze({
  tema: "controldriver_tema",
  fusoHorario: "controldriver_fuso_horario",
  idioma: "controldriver_idioma",
});

export function obterTema() {
  return localStorage.getItem(CHAVES_PREFERENCIAS.tema) || "escuro";
}

export function obterFusoHorario() {
  return localStorage.getItem(CHAVES_PREFERENCIAS.fusoHorario)
    || Intl.DateTimeFormat().resolvedOptions().timeZone
    || "America/Sao_Paulo";
}

export function obterIdioma() {
  return localStorage.getItem(CHAVES_PREFERENCIAS.idioma) || "pt-BR";
}

export function aplicarPreferenciasGlobais() {
  document.documentElement.dataset.theme = obterTema();
  document.documentElement.lang = "pt-BR";
  document.documentElement.dataset.idiomaPreferido = obterIdioma();
}

export function listarFusosHorarios() {
  return typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Rio_Branco", "UTC"];
}

export function rotuloFusoHorario(fuso, data = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: fuso,
      timeZoneName: "longOffset",
      hour: "2-digit",
    }).formatToParts(data);
    const offset = partes.find((parte) => parte.type === "timeZoneName")?.value?.replace("GMT", "GMT") || "GMT";
    const nomes = {
      "America/Sao_Paulo": "São Paulo",
      "America/Argentina/Buenos_Aires": "Buenos Aires",
      "America/New_York": "Nova York",
      "Europe/London": "Londres",
      "Europe/Lisbon": "Lisboa",
    };
    const cidade = nomes[fuso] || (fuso === "UTC" ? "UTC" : fuso.split("/").at(-1).replaceAll("_", " "));
    return `(${offset}) ${cidade}`;
  } catch {
    return fuso;
  }
}
