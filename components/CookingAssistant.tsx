
import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: The `LiveSession` type is not exported from `@google/genai`. It has been removed from the import.
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import type { Recipe } from '../types';
// FIX: Added missing ChefHatIcon import.
import { MicrophoneIcon, StopCircleIcon, XMarkIcon, ChefHatIcon } from './icons';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

// FIX: Define a minimal `LiveSession` interface since the type is not exported from the library.
interface LiveSession {
  close: () => void;
}

interface CookingAssistantProps {
  recipe: Recipe;
  onClose: () => void;
}

const CookingAssistant: React.FC<CookingAssistantProps> = ({ recipe, onClose }) => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ user: string, model: string }[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState<{ user: string, model: string }>({ user: '', model: '' });

  const sessionRef = useRef<LiveSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setIsSessionActive(false);
    
    // Stop any playing audio
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

  }, []);

  const startSession = async () => {
    if (isSessionActive) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      // FIX: Cast window to any to access vendor-prefixed webkitAudioContext for broader browser support.
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // FIX: Cast window to any to access vendor-prefixed webkitAudioContext for broader browser support.
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;


      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are a helpful cooking assistant. The user is currently making "${recipe.title}". Here is the recipe:\n\nIngredients:\n${recipe.ingredients.map(i => `${i.quantity} ${i.name}`).join('\n')}\n\nInstructions:\n${recipe.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nAnswer any questions the user has about this recipe. Keep your answers concise.`,
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = {
                  data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                  mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
                setCurrentTranscription(prev => ({ ...prev, user: prev.user + message.serverContent!.inputTranscription!.text }));
            }
            if (message.serverContent?.outputTranscription) {
                setCurrentTranscription(prev => ({ ...prev, model: prev.model + message.serverContent!.outputTranscription!.text }));
            }
            if (message.serverContent?.turnComplete) {
                setTranscriptions(prev => [...prev, currentTranscription]);
                setCurrentTranscription({ user: '', model: '' });
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
            if (audioData && outputAudioContextRef.current) {
                const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContextRef.current.destination);

                const currentTime = outputAudioContextRef.current.currentTime;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
                source.onended = () => {
                    audioSourcesRef.current.delete(source);
                }
            }
             if (message.serverContent?.interrupted) {
                audioSourcesRef.current.forEach(source => source.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('Session closed');
            stopSession();
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            alert("An error occurred with the cooking assistant.");
            stopSession();
          },
        },
      });

      sessionRef.current = await sessionPromise;
      setIsSessionActive(true);

    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      stopSession();
    };
  }, [stopSession]);
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ChefHatIcon className="w-8 h-8 text-emerald-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-800">Cooking Assistant</h2>
              <p className="text-sm text-gray-500">Now making: {recipe.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
            <XMarkIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        
        <div className="flex-grow bg-gray-100 rounded-lg p-4 overflow-y-auto mb-4 space-y-4">
          {transcriptions.map((t, index) => (
            <React.Fragment key={index}>
              <div className="text-right"><span className="bg-blue-500 text-white rounded-lg px-3 py-2 inline-block max-w-sm">{t.user}</span></div>
              <div className="text-left"><span className="bg-gray-300 text-gray-800 rounded-lg px-3 py-2 inline-block max-w-sm">{t.model}</span></div>
            </React.Fragment>
          ))}
            {currentTranscription.user && <div className="text-right"><span className="bg-blue-400 text-white rounded-lg px-3 py-2 inline-block max-w-sm opacity-80">{currentTranscription.user}</span></div>}
            {currentTranscription.model && <div className="text-left"><span className="bg-gray-200 text-gray-800 rounded-lg px-3 py-2 inline-block max-w-sm opacity-80">{currentTranscription.model}</span></div>}
        </div>
        
        <div className="flex items-center justify-center">
          {!isSessionActive ? (
            <button onClick={startSession} className="flex flex-col items-center justify-center w-24 h-24 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition-all duration-300 transform hover:scale-105">
              <MicrophoneIcon className="w-10 h-10" />
              <span className="text-xs font-semibold mt-1">START</span>
            </button>
          ) : (
            <button onClick={stopSession} className="flex flex-col items-center justify-center w-24 h-24 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105">
              <StopCircleIcon className="w-10 h-10" />
              <span className="text-xs font-semibold mt-1">STOP</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookingAssistant;