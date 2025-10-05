export const metadata = {
  title: "Cotizadoria - Carpintería",
  description: "Prototipo interno para generar presupuestos de carpintería con IA"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen flex items-start justify-center p-6">
          <div className="w-full max-w-4xl">
            <header className="flex items-center gap-4 mb-6">
              <img src="/logo.png" alt="logo" className="h-10 w-auto" />
              <h1 className="text-2xl font-semibold">Cotizadoria (Interno)</h1>
            </header>
            <main>{children}</main>
            <footer className="mt-8 text-sm text-slate-500">
              Hecho para uso interno — GPT-4o Vision + Google Sheets
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
