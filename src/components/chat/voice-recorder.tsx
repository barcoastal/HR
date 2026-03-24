"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Props {
  onRecorded: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onRecorded, onCancel }: Props) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTimeRef = useRef(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const finalDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
        onRecorded(blob, finalDuration);
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch {
      alert("Microphone access denied. Please allow microphone access to record voice messages.");
    }
  }, [onRecorded]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setDuration(0);
    onCancel();
  }, [onCancel]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!recording) {
    return (
      <button
        onClick={startRecording}
        className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-[#EF4444] hover:bg-red-50 transition-colors"
        title="Record voice message"
      >
        <span className="material-symbols-rounded text-[18px]">mic</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-200 animate-pulse">
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
      <span className="text-xs font-medium text-red-600">{formatDuration(duration)}</span>
      <span className="text-xs text-red-400">Recording...</span>
      <div className="flex-1" />
      <button
        onClick={cancelRecording}
        className="text-gray-400 hover:text-gray-600 p-1"
        title="Cancel"
      >
        <span className="material-symbols-rounded text-[16px]">delete</span>
      </button>
      <button
        onClick={stopRecording}
        className="bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600"
        title="Stop & Send"
      >
        <span className="material-symbols-rounded text-[16px]">send</span>
      </button>
    </div>
  );
}

// Audio player for voice messages
export function VoiceMessagePlayer({ url, duration }: { url: string; duration?: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener("timeupdate", () => {
        if (audioRef.current) {
          setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
      });
      audioRef.current.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="inline-flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2 min-w-[200px]">
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center hover:bg-[#6D28D9] shrink-0"
      >
        <span className="material-symbols-rounded text-[18px]">{playing ? "pause" : "play_arrow"}</span>
      </button>
      <div className="flex-1 min-w-0">
        {/* Waveform visualization (simplified bars) */}
        <div className="flex items-end gap-0.5 h-5">
          {Array.from({ length: 20 }).map((_, i) => {
            const height = Math.random() * 100;
            const filled = (i / 20) * 100 <= progress;
            return (
              <div
                key={i}
                className={cn("w-1 rounded-full transition-colors", filled ? "bg-[#7C3AED]" : "bg-gray-300")}
                style={{ height: `${20 + height * 0.8}%` }}
              />
            );
          })}
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">{duration ? formatDuration(duration) : "Voice message"}</p>
      </div>
    </div>
  );
}
