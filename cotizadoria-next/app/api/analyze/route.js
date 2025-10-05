import formidable from "formidable";
import fs from "fs";
import { NextResponse } from "next/server";

export const config = {
  api: { bodyParser: false }
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const { fields, files } = await parseForm(req);
    const width = fields.width || "";
    const height = fields.height || "";
    const depth = fields.depth || "";
    const material = fields.material || "";
    const description = fields.description || "";

    const imageFile = files.image;
    if (!imageFile) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }
    const data = fs.readFileSync(imageFile.filepath);
    const b64 = data.toString("base64");
    // Build prompt - instruct to respond ONLY with JSON array
    const prompt = `Eres un experto carpintero. Analiza la siguiente imagen (se provee en data URL) y, con base en las medidas y la descripción, genera un despiece tentativo. RESPONDE SOLO con un ARRAY JSON (sin texto adicional) en este formato EXACTO:
[
  {
    "pieza": "nombre de la pieza",
    "cantidad": numero,
    "dimensiones": "LxAxP (mm)",
    "espesor": "N mm",
    "corte": "sierra|CNC",
    "observaciones": "detalle opcional"
  }
]
Medidas (mm): ancho=${width}, alto=${height}, profundidad=${depth}
Material: ${material}
Descripción: ${description}
`;

    // Call OpenAI Chat Completions with image as a message element.
    // Use REST fetch to be broadly compatible.
    const body = {
      model: "gpt-4o-mini", // use the model you have access to (gpt-4o, gpt-4o-mini, etc.)
      messages: [
        { role: "system", content: "Eres un experto en carpintería." },
        {
          role: "user",
          content: prompt
        },
        // The image payload as a structured object; many GPT-4o endpoints accept image data URLs inside messages.
        {
          role: "user",
          content: JSON.stringify({
            type: "image_url",
            image_url: `data:image/jpeg;base64,${b64}`
          })
        }
      ],
      max_tokens: 1500,
      temperature: 0.0
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenAI responded:", response.status, text);
      return NextResponse.json({ error: "Error from OpenAI", details: text }, { status: 500 });
    }

    const json = await response.json();
    const raw = json?.choices?.[0]?.message?.content || "";

    // Try to extract the JSON array from the model output
    let pieces = null;
    try {
      const match = raw.match(/\[[\s\S]*\]$/m) || raw.match(/\[[\s\S]*\]/m);
      if (match) pieces = JSON.parse(match[0]);
    } catch (err) {
      console.error("JSON parse error:", err);
    }

    // fallback: minimal example if parse failed
    if (!pieces) {
      pieces = [
        {
          pieza: "Tapa superior",
          cantidad: 1,
          dimensiones: `${width}x${depth}x18`,
          espesor: "18",
          corte: "sierra",
          observaciones: "Ejemplo fallback"
        }
      ];
    }

    // Remove temporary file
    try { fs.unlinkSync(imageFile.filepath); } catch (e) {}

    return NextResponse.json({
      success: true,
      pieces,
      projectId: Date.now()
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Error processing" }, { status: 500 });
  }
}
