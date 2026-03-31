import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle, X } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  onClose?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const steps = [
    "Initializing player engine...",
    "Connecting to stream server...",
    "Fetching manifest (M3U8)...",
    "Verifying resolution...",
    "Buffering media segments..."
  ];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    let isMounted = true;
    let signalTimer: any;

    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setHasStarted(false); // 🔥 reset on new channel

    // ✅ 10 sec signal timeout
    signalTimer = setTimeout(() => {
      if (!hasStarted && isMounted) {
        setError("⚠️ This channel signal is low. Please try another channel.");
        setLoading(false);
      }
    }, 25000);

    // ✅ When video actually starts playing
    const handlePlaying = () => {
      if (!isMounted) return;
      setHasStarted(true);
      setLoading(false);
      clearTimeout(signalTimer);
    };

    video.addEventListener("playing", handlePlaying);

    const handleError = (e: any) => {
      if (!isMounted) return;
      if (e?.name === "AbortError") return;

      console.error("Video error:", e);
      clearTimeout(signalTimer);

      setError(
        "Stream failed. Possible reasons: Geo-blocked, expired link, or server restriction."
      );
      setLoading(false);
    };

    const streamUrl = useProxy
      ? `http://localhost:5000/api/stream?url=${encodeURIComponent(url)}`
      : url;

    setLoadingStep(1);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });

      setLoadingStep(2);
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        if (!isMounted) return;
        setLoadingStep(3);

        const levels = data.levels;
        const has720p = levels.some((l) => l.height === 720);
        const has1080p = levels.some((l) => l.height === 1080);
        const onlyBelow720 = levels.every((l) => l.height < 720);

        // if (!has720p) {
        //   clearTimeout(signalTimer);

        //   if (has1080p) {
        //     setError(
        //       "Playback restricted: 1080p streams are disabled. Only 720p is allowed."
        //     );
        //   } else if (onlyBelow720) {
        //     setError(
        //       "Playback restricted: Low quality streams (<720p) are disabled."
        //     );
        //   } else {
        //     setError(
        //       "Playback restricted: This stream does not provide a 720p version."
        //     );
        //   }

        //   setLoading(false);
        //   return;
        // }

        const targetLevelIndex = levels.findIndex((l) => l.height === 720);
        if (targetLevelIndex !== -1) {
          hls!.currentLevel = targetLevelIndex;
        }

        setLoadingStep(4);

        video.play().catch(handleError);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!isMounted) return;

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (data.response?.code === 403 || data.response?.code === 0) {
                if (!useProxy) {
                  setUseProxy(true);
                  return;
                }
              }
              hls?.startLoad();
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;

            default:
              handleError(data);
              hls?.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;

      video.addEventListener("loadedmetadata", () => {
        if (!isMounted) return;
        video.play().catch(handleError);
      });

      video.addEventListener("error", handleError);
    } else {
      clearTimeout(signalTimer);
      setError("Your browser does not support HLS playback.");
      setLoading(false);
    }

    return () => {
      isMounted = false;

      clearTimeout(signalTimer); // ✅ cleanup

      if (hls) {
        hls.destroy();
      }

      if (video) {
        video.removeEventListener("error", handleError);
        video.removeEventListener("playing", handlePlaying);
      }
    };
  }, [url, useProxy]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border-4 border-gray-100 shadow-sm">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        playsInline
        autoPlay
      />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-xs space-y-6 px-4">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-white opacity-80" />
            </div>

            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full transition-all duration-500 ${idx < loadingStep ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                    idx === loadingStep ? 'bg-white animate-pulse' : 'bg-white/20'
                    }`} />
                  <p className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-500 ${idx <= loadingStep ? 'text-white' : 'text-white/20'
                    }`}>
                    {step}
                  </p>
                </div>
              ))}
            </div>

            {useProxy && (
              <div className="pt-4 border-t border-white/10 text-center">
                <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">CORS Proxy Active</p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-white text-sm font-bold mb-2 uppercase tracking-tight">Playback Error</p>
          <p className="text-gray-400 text-xs max-w-xs">{error}</p>
          <div className="flex gap-4 mt-6">
            {!useProxy && (
              <button
                onClick={() => setUseProxy(true)}
                className="px-4 py-2 bg-gray-700 text-white text-xs font-bold rounded-xl uppercase tracking-widest hover:bg-gray-600 transition-all"
              >
                Try Proxy
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl uppercase tracking-widest hover:bg-gray-200 transition-all"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
