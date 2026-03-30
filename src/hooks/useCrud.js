import { useState, useEffect, useCallback } from "react";
import { getAll, addItem, deleteItem, updateItem } from "../services/firestoreService";

export default function useCrud(collectionName) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await getAll(collectionName);
    setItems(data);
    setLoading(false);
  }, [collectionName]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = async (data) => {
    setSaving(true);
    await addItem(collectionName, data);
    await refresh();
    setSaving(false);
  };

  const remove = async (id) => {
    await deleteItem(collectionName, id);
    await refresh();
  };

  const update = async (id, data) => {
    setSaving(true);
    await updateItem(collectionName, id, data);
    await refresh();
    setSaving(false);
  };

  return { items, loading, saving, refresh, add, remove, update };
}
