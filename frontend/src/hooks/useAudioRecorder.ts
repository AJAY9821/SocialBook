import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioRecordResult {
  blob: Blob;
  duration: number; // in seconds
  waveform: number[]; // array of normalized heights 10..100
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0); // in seconds
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Audio Context & Analyser for real-time waveform visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformSamplesRef = useRef<number[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Clean up all tracks and audio contexts
  const cleanupStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  /**
   * Start recording audio from the user's microphone
   */
  const startRecording = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];
    waveformSamplesRef.current = [];
    setDuration(0);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Select supported audio MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      let selectedMimeType = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Set up real-time audio visualizer to sample waveform
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let sampleCount = 0;

        const sampleWaveform = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average volume in this frame
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Normalize to range 15..95
          const normalized = Math.min(95, Math.max(15, Math.round((average / 255) * 100)));

          sampleCount++;
          // Sample every ~5 frames so we accumulate a sleek array of ~25 bars
          if (sampleCount % 5 === 0 && waveformSamplesRef.current.length < 35) {
            waveformSamplesRef.current.push(normalized);
          }

          animFrameRef.current = requestAnimationFrame(sampleWaveform);
        };

        animFrameRef.current = requestAnimationFrame(sampleWaveform);
      } catch {
        // Non-blocking: Waveform visualization is an enhancement
      }

      // Collect data in 250ms chunks
      recorder.start(250);
      startTimeRef.current = Date.now();
      setIsRecording(true);

      // Start elapsed timer (updates every second)
      timerRef.current = window.setInterval(() => {
        const elapsedSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsedSecs);

        // Auto-stop at 5 minutes (300 seconds)
        if (elapsedSecs >= 300) {
          // Timer will be stopped by stopRecording
        }
      }, 1000);
    } catch (err: unknown) {
      cleanupStream();
      setIsRecording(false);
      const isNotAllowed =
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      if (isNotAllowed) {
        setError('Microphone access was denied. Please allow microphone permissions in your browser.');
      } else {
        setError('Unable to access microphone.');
      }
    }
  }, [cleanupStream]);

  /**
   * Stop recording and return the final audio Blob, duration, and waveform samples
   */
  const stopRecording = useCallback((): Promise<AudioRecordResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanupStream();
        setIsRecording(false);
        resolve(null);
        return;
      }

      const totalDuration = Math.max(
        0.5,
        Math.round(((Date.now() - startTimeRef.current) / 1000) * 10) / 10,
      );

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Ensure we have at least 15 waveform samples
        let finalWaveform = waveformSamplesRef.current;
        if (finalWaveform.length < 15) {
          const fallbackBars = [25, 45, 65, 80, 50, 30, 60, 85, 70, 40, 55, 75, 45, 30, 20];
          finalWaveform = fallbackBars;
        }

        cleanupStream();
        setIsRecording(false);
        setDuration(0);

        resolve({
          blob: finalBlob,
          duration: totalDuration,
          waveform: finalWaveform,
        });
      };

      try {
        recorder.stop();
      } catch {
        cleanupStream();
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [cleanupStream]);

  /**
   * Discard current recording without generating a result
   */
  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.onstop = null;
        recorder.stop();
      } catch {}
    }
    cleanupStream();
    setIsRecording(false);
    setDuration(0);
    audioChunksRef.current = [];
    waveformSamplesRef.current = [];
  }, [cleanupStream]);

  // Format seconds into "M:SS"
  const formattedDuration = `${Math.floor(duration / 60)}:${
    duration % 60 < 10 ? '0' : ''
  }${duration % 60}`;

  return {
    isRecording,
    duration,
    formattedDuration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
