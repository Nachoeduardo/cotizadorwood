"use client";
import { useState } from "react";

export default function Page() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [depth, setDepth] = useState("");
  const [material, setMaterial] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);

  function handleFile(e) {
    const f = e.target.files[0];
    setImage(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleAnalyze(e) {
    e.preventDefault();
    setResult(null);
    setMessage(null);

    if (!image) {
      setMessage("Sube una imagen para analizar.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", image);
      fd.append("width", width);
      fd.append("height", height);
      fd.append("depth", depth);
      fd.append("material", material);
      fd.append("description", description);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Error en el servidor");
      } else {
        setResult(data);
      }
    } catch (err) {
      setMessage(err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result || !result.pieces) {
      setMessage("No hay resultado para guardar.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        project: {
          id: (result.projectId || Date.now()).toString(),
          width,
          height,
          depth,
          material,
          description,
          pieces: result.pieces
        }
      };
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error guardando");
      setMessage("Guardado en Google Sheets correctamente.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <form onSubmit={handleAnalyze} className="grid grid-cols-1 gap-4">
        <div className="grid md:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-slate-600">Imagen (foto o render)</label>
            <input type="file" accept="image/*" onChange={handleFile} className="mt-2" />
            {preview && (
              <img src={preview} alt="preview" className="mt-3 max-h-56 object-contain border rounded" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-slate-600">Ancho (mm)</label>
              <input value={width} onChange={(e)=>setWidth(e.target.value)} className="w-full mt-1 input" />
            </div>
            <div>
              <label className="text-sm text-slate-600">Alto (mm)</label>
              <input value={height} onChange={(e)=>setHeight(e.target.value)} className="w-full mt-1 input" />
            </div>
            <div>
              <label className="text-sm text-slate-600">Profundidad (mm)</label>
              <input value={depth} onChange={(e)=>setDepth(e.target.value)} className="w-full mt-1 input" />
            </div>
            <div>
              <label className="text-sm text-slate-600">Material</label>
              <input value={material} onChange={(e)=>setMaterial(e.target.value)} className="w-full mt-1 input" />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-600">Descripción</label>
          <textarea value={description} onChange={(e)=>setDescription(e.target.value)} className="w-full mt-1 textarea" rows={3} />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Analizando…" : "Generar despiece"}
          </button>
          <button type="button" onClick={handleSave} className="btn-outline" disabled={loading || !result}>
            Guardar en Sheets
          </button>
          <button type="button" onClick={() => { setImage(null); setPreview(null); setResult(null); setMessage(null); }} className="btn-ghost">
            Limpiar
          </button>
        </div>

        {message && <div className="text-sm text-rose-600">{message}</div>}

        {result && (
          <div className="mt-4">
            <h3 className="font-medium">Resultado</h3>
            <pre className="bg-slate-100 p-3 rounded text-sm overflow-auto max-h-72">
              {JSON.stringify(result.pieces, null, 2)}
            </pre>
          </div>
        )}
      </form>

      <style jsx>{`
        .input { border: 1px solid #e6e9ee; padding: 8px; border-radius: 6px; }
        .textarea { border: 1px solid #e6e9ee; padding: 8px; border-radius: 6px; }
        .btn-primary { background:#0f172a; color:white; padding:8px 14px; border-radius: 8px; }
        .btn-outline { border:1px solid #0f172a; color:#0f172a; padding:8px 14px; border-radius:8px; background:white }
        .btn-ghost { background:transparent; color:#334155; padding:8px 14px }
      `}</style>
    </div>
  );
}
