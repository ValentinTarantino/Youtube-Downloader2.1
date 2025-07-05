import { useState, useEffect } from 'react';
import Select from 'react-select';
import './VideoCard.css';

// Estilos personalizados para react-select
const customSelectStyles = {
    control: (provided) => ({
        ...provided,
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--border-radius)',
        boxShadow: 'none',
        cursor: 'pointer',
        '&:hover': {
            borderColor: 'var(--glass-border)',
        },
    }),
    singleValue: (provided) => ({
        ...provided,
        color: 'var(--text-primary)',
    }),
    menu: (provided) => ({
        ...provided,
        background: 'var(--background-end)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--border-radius)',
    }),
    option: (provided, state) => ({
        ...provided,
        background: state.isSelected
            ? 'var(--glow-primary)'
            : state.isFocused
                ? 'var(--glass-bg)'
                : 'transparent',
        color: 'var(--text-primary)',
        cursor: 'pointer',
    }),
    placeholder: (provided) => ({
        ...provided,
        color: 'var(--text-secondary)',
    }),
};

function VideoCard({ videoInfo, onDownload }) {
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [selectedAudio, setSelectedAudio] = useState(null);

    useEffect(() => {
        if (videoInfo) {
            // Opciones para los selectores
            const videoOptions = videoInfo.videoFormats.map(f => ({
                value: f.itag,
                label: f.quality,
                hasAudio: f.hasAudio,
                audioItag: f.audioItag,
            }));
            const audioOptions = videoInfo.audioFormats.map(f => ({
                value: f.itag,
                label: f.quality,
            }));

            setSelectedVideo(videoOptions.length > 0 ? videoOptions[0] : null);
            setSelectedAudio(audioOptions.length > 0 ? audioOptions[0] : null);
        }
    }, [videoInfo]);

    if (!videoInfo) return null;

    const { title, thumbnail, videoFormats, audioFormats } = videoInfo;

const handleDownloadClick = (format) => {
    if (format === 'mp4' && selectedVideo) {
        onDownload(
            'mp4',
            selectedVideo.value,
            selectedVideo.hasAudio ? null : selectedVideo.audioItag 
        );
    } else if (format === 'mp3' && selectedAudio) {
        onDownload('mp3', selectedAudio.value, null);
    }
};

    // Opciones para los selectores 
    const videoOptions = videoFormats.map(f => ({
        value: f.itag,
        label: f.quality,
        hasAudio: f.hasAudio,
        audioItag: f.audioItag,
    }));
    const audioOptions = audioFormats.map(f => ({
        value: f.itag,
        label: f.quality,
    }));

    return (
        <div className="video-card animation-fade-in">
            <div className="row g-0">
                <div className="col-md-4">
                    <img src={thumbnail} alt={title} className="video-thumbnail" />
                </div>
                <div className="col-md-8">
                    <div className="video-details">
                        <h2 className="video-title">{title}</h2>
                        <div className="quality-selector-grid">
                            {/* Selector para MP4 */}
                            <div className="quality-group">
                                <Select
                                    className="quality-select"
                                    styles={customSelectStyles}
                                    value={selectedVideo}
                                    onChange={setSelectedVideo}
                                    options={videoOptions}
                                    placeholder="Calidad de video..."
                                />
                                <button
                                    className="download-button mp4"
                                    onClick={() => handleDownloadClick('mp4')}
                                    disabled={!selectedVideo}
                                >
                                    Descargar MP4
                                </button>
                            </div>
                            {/* Selector para MP3 */}
                            <div className="quality-group">
                                <Select
                                    className="quality-select"
                                    styles={customSelectStyles}
                                    value={selectedAudio}
                                    onChange={setSelectedAudio}
                                    options={audioOptions}
                                    placeholder="Calidad de audio..."
                                />
                                <button
                                    className="download-button mp3"
                                    onClick={() => handleDownloadClick('mp3')}
                                    disabled={!selectedAudio}
                                >
                                    Descargar MP3
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VideoCard;