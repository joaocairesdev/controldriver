import { useEffect, useState } from "react";
import ModalBase from "../../../shared/components/modals/ModalBase";
import SelecionarOpcaoModal from "../../../shared/components/modals/SelecionarOpcaoModal";

const TIPOS = [
  { valor: "gasolina", titulo: "Gasolina", descricao: "Veículo movido somente a gasolina" },
  { valor: "etanol", titulo: "Etanol", descricao: "Veículo movido somente a etanol" },
  { valor: "flex", titulo: "Flex", descricao: "Aceita etanol e gasolina" },
  { valor: "gnv", titulo: "GNV", descricao: "Gás natural veicular e combustível líquido" },
  { valor: "diesel", titulo: "Diesel", descricao: "Veículo movido a diesel" },
  { valor: "hibrido", titulo: "Híbrido", descricao: "Combustão e motor elétrico" },
  { valor: "hibrido_plugin", titulo: "Híbrido Plug-in", descricao: "Combustão e recarga elétrica" },
  { valor: "eletrico", titulo: "Elétrico", descricao: "Veículo 100% elétrico" },
];

export default function CadastroVeiculoModal({ aberto, onClose, onSalvar, salvando }) {
  const [dados, setDados] = useState(criarDados());
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [seletorCombustivelAberto, setSeletorCombustivelAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    // Cada abertura inicia um cadastro novo; edições continuam no fluxo completo existente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDados(criarDados());
    setErros({});
    setErroGeral("");
  }, [aberto]);

  function alterar(campo, valor) {
    setDados((atuais) => ({ ...atuais, [campo]: valor }));
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
    setErroGeral("");
  }

  async function salvar() {
    const novosErros = Object.fromEntries(
      ["placa", "marca", "modelo", "ano", "odometroInicial", "categoriaVeiculo", "tipoPosse"]
        .filter((campo) => !String(dados[campo] || "").trim())
        .map((campo) => [campo, mensagemObrigatoria(campo)])
    );
    const anoNumero = Number(dados.ano);
    if (dados.ano && (anoNumero < 1886 || anoNumero > new Date().getFullYear() + 1)) novosErros.ano = "Informe um ano válido.";
    setErros(novosErros);
    if (Object.keys(novosErros).length) {
      setShakeKey(Date.now());
      return;
    }

    const resultado = await onSalvar(dados);
    if (resultado?.erro) setErroGeral(resultado.erro);
  }

  return (
    <ModalBase
      aberto={aberto}
      titulo="Novo veículo"
      descricao="Cadastre os dados essenciais. Após salvar, você irá direto para a Central do Veículo."
      onClose={onClose}
      largura="max-w-2xl"
      confirmarAoFecharSeAlterado
      rodape={(
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-700 p-3 font-bold hover:bg-white/5">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando} className="rounded-xl bg-green-500 p-3 font-bold text-black hover:bg-green-600 disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Placa" erro={erros.placa} shakeKey={shakeKey}>
          <input value={dados.placa} onChange={(e) => alterar("placa", e.target.value.toUpperCase().slice(0, 8))} placeholder="ABC1D23" autoFocus className={classeInput(erros.placa)} />
        </Campo>
        <Campo label="Marca" erro={erros.marca} shakeKey={shakeKey}>
          <input value={dados.marca} onChange={(e) => alterar("marca", e.target.value)} placeholder="Ex: Toyota" className={classeInput(erros.marca)} />
        </Campo>
        <Campo label="Modelo" erro={erros.modelo} shakeKey={shakeKey}>
          <input value={dados.modelo} onChange={(e) => alterar("modelo", e.target.value)} placeholder="Ex: Corolla" className={classeInput(erros.modelo)} />
        </Campo>
        <Campo label="Ano" erro={erros.ano} shakeKey={shakeKey}>
          <input inputMode="numeric" value={dados.ano} onChange={(e) => alterar("ano", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2026" className={classeInput(erros.ano)} />
        </Campo>
        <Campo label="Quilometragem inicial" erro={erros.odometroInicial} shakeKey={shakeKey}>
          <input inputMode="numeric" value={dados.odometroInicial} onChange={(e) => alterar("odometroInicial", e.target.value.replace(/\D/g, ""))} placeholder="125000" className={classeInput(erros.odometroInicial)} />
        </Campo>
        <Campo label="Tipo de combustível" erro={erros.categoriaVeiculo} shakeKey={shakeKey}>
          <button type="button" onClick={() => setSeletorCombustivelAberto(true)} className={`${classeInput(erros.categoriaVeiculo)} text-left`}>
            {TIPOS.find((item) => item.valor === dados.categoriaVeiculo)?.titulo || "Selecionar tipo"}
          </button>
        </Campo>
      </div>

      <Campo label="Situação" erro={erros.tipoPosse} shakeKey={shakeKey} classe="mt-5">
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Opcao ativa={dados.tipoPosse === "proprio"} erro={erros.tipoPosse} onClick={() => alterar("tipoPosse", "proprio")}>Próprio</Opcao>
          <Opcao ativa={dados.tipoPosse === "alugado"} erro={erros.tipoPosse} onClick={() => alterar("tipoPosse", "alugado")}>Alugado</Opcao>
        </div>
      </Campo>

      {erroGeral && <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-300">{erroGeral}</p>}

      <SelecionarOpcaoModal
        aberto={seletorCombustivelAberto}
        titulo="Tipo de combustível"
        descricao="Selecione o tipo de combustível do veículo."
        opcoes={TIPOS}
        valor={dados.categoriaVeiculo}
        onSelecionar={(valor) => alterar("categoriaVeiculo", valor)}
        onClose={() => setSeletorCombustivelAberto(false)}
      />
    </ModalBase>
  );
}

function criarDados() {
  return { placa: "", marca: "", modelo: "", ano: "", odometroInicial: "", categoriaVeiculo: "", tipoPosse: "" };
}

function mensagemObrigatoria(campo) {
  const nomes = { placa: "a placa", marca: "a marca", modelo: "o modelo", ano: "o ano", odometroInicial: "a quilometragem inicial", categoriaVeiculo: "o tipo de combustível", tipoPosse: "a situação" };
  return `Informe ${nomes[campo]}.`;
}

function Campo({ label, erro, shakeKey, classe = "", children }) {
  return <div className={classe}><label className={`text-sm font-semibold ${erro ? "text-red-400" : "text-gray-300"}`}>{label}</label>{children}{erro && <p key={shakeKey} className="animate-shake mt-2 text-xs font-semibold text-red-400">{erro}</p>}</div>;
}

function Opcao({ ativa, erro, onClick, children }) {
  return <button type="button" aria-pressed={ativa} onClick={onClick} className={`rounded-xl border p-3 font-bold transition ${ativa ? "border-green-400 bg-green-500/10 text-green-300" : erro ? "border-red-500 text-gray-200" : "border-gray-700 text-gray-300 hover:border-green-400"}`}>{children}</button>;
}

function classeInput(erro) {
  return `mt-2 w-full rounded-xl border bg-[#0B1120] p-3 outline-none focus:border-green-400 ${erro ? "animate-shake border-red-500" : "border-gray-700"}`;
}
