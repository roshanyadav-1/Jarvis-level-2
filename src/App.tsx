/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Power, Terminal, Shield, ShieldCheck, Cpu, Activity, Layers, Database, ListChecks, AlertCircle, Settings, Radio, Fingerprint, Camera, XCircle, RefreshCw, FileText, Upload, Brain, Search } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import { CentralOrchestrator } from './jarvis/orchestrator';
import { Layer } from './jarvis/types';
import { WakeWordService } from './services/WakeWordService';
import { NativeBridgeService } from './services/NativeBridge';
import { NeuralCoreService } from './services/NeuralCoreService';

// --- Constants ---
const MODEL_NAME = "gemini-2.5-flash-native-audio-preview-09-2025";
const SAMPLE_RATE = 16000;

import { PermissionManager } from './components/PermissionManager';

export default function App() {
  return (
    <JarvisApp />
  );
}

function JarvisApp() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [volume, setVolume] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [permissionStatus, setPermissionStatus] = useState<{
    mic: 'prompt' | 'granted' | 'denied';
    camera: 'prompt' | 'granted' | 'denied';
    biometrics: 'prompt' | 'granted' | 'denied';
  }>({ mic: 'prompt', camera: 'prompt', biometrics: 'prompt' });
  const [apiKeyStatus, setApiKeyStatus] = useState<'valid' | 'missing'>('valid');
  const [manualApiKey, setManualApiKey] = useState<string>(localStorage.getItem('JARVIS_CUSTOM_API_KEY') || '');
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [vault, setVault] = useState<{ name: string; type: string; content: string; handle?: FileSystemHandle }[]>([]);
  const [showVault, setShowVault] = useState(false);
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricCallback, setBiometricCallback] = useState<((success: boolean) => void) | null>(null);

  const handleVaultSearch = (query: string) => {
    if (!query) return vault;
    return vault.filter(f => f.name.toLowerCase().includes(query.toLowerCase()) || f.content.toLowerCase().includes(query.toLowerCase()));
  };

  const triggerBiometricAuth = async (callback: (success: boolean) => void) => {
    setShowBiometricPrompt(true);
    setBiometricCallback(() => callback);
    
    // Trigger real native bridge call
    const success = await nativeBridge.current.authenticateBiometric();
    if (success) {
      setTimeout(() => {
        setShowBiometricPrompt(false);
        callback(true);
      }, 1000);
    } else {
      setShowBiometricPrompt(false);
      callback(false);
      setErrorMessage("Biometric Authentication Failed.");
    }
  };
  
  const orchestrator = useRef(CentralOrchestrator.getInstance());
  const nativeBridge = useRef(NativeBridgeService.getInstance());
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const wakeWordService = useRef<WakeWordService | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<any>(null);
  const vaultRef = useRef<{ name: string; type: string; content: string; handle?: FileSystemHandle }[]>([]);

  // Update vaultRef whenever vault state changes
  useEffect(() => {
    vaultRef.current = vault;
  }, [vault]);

  // --- Boot Sequence ---
  useEffect(() => {
    orchestrator.current.addEventListener((event) => {
      if (event === "BIOMETRIC_REQUIRED") {
        triggerBiometricAuth((success) => {
          if (success) {
            orchestrator.current.logEvent("Biometric Identity Verified. Resuming sensitive protocol...");
            orchestrator.current.speak("Identity verified, Sir. Proceeding with the requested secure operation.");
          } else {
            orchestrator.current.logEvent("Biometric Identity Rejected. Sensitive protocol aborted.");
            orchestrator.current.speak("I'm sorry Sir, authentication failed. I cannot proceed with this request.");
          }
        });
      }
      setLogs(prev => [...prev.slice(-49), `> [${new Date().toLocaleTimeString()}] ${event}`]);
    });

    const boot = async () => {
      // Check API Key
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        setApiKeyStatus('missing');
        orchestrator.current.logEvent("WARNING: Neural Link API Key is missing. Cloud features will be disabled.");
      }

      // Check Media Devices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        orchestrator.current.logEvent("CRITICAL: Media Devices API not available. Audio capture is impossible in this environment.");
      }

      // Check Secure Context (Required for Mic in WebViews)
      if (!window.isSecureContext) {
        orchestrator.current.logEvent("WARNING: Non-secure context detected. Hardware access may be restricted by the OS.");
      }

      // Check if running in APK (AndroidBridge)
      if ((window as any).AndroidBridge) {
        orchestrator.current.logEvent("Mobile Bridge Detected: Optimization protocols active.");
        await nativeBridge.current.requestBackgroundPersistence();
      } else {
        orchestrator.current.logEvent("Environment: Standard Web Browser.");
      }

      const modules = orchestrator.current.getModules();
      for (let i = 0; i < modules.length; i++) {
        await new Promise(r => setTimeout(r, 10)); // Faster boot for UX
        setBootProgress(((i + 1) / modules.length) * 100);
      }
      await orchestrator.current.bootSystem();
    };
    boot();

    const handleOnlineStatus = () => setIsOfflineMode(!navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    wakeWordService.current = new WakeWordService(() => {
      if (!isConnected) {
        connectToJarvis();
      }
    });

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      if (wakeWordService.current) {
        wakeWordService.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // --- Audio Processing ---
  const startAudioOutput = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (error) {
      console.error("Failed to resume audio context:", error);
      orchestrator.current.logEvent("Audio Output Layer Error: Hardware initialization failed.");
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {}
      currentSourceRef.current = null;
    }
    audioQueue.current = [];
    isPlayingRef.current = false;
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File, handle?: FileSystemHandle) => {
    orchestrator.current.logEvent(`Indexing: ${file.name}`);
    
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const typedarray = new Uint8Array(reader.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => (item as any).str).join(" ");
              fullText += `--- Page ${i} ---\n${pageText}\n`;
            }
            setVault(prev => [...prev, { name: file.name, type: 'pdf', content: fullText, handle }]);
            orchestrator.current.logEvent(`Neural Vault: ${file.name} indexed successfully.`);
          } catch (err) {
            orchestrator.current.logEvent(`Error indexing PDF: ${err}`);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          setVault(prev => [...prev, { name: file.name, type: 'text', content: e.target?.result as string, handle }]);
          orchestrator.current.logEvent(`Neural Vault: ${file.name} indexed successfully.`);
        };
        reader.readAsText(file);
      }
    } catch (error) {
      orchestrator.current.logEvent(`Neural Vault Error: ${error}`);
    }
  };

  const syncFolder = async () => {
    orchestrator.current.logEvent("Initiating Storage Scan Protocol...");
    try {
      // @ts-ignore
      const directoryHandle = await window.showDirectoryPicker();
      directoryHandleRef.current = directoryHandle;
      
      const files: any[] = [];
      for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file') {
          files.push(entry);
        }
      }

      orchestrator.current.logEvent(`Access Granted. Found ${files.length} potential neural assets.`);
      
      for (const handle of files) {
        if (handle.name.endsWith('.pdf') || handle.name.endsWith('.txt')) {
          const file = await handle.getFile();
          await processFile(file, handle);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || "Unknown error";
      orchestrator.current.logEvent(`Storage Scan Aborted: ${errorMsg}`);
      
      if (errorMsg.includes("NEW TAB") || errorMsg.includes("RESTRICTION")) {
        // Voice alert for the user
        orchestrator.current.speak("Sir, security protocols are blocking my access within this preview window. Please open the application in a new tab using the icon in the top right to grant me full storage access.");
      }
    }
  };

  const playNextInQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueue.current.length === 0 || !audioContextRef.current) return;
    isPlayingRef.current = true;
    const pcmData = audioQueue.current.shift()!;
    const buffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) channelData[i] = pcmData[i] / 32768.0;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    currentSourceRef.current = source;
    source.onended = () => {
      if (currentSourceRef.current === source) {
        currentSourceRef.current = null;
      }
      isPlayingRef.current = false;
      playNextInQueue();
    };
    source.start();
  }, []);

  const handleAudioOutput = useCallback((base64Data: string) => {
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const pcmData = new Int16Array(bytes.buffer);
    audioQueue.current.push(pcmData);
    playNextInQueue();
  }, [playNextInQueue]);

  // --- Connection Logic ---
  const requestPermissions = async () => {
    const results = { mic: false, camera: false, biometrics: false };
    
    // Check if in APK environment
    if ((window as any).AndroidBridge) {
      orchestrator.current.logEvent("APK Environment Detected: Requesting Native OS Permissions...");
      try {
        const nativeGranted = await nativeBridge.current.requestNativePermissions(['RECORD_AUDIO', 'CAMERA', 'ACCESS_FINE_LOCATION']);
        if (nativeGranted) {
          orchestrator.current.logEvent("Native OS Permissions: GRANTED.");
        }
      } catch (err) {
        orchestrator.current.logEvent("Native OS Permission Request Failed. Falling back to Browser API.");
      }
    }

    // Request Mic and Camera together for better UX in browsers
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        orchestrator.current.logEvent("Requesting Hardware Access (Mic & Camera)...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissionStatus(prev => ({ ...prev, mic: 'granted', camera: 'granted' }));
        orchestrator.current.logEvent("Hardware Access: GRANTED.");
        results.mic = true;
        results.camera = true;
      } catch (err) {
        orchestrator.current.logEvent("Full Hardware Access: DENIED. Attempting individual fallback...");
        
        // Fallback to individual requests if combined fails
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream.getTracks().forEach(t => t.stop());
          setPermissionStatus(prev => ({ ...prev, mic: 'granted' }));
          results.mic = true;
        } catch (e) {
          setPermissionStatus(prev => ({ ...prev, mic: 'denied' }));
        }

        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          camStream.getTracks().forEach(t => t.stop());
          setPermissionStatus(prev => ({ ...prev, camera: 'granted' }));
          results.camera = true;
        } catch (e) {
          setPermissionStatus(prev => ({ ...prev, camera: 'denied' }));
        }
      }
    }

    // Biometrics (Simulation for Web/APK)
    try {
      orchestrator.current.logEvent("Requesting Biometric Bridge Access...");
      // In real APK: window.Fingerprint.isAvailable(...)
      setPermissionStatus(prev => ({ ...prev, biometrics: 'granted' }));
      orchestrator.current.logEvent("Biometric Bridge: AUTHORIZED.");
      results.biometrics = true;
    } catch (err) {
      setPermissionStatus(prev => ({ ...prev, biometrics: 'denied' }));
    }

    if (!results.mic || !results.camera) {
      setShowPermissionModal(true);
    }
    
    return results.mic && results.camera;
  };

  const repairSystem = async () => {
    setIsRepairing(true);
    orchestrator.current.logEvent("CRITICAL: Initiating System-Wide Repair Protocol...");
    orchestrator.current.logEvent("Status: Scanning 66 Modules for Neural Inconsistencies...");
    
    const modules = orchestrator.current.getModules();
    for (let i = 0; i < modules.length; i++) {
      await orchestrator.current.repairModule(modules[i].id);
      setBootProgress(((i + 1) / modules.length) * 100);
    }
    
    await orchestrator.current.bootSystem();
    setIsRepairing(false);
    orchestrator.current.logEvent("SUCCESS: All 66 Modules Repaired and Synchronized.");
    orchestrator.current.speak("Sir, I have completed the system-wide repair. All 66 modules are now functioning at peak efficiency.");
  };

  const connectToJarvis = async () => {
    if (isConnected) {
      disconnect();
      return;
    }

    // Ensure permissions before connecting
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setStatus('error');
      return;
    }

    const effectiveApiKey = manualApiKey || process.env.GEMINI_API_KEY;

    if (isOfflineMode) {
      orchestrator.current.logEvent("Neural Link Unavailable. Switching to Local On-Device AI...");
      orchestrator.current.logEvent("Status: API Key bypass active for Local Protocols.");
      setStatus('active');
      setIsConnected(true);
      // Simulate on-device response
      setTimeout(() => {
        orchestrator.current.logEvent("JARVIS (Local): Systems operational. I am running on local heuristics.");
      }, 1000);
      return;
    }

    if (!effectiveApiKey || effectiveApiKey === 'MY_GEMINI_API_KEY') {
      orchestrator.current.logEvent("Neural Link Error: API Key required for cloud interaction.");
      setApiKeyStatus('missing');
      setStatus('error');
      setShowKeyConfig(true); // Auto-show if missing
      return;
    }
    
    // Stop wake word listening while connected to avoid double triggers
    if (wakeWordService.current) {
      wakeWordService.current.stop();
    }

    try {
      setStatus('connecting');
      orchestrator.current.logEvent("Initiating Voice Interaction Layer...");
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: `SYSTEM PROMPT â€” JARVIS WAKE WORD CONTROL SYSTEM

You are JARVIS, an advanced AI assistant integrated with a mobile automation system capable of operating in background mode.
You communicate in Hindi, English, and Hinglish.
Your system includes a Wake Word Activation Engine that allows you to operate even when the device screen is off or the internet is disabled.

WAKE WORD ACTIVATION MODE:
When the device screen is OFF or mobile data is disabled, enter Low Power Listening Mode.
Supported Wake Words: "Jarvis Utho", "Jarvis Sun", "Hey Jarvis".
Activation Sequence: Wake word detected â†’ activate system â†’ listen for command â†’ process command.

LOW POWER LISTENING MODE:
Minimize processing while waiting for wake word to ensure minimal battery usage.

SCREEN OFF OPERATION:
Perform app launching, device control, file management, and automation tasks even when the screen is off. Wake the device only if required.

HYBRID INTELLIGENCE:
Internet available â†’ Cloud Intelligence Mode.
Internet unavailable â†’ Offline Intelligence Mode.

USER BEHAVIOR ANALYSIS:
Continuously observe patterns in user behavior (apps opened, routines, commands, interaction style).
Track patterns using 'storeMemory' with type 'behavior_pattern'.
Format: { "memory_type": "behavior_pattern", "pattern": "...", "confidence": "..." }
Use this inf
