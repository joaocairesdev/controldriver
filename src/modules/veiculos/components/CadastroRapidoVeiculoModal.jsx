import { useState } from "react";
import ModalBase from "../../../shared/components/modals/ModalBase";

export default function CadastroRapidoVeiculoModal({ aberto, tipoPosse, onClose, onSalvar, salvando }) {
  const [nome, setNome] = useState("");
  const [placa, setPlaca] = useState("");
  const [odometroInicial, setOdometroInicial] = useState("");
  const [situacao, setSituacao] = useState("");
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  function limparErro(campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
    setErroGeral("");
  }

  async function salvar() {
    const novosErros = {};
    if (!nome.trim()) novosErros.nome = "Informe o nome do veículo.";
    if (!odometroInicial.trim()) novosErros.odometroInicial = "Informe a quilometragem inicial.";
    if (tipoPosse === "proprio" && !situacao) novosErros.situacao = "Informe se o veículo está quitado ou financiado.";

    setErros(novosErros);
    if (Object.keys(novosErros).length) {
      setShakeKey(Date.now());
      return;
    }

    const resultado = await onSalvar({
      nome: nome.trim(),
      placa: tipoPosse === "proprio" ? placa.trim().toUpperCase() : "",
      odometroInicial: Number(odometroInicial),
      tipoPosse,
      situacao: tipoPosse === "proprio" ? situacao : null,
    });

    if (resultado?.erro) setErroGeral(resultado.erro);
  }

  const proprio = tipoPosse === "proprio";

  return (
    <ModalBase
      aberto={aberto}
      titulo={proprio ? "Cadastrar veículo próprio" : "Cadastrar veículo alugado"}
      descricao="Cadastre o essencial agora. As demais informações serão adicionadas pelo Dashboard do Veículo."
      onClose={onClose}
      largura="max-w-xl"
      confirmarAoFecharSeAlterado
      rodape={(
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-700 p-3 font-bold text-white hover:bg-white/5">
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className="rounded-xl bg-green-500 p-3 font-bold text-black hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-400">
            {salvando ? "Salvando..." : "Salvar veículo"}
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <CampoCadastro
          label="Nome do veículo"
          erro={erros.nome}
          shakeKey={shakeKey}
        >
          <input
            type="text"
            value={nome}
            onChange={(event) => { limparErro("nome"); setNome(event.target.value); }}
            placeholder="Ex: Carro principal"
            autoFocus
            className={classeCampo(erros.nome)}
          />
        </CampoCadastro>

        {proprio && (
          <CampoCadastro label="Placa (opcional)">
            <input
              type="text"
              value={placa}
              onChange={(event) => setPlaca(event.target.value.toUpperCase().slice(0, 8))}
              placeholder="Ex: ABC1D23"
              className={classeCampo(false)}
            />
          </CampoCadastro>
        )}

        <CampoCadastro label="Quilometragem inicial" erro={erros.odometroInicial} shakeKey={shakeKey}>
          <div className={`mt-2 flex items-center overflow-hidden rounded-xl border bg-[#0B1120] focus-within:border-green-400 ${erros.odometroInicial ? "animate-shake border-red-500" : "border-gray-700"}`}>
            <input
              type="text"
              inputMode="numeric"
              value={odometroInicial}
              onChange={(event) => { limparErro("odometroInicial"); setOdometroInicial(event.target.value.replace(/\D/g, "")); }}
              placeholder="Ex: 125000"
              className="w-full bg-transparent p-3 outline-none"
            />
            <span className="px-3 text-gray-400">km</span>
          </div>
        </CampoCadastro>

        {proprio && (
          <CampoCadastro label="Situação" erro={erros.situacao} shakeKey={shakeKey}>
            <div className={`mt-2 grid grid-cols-2 gap-3 ${erros.situacao ? "animate-shake" : ""}`}>
              {[["quitado", "Quitado"], ["financiado", "Financiado"]].map(([valor, titulo]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={situacao === valor}
                  onClick={() => { limparErro("situacao"); setSituacao(valor); }}
                  className={`rounded-xl border p-4 font-bold transition ${situacao === valor ? "border-green-400 bg-green-500/10 text-green-400" : erros.situacao ? "border-red-500 text-gray-200" : "border-gray-700 text-gray-300 hover:border-green-400"}`}
                >
                  {titulo}
                </button>
              ))}
            </div>
          </CampoCadastro>
        )}

        {erroGeral && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-300">{erroGeral}</p>}
      </div>
    </ModalBase>
  );
}

function CampoCadastro({ label, erro, shakeKey, children }) {
  return (
    <div>
      <label className={`text-sm font-semibold ${erro ? "text-red-400" : "text-gray-300"}`}>{label}</label>
      {children}
      {erro && <p key={shakeKey} className="animate-shake mt-2 text-xs font-semibold text-red-400">{erro}</p>}
    </div>
  );
}

function classeCampo(erro) {
  return `mt-2 w-full rounded-xl border bg-[#0B1120] p-3 outline-none focus:border-green-400 ${erro ? "animate-shake border-red-500" : "border-gray-700"}`;
}
