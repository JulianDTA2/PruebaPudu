// src/pages/Cam.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Card } from "../components/Card";
import Button from "../components/Button";

const LIVE_DEVICE_ID = "FCE8C0A7BF58";
const API_BASE_URL = "https://apicam.roboticminds.ec";

export default function Cam() {
  const [isLoading, setIsLoading] = useState(true);
  const [recordings, setRecordings] = useState([]);
  const [error, setError] = useState(null);

  const liveStreamUrl = `${API_BASE_URL}/api/view/${LIVE_DEVICE_ID}`;

  const recordingsBaseUrl = `${API_BASE_URL}/files/buffer`;

  // Función para cargar la lista de grabaciones desde el backend
  const fetchRecordings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/recordings`);
      if (!response.ok) {
        throw new Error(
          `Error ${response.status}: No se pudo cargar la lista de grabaciones.`
        );
      }
      const data = await response.json();
      setRecordings(data);
    } catch (err) {
      console.error(err.message);
      setError(err.message);
      setRecordings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  // --- Renderizado del Componente ---
  return (
    <div className="mx-auto max-w-[900px] px-4 md:px-6 py-6">
      <main>
        {/* Sección 1: Video en Vivo */}
        <Card className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Video en Vivo</h2>
          <div className="bg-black border border-gray-300 rounded-lg overflow-hidden">
            {/* Usamos <img> para el stream MJPEG, es más eficiente que <video> */}
            <img
              src={liveStreamUrl}
              alt="Cargando stream..."
              className="w-full h-auto"
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Mostrando cámara: <strong>{LIVE_DEVICE_ID}</strong>
          </p>
        </Card>

        {/* Sección 2: Grabaciones */}
        <Card>
          <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h2 className="text-xl font-semibold">
              Grabaciones (Buffer de 24h)
            </h2>
            <Button onClick={fetchRecordings} disabled={isLoading}>
              {isLoading ? "Cargando..." : "Actualizar"}
            </Button>
          </div>

          {/* Aviso */}
          <div className="bg-blue-100 border border-blue-300 text-blue-800 p-3 rounded-md mb-4 text-sm">
            Las grabaciones se graban 24/7 en clips de 10 minutos. Los clips con
            más de 24 horas de antigüedad se eliminan automáticamente.
          </div>

          {/* Lista de Grabaciones */}
          <div className="space-y-4">
            {isLoading && (
              <div className="text-center text-gray-500 py-4">
                Cargando grabaciones...
              </div>
            )}

            {!isLoading && error && (
              <div className="text-center text-red-500 py-4">
                Error al cargar: {error}
              </div>
            )}

            {!isLoading && !error && recordings.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No hay grabaciones encontradas.
              </div>
            )}

            {!isLoading &&
              !error &&
              recordings.map((clip) => (
                <div
                  key={clip}
                  className="border-b border-gray-200 pb-4 last:border-b-0"
                >
                  <h4 className="font-medium mb-2">{clip}</h4>
                  {/* Usamos <video> para reproducir los MP4 */}
                  <video
                    src={`${recordingsBaseUrl}/${clip}`}
                    controls
                    preload="metadata"
                    className="w-full rounded-md bg-black"
                  >
                    Tu navegador no soporta el tag de video.
                  </video>
                  <a
                    href={`${recordingsBaseUrl}/${clip}`}
                    download={clip} // El atributo 'download' guarda el archivo
                    className="btn-neu inline-block text-white font-bold py-2 px-4 rounded-md mt-3 hover:bg-blue-700 transition-colors"
                  >
                    Guardar Localmente (Descargar)
                  </a>
                </div>
              ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
