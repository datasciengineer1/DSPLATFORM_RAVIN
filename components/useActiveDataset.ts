"use client";
import { useEffect, useState } from "react";

export function useActiveDataset() {
  const read = () => {
    if (typeof window === "undefined") return { id: null as string|null, name: null as string|null };
    const id = sessionStorage.getItem("activeDatasetId") || sessionStorage.getItem("currentDatasetId");
    const name = sessionStorage.getItem("activeDatasetName") || sessionStorage.getItem("currentDatasetName");
    return { id, name };
  };

  const [{ id, name }, setState] = useState(read());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (["activeDatasetId","activeDatasetName","currentDatasetId","currentDatasetName"].includes(e.key)) {
        setState(read());
      }
    };
    const onCustom = () => setState(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("dataset-changed", onCustom as any);
    // hydrate after mount
    setState(read());
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dataset-changed", onCustom as any);
    };
  }, []);

  const setActive = (newId: string|null, newName: string|null) => {
    if (typeof window === "undefined") return;
    if (newId) sessionStorage.setItem("activeDatasetId", newId); else sessionStorage.removeItem("activeDatasetId");
    if (newName) sessionStorage.setItem("activeDatasetName", newName); else sessionStorage.removeItem("activeDatasetName");
    window.dispatchEvent(new Event("dataset-changed"));
    setState(read());
  };

  return { id, name, setActive };
}
