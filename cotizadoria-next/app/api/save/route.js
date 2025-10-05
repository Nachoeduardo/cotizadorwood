import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const project = body.project;
    if (!project) return NextResponse.json({ error: "Missing project in body" }, { status: 400 });

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
    // Replace escaped newlines
    privateKey = privateKey.replace(/\\n/g, "\n");

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Get spreadsheet metadata
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const titleBase = `Presupuesto ${new Date().toISOString().slice(0,19).replace("T"," ")}`;
    // Create a new sheet within the spreadsheet
    const addSheetRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: titleBase }
            }
          }
        ]
      }
    });

    const sheetId = addSheetRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
    // Prepare header and data
    const header = [["timestamp","projectId","material","medidas","description","pieces_count","pieces_json","status"]];
    const row = [[
      new Date().toISOString(),
      project.id || "",
      project.material || "",
      `${project.width || ""}x${project.height || ""}x${project.depth || ""}`,
      project.description || "",
      project.pieces?.length || 0,
      JSON.stringify(project.pieces || []),
      "Pendiente"
    ]];

    // Write header and row to the new sheet
    const range = `${titleBase}!A1:H2`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [...header, ...row]
      }
    });

    return NextResponse.json({ success: true, sheet: titleBase });
  } catch (err) {
    console.error("Sheets error:", err);
    return NextResponse.json({ error: err.message || "Error saving to Sheets" }, { status: 500 });
  }
}
