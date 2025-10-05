const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta para analizar imagen con IA
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        // Verificar que hay una imagen
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ninguna imagen' });
        }

        const { width, height, depth, material, description } = req.body;
        
        // Convertir imagen a base64
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = imageBuffer.toString('base64');

        // Llamar a OpenAI Vision API
        const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Eres un experto carpintero. Analiza esta imagen de un mueble y genera un despiece detallado.
                            
                            Especificaciones:
                            - Medidas: ${width}x${height}x${depth}mm
                            - Material: ${material}
                            - Descripción: ${description}
                            
                            Genera SOLO un array JSON con este formato exacto:
                            [
                                {
                                    "pieza": "nombre de la pieza",
                                    "cantidad": numero,
                                    "dimensiones": "largoxanchoxespesor",
                                    "espesor": "18",
                                    "corte": "sierra o CNC",
                                    "observaciones": "detalles adicionales"
                                }
                            ]
                            
                            Responde SOLO con el JSON, sin texto adicional.`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1500
        });

        // Parsear respuesta
        let pieces;
        try {
            const content = response.choices[0].message.content;
            // Limpiar respuesta para obtener solo el JSON
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                pieces = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No se pudo extraer JSON de la respuesta');
            }
        } catch (parseError) {
            console.error('Error parseando respuesta de OpenAI:', parseError);
            // Usar respuesta de ejemplo si falla el parseo
            pieces = [
                {"pieza": "Tapa superior", "cantidad": 1, "dimensiones": `${width}x${depth}x18`, "espesor": "18", "corte": "sierra", "observaciones": "MDF con cantos"},
                {"pieza": "Base inferior", "cantidad": 1, "dimensiones": `${width}x${depth}x18`, "espesor": "18", "corte": "sierra", "observaciones": "MDF con cantos"},
                {"pieza": "Laterales", "cantidad": 2, "dimensiones": `${height}x${depth}x18`, "espesor": "18", "corte": "sierra", "observaciones": "Con perforaciones"},
                {"pieza": "Estantes", "cantidad": 3, "dimensiones": `${width-36}x${depth-20}x18`, "espesor": "18", "corte": "sierra", "observaciones": "Ajustables"}
            ];
        }

        // Limpiar archivo temporal
        fs.unlinkSync(req.file.path);

        // Responder con los datos
        res.json({
            success: true,
            pieces: pieces,
            projectId: Date.now()
        });

    } catch (error) {
        console.error('Error en análisis:', error);
        // Limpiar archivo si existe
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ 
            error: 'Error al procesar la imagen',
            details: error.message 
        });
    }
});

// Ruta para guardar en Google Sheets
app.post('/api/save-to-sheets', async (req, res) => {
    try {
        const { projectData } = req.body;

        // Configurar autenticación de Google
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Preparar datos para insertar
        const values = [[
            new Date().toISOString(),
            projectData.id,
            projectData.material,
            `${projectData.width}x${projectData.height}x${projectData.depth}`,
            projectData.description || '',
            projectData.pieces.length,
            JSON.stringify(projectData.pieces),
            'Pendiente'
        ]];

        // Insertar en Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Presupuestos!A:H',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });

        res.json({ success: true, message: 'Guardado en Google Sheets' });

    } catch (error) {
        console.error('Error guardando en Sheets:', error);
        res.status(500).json({ 
            error: 'Error al guardar en Google Sheets',
            details: error.message 
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log('📋 Configuración:');
    console.log(`   - OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ Falta configurar'}`);
    console.log(`   - Google Sheets: ${process.env.GOOGLE_SHEET_ID ? '✅ Configurado' : '❌ Falta configurar'}`);
});