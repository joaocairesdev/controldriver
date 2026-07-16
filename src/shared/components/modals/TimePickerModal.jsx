import { useEffect, useState } from "react";
import Picker from "react-mobile-picker";

export default function TimePickerModal({ aberto, valor, onChange, onClose }) {
  const horaInicial = valor?.split(":")?.[0] || "12";
  const minutoInicial = valor?.split(":")?.[1] || "30";

  const [tempo, setTempo] = useState({
    hora: horaInicial,
    minuto: minutoInicial,
  });

  useEffect(() => {
    if (!aberto) return;

    setTempo({
      hora: valor?.split(":")?.[0] || "12",
      minuto: valor?.split(":")?.[1] || "30",
    });
  }, [aberto, valor]);

  if (!aberto) return null;

  const horasOptions = Array.from({ length: 25 }, (_, i) =>
    String(i).padStart(2, "0")
  );

  const minutosOptions = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0")
  );

 function moverCampo(campo, delta, options) {
  const atual = tempo[campo];
  const indexAtual = options.indexOf(atual);

  const novoIndex = Math.min(
    Math.max(indexAtual + delta, 0),
    options.length - 1
  );

  setTempo((anterior) => ({
    ...anterior,
    [campo]: options[novoIndex],
  }));
}

  function controlarScroll(e, campo, options) {
    e.preventDefault();

    if (e.deltaY > 0) {
      moverCampo(campo, 1, options);
    } else {
      moverCampo(campo, -1, options);
    }
  }

  function confirmar() {
    onChange(`${tempo.hora}:${tempo.minuto}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Horas trabalhadas</h2>

            <p className="text-gray-400 mt-2">
              Role ou deslize para escolher horas e minutos.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <div
            onWheel={(e) => controlarScroll(e, "hora", horasOptions)}
            className="bg-[#0B1120] border border-gray-700 rounded-2xl px-4 py-3 h-[170px] overflow-hidden cursor-ns-resize"
          >
            <p className="text-xs text-gray-500 text-center mb-2">horas</p>

            <Picker
              value={tempo}
              onChange={setTempo}
              height={125}
              itemHeight={38}
            >
              <Picker.Column name="hora">
                {horasOptions.map((hora) => (
                  <Picker.Item key={hora} value={hora}>
                    {({ selected }) => (
                      <div
                        className={`text-center text-xl font-bold ${
                          selected ? "text-green-400" : "text-gray-500"
                        }`}
                      >
                        {hora}
                      </div>
                    )}
                  </Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
          </div>

          <div
            onWheel={(e) => controlarScroll(e, "minuto", minutosOptions)}
            className="bg-[#0B1120] border border-gray-700 rounded-2xl px-4 py-3 h-[170px] overflow-hidden cursor-ns-resize"
          >
            <p className="text-xs text-gray-500 text-center mb-2">minutos</p>

            <Picker
              value={tempo}
              onChange={setTempo}
              height={125}
              itemHeight={38}
            >
              <Picker.Column name="minuto">
                {minutosOptions.map((minuto) => (
                  <Picker.Item key={minuto} value={minuto}>
                    {({ selected }) => (
                      <div
                        className={`text-center text-xl font-bold ${
                          selected ? "text-green-400" : "text-gray-500"
                        }`}
                      >
                        {minuto}
                      </div>
                    )}
                  </Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
          </div>
        </div>

        <button
          type="button"
          onClick={confirmar}
          className="w-full mt-6 bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-4"
        >
          Confirmar {tempo.hora}:{tempo.minuto}
        </button>
      </div>
    </div>
  );
}
