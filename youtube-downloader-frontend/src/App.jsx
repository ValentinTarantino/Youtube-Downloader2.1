import { useState } from 'react';
import UrlForm from './components/UrlForm';
import VideoCard from './components/VideoCard';
import './App.css'; 

const API_BASE_URL = 'http://localhost:3001/api'; 

function App() {
  const [rawUrl, setRawUrl] = useState('');
  const [cleanYoutubeUrl, setCleanYoutubeUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGetVideoInfo = async () => {
    if (!rawUrl) {
      setError('Por favor, introduce una URL de YouTube.');
      return;
    }

    setIsLoading(true);
    setError('');
    setVideoInfo(null);
    setCleanYoutubeUrl('');

    try {
      const regExp = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
      const match = rawUrl.trim().match(regExp);

      if (match && match[1]) {
        const videoId = match[1];
        const finalYoutubeUrl = `https://www.youtube.com/watch?v=${videoId}`; 
        
        const response = await fetch(`${API_BASE_URL}/video-info?url=${encodeURIComponent(finalYoutubeUrl)}`);

        if (!response.ok) {
          let errorMsg = `Error en la API: ${response.status} ${response.statusText}`;
          let responseBody = ''; 

          try {
              responseBody = await response.text(); 
              const errorData = JSON.parse(responseBody); 
              errorMsg = errorData.error || errorMsg;
          } catch (jsonError) {
              if (responseBody.startsWith('<!DOCTYPE')) {
                  errorMsg = `Error inesperado: El servidor devolvió una página HTML en lugar de JSON. (Status: ${response.status})`;
              } else if (responseBody.length > 0) {
                  errorMsg = `Error inesperado del servidor: ${responseBody.substring(0, 100)} (Status: ${response.status})`;
              } else {
                  errorMsg = `Error desconocido de la API. (Status: ${response.status})`;
              }
          }
          throw new Error(errorMsg);
        }

        const data = await response.json(); 
        setVideoInfo(data);
        setCleanYoutubeUrl(finalYoutubeUrl);
      } else {
        throw new Error('URL de YouTube no válida. No se pudo encontrar un ID de video.');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (format, videoItag, audioItag) => { 
    if (!cleanYoutubeUrl) {
        setError('No se pudo iniciar la descarga: URL no validada.');
        return;
    }

    const params = new URLSearchParams({
      url: cleanYoutubeUrl,
      format: format,
      title: videoInfo.title,
      videoItag: videoItag, 
    });
    
    if (format === 'mp4' && audioItag) {
      params.append('audioItag', audioItag);
    }

    const downloadUrl = `${API_BASE_URL}/download?${params.toString()}`; 
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="container app-container">
      <div className="row">
        <div className="col-lg-10 offset-lg-1 col-xl-8 offset-xl-2">
          <header className="app-header">
            <h1>Youtube Downloader</h1>
          </header>
          <main className="app-main">
            <UrlForm url={rawUrl} onUrlChange={(e) => setRawUrl(e.target.value)} onSubmit={handleGetVideoInfo} isLoading={isLoading}/>
            {error && <p className="error-message">{error}</p>}
            <VideoCard videoInfo={videoInfo} onDownload={handleDownload} />
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;