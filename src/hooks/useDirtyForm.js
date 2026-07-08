import { useEffect, useMemo, useRef, useState } from "react";

function normalizar(valor) {
  if (valor === undefined) return null;
  if (valor === "") return null;
  if (Array.isArray(valor)) return valor.map(normalizar);
  if (valor && typeof valor === "object") {
    return Object.keys(valor)
      .sort()
      .reduce((acc, chave) => {
        acc[chave] = normalizar(valor[chave]);
        return acc;
      }, {});
  }
  return valor;
}

function serializar(valor) {
  return JSON.stringify(normalizar(valor));
}

export default function useDirtyForm(initialData = {}) {
  const initialRef = useRef(serializar(initialData));
  const [form, setForm] = useState(initialData);

  useEffect(() => {
    initialRef.current = serializar(initialData);
    setForm(initialData);
  }, [serializar(initialData)]);

  const currentSerialized = useMemo(() => serializar(form), [form]);
  const isDirty = currentSerialized !== initialRef.current;

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetDirty(nextData = form) {
    initialRef.current = serializar(nextData);
    setForm(nextData);
  }

  return {
    form,
    setForm,
    setField,
    isDirty,
    resetDirty,
  };
}
