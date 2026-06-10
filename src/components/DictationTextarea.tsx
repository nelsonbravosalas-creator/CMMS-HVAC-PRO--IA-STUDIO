import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface DictationTextareaProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export default function DictationTextarea({
  value,
  onChange,
  disabled,
  placeholder,
  rows = 3,
  className = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium mt-1 outline-none pr-12 focus:ring-2 focus:ring-blue-500/20"
}: DictationTextareaProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  // Keep refs in sync to avoid dependency issues in the event listener
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [value, onChange]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          const currentValue = valueRef.current;
          const separator = currentValue && !currentValue.endsWith(' ') && !currentValue.endsWith('\n') ? ' ' : '';
          const newValue = currentValue + separator + finalTranscript.trim();
          onChangeRef.current(newValue);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Error en reconocimiento de voz:", event.error);
        if (event.error === 'not-allowed') {
          alert('Por favor, permite el acceso al micrófono para usar el dictado por voz.');
        }
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Tu navegador no soporta grabación de voz o necesitas dar permisos de micrófono.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
        // Si ya empezó, no hacer nada
      }
    }
  };

  return (
    <div className="relative">
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder || (isRecording ? "Escuchando..." : "")}
        className={className}
      />
      {!disabled && (
        <button
          type="button"
          onClick={toggleRecording}
          className={`absolute bottom-3 right-3 p-2 rounded-xl transition-all shadow-sm flex items-center justify-center ${
            isRecording 
              ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20' 
              : 'bg-white text-slate-400 border border-slate-200 hover:text-blue-500 hover:border-blue-300'
          }`}
          title={isRecording ? "Detener grabación" : "Dictar por voz"}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
