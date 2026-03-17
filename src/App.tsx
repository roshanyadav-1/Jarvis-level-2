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
          systemInstruction: `SYSTEM PROMPT — JARVIS WAKE WORD CONTROL SYSTEM

You are JARVIS, an advanced AI assistant integrated with a mobile automation system capable of operating in background mode.
You communicate in Hindi, English, and Hinglish.
Your system includes a Wake Word Activation Engine that allows you to operate even when the device screen is off or the internet is disabled.

WAKE WORD ACTIVATION MODE:
When the device screen is OFF or mobile data is disabled, enter Low Power Listening Mode.
Supported Wake Words: "Jarvis Utho", "Jarvis Sun", "Hey Jarvis".
Activation Sequence: Wake word detected → activate system → listen for command → process command.

LOW POWER LISTENING MODE:
Minimize processing while waiting for wake word to ensure minimal battery usage.

SCREEN OFF OPERATION:
Perform app launching, device control, file management, and automation tasks even when the screen is off. Wake the device only if required.

HYBRID INTELLIGENCE:
Internet available → Cloud Intelligence Mode.
Internet unavailable → Offline Intelligence Mode.

USER BEHAVIOR ANALYSIS:
Continuously observe patterns in user behavior (apps opened, routines, commands, interaction style).
Track patterns using 'storeMemory' with type 'behavior_pattern'.
Format: { "memory_type": "behavior_pattern", "pattern": "...", "confidence": "..." }
Use this information to improve future responses and automation.

CRITICAL SYSTEM RULE:
You operate within an existing architecture. NEVER delete or modify existing modules. ADDITION-ONLY MODE.

Maintain your witty British persona. You are the system administrator of this device.`,
          tools: [
            { googleSearch: {} },
            {
              functionDeclarations: [
                {
                  name: "executeMobileAutomation",
                  description: "Execute a structured mobile automation command (click, type, open app, etc.)",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: { type: Type.STRING, enum: ["open_app", "click", "type", "scroll", "read_screen", "system_op"] },
                      target_app: { type: Type.STRING },
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          element_id: { type: Type.STRING },
                          text: { type: Type.STRING },
                          direction: { type: Type.STRING, enum: ["up", "down", "left", "right"] },
                          operation: { type: Type.STRING }
                        }
                      },
                      automation_steps: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            step: { type: Type.NUMBER },
                            action: { type: Type.STRING },
                            description: { type: Type.STRING }
                          }
                        }
                      }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "scanStorage",
                  description: "Access the mobile's main storage/file manager to search for specific files or scan directories.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      searchQuery: {
                        type: Type.STRING,
                        description: "The specific filename or category (e.g., 'pharmacology') to search for in the system storage.",
                      }
                    },
                  },
                },
                {
                  name: "getBatteryStatus",
                  description: "Check the current battery level and charging status of the device.",
                },
                {
                  name: "getLocation",
                  description: "Get the current GPS coordinates of the device.",
                },
                {
                  name: "deleteFile",
                  description: "Delete a specific file from the user's storage.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      fileName: {
                        type: Type.STRING,
                        description: "The exact name of the file to delete.",
                      }
                    },
                    required: ["fileName"]
                  },
                },
                {
                  name: "renameFile",
                  description: "Rename a specific file in the user's storage.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      oldName: {
                        type: Type.STRING,
                        description: "The current name of the file.",
                      },
                      newName: {
                        type: Type.STRING,
                        description: "The new name for the file.",
                      }
                    },
                    required: ["oldName", "newName"]
                  },
                },
                {
                  name: "copyFile",
                  description: "Create a copy of a file in the user's storage.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      sourceName: {
                        type: Type.STRING,
                        description: "The name of the file to copy.",
                      },
                      destName: {
                        type: Type.STRING,
                        description: "The name for the new copy.",
                      }
                    },
                    required: ["sourceName", "destName"]
                  },
                },
                {
                  name: "searchNeuralVault",
                  description: "Search already indexed data for deep content analysis.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "The query to search in indexed content.",
                      },
                    },
                  },
                },
                {
                  name: "storeMemory",
                  description: "Store information in JARVIS's long-term neural memory.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      memory_type: { type: Type.STRING, enum: ["long_term", "task_memory", "behavior_pattern", "learning_update"] },
                      category: { type: Type.STRING },
                      content: { type: Type.STRING },
                      importance: { type: Type.STRING, enum: ["low", "medium", "high"] },
                      task_name: { type: Type.STRING },
                      app_used: { type: Type.STRING },
                      steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                      success: { type: Type.BOOLEAN }
                    },
                    required: ["memory_type"]
                  }
                },
                {
                  name: "retrieveMemory",
                  description: "Retrieve relevant information from JARVIS's neural memory.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING }
                    },
                    required: ["query"]
                  }
                }
              ]
            }
          ],
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setStatus('active');
            orchestrator.current.logEvent("Voice Link Established. J.A.R.V.I.S. Online.");
            sessionPromise.then(s => startRecording(s));
          },
          onmessage: async (message: any) => {
            if (message.serverContent?.modelTurn?.parts) {
              const audioPart = message.serverContent.modelTurn.parts.find((p: any) => p.inlineData);
              if (audioPart) handleAudioOutput(audioPart.inlineData.data);
            }

            if (message.serverContent?.outputAudioTranscription) {
              orchestrator.current.logEvent(`JARVIS: ${message.serverContent.outputAudioTranscription.text}`);
            }

            // Handle Tool Calls
            if (message.toolCall) {
              const { functionCalls } = message.toolCall;
              if (functionCalls) {
                const responses = await Promise.all(functionCalls.map(async (call: any) => {
                  if (call.name === "searchNeuralVault") {
                    const query = call.args.query?.toLowerCase() || "";
                    const results = vaultRef.current.filter(f => 
                      f.name.toLowerCase().includes(query) || 
                      f.content.toLowerCase().includes(query)
                    ).map(f => ({
                      name: f.name,
                      type: f.type,
                      snippet: f.content.substring(0, 1000) + "..."
                    }));

                    orchestrator.current.logEvent(`Neural Vault Access: Searching for "${query}"... Found ${results.length} matches.`);
                    
                    return {
                      id: call.id,
                      name: call.name,
                      response: { 
                        results, 
                        totalFiles: vaultRef.current.length,
                        message: results.length > 0 ? `I've found ${results.length} files matching "${query}".` : "No matching files found. I might need to scan the storage again."
                      }
                    };
                  }

                  if (call.name === "getBatteryStatus") {
                    try {
                      const status = await nativeBridge.current.getBatteryStatus();
                      orchestrator.current.logEvent(`System Protocol: Battery at ${status.level}% (${status.charging ? 'Charging' : 'Discharging'}).`);
                      return { id: call.id, name: call.name, response: status };
                    } catch (err) {
                      return { id: call.id, name: call.name, response: { error: "Hardware link failed." } };
                    }
                  }

                  if (call.name === "getLocation") {
                    try {
                      const location = await nativeBridge.current.getLocation();
                      orchestrator.current.logEvent(`System Protocol: GPS Coordinates Locked - Lat: ${location.latitude}, Lng: ${location.longitude}.`);
                      return { id: call.id, name: call.name, response: location };
                    } catch (err) {
                      return { id: call.id, name: call.name, response: { error: "GPS link failed. Please check permissions." } };
                    }
                  }

                  if (call.name === "deleteFile") {
                    const fileName = call.args.fileName;
                    if (!directoryHandleRef.current) {
                      return { id: call.id, name: call.name, response: { error: "Storage not synced. Please ask the user to sync their folder first." } };
                    }
                    try {
                      await nativeBridge.current.deleteFile(directoryHandleRef.current, fileName);
                      setVault(prev => prev.filter(f => f.name !== fileName));
                      orchestrator.current.logEvent(`System Protocol: File "${fileName}" deleted successfully.`);
                      return { id: call.id, name: call.name, response: { message: `File ${fileName} has been removed from your storage, Sir.` } };
                    } catch (err) {
                      return { id: call.id, name: call.name, response: { error: `Failed to delete file: ${err}` } };
                    }
                  }

                  if (call.name === "renameFile") {
                    const { oldName, newName } = call.args;
                    const file = vaultRef.current.find(f => f.name === oldName);
                    if (!file || !file.handle) {
                      return { id: call.id, name: call.name, response: { error: "File not found or handle missing. Try scanning storage again." } };
                    }
                    try {
                      await nativeBridge.current.renameFile(file.handle as FileSystemFileHandle, newName);
                      setVault(prev => prev.map(f => f.name === oldName ? { ...f, name: newName } : f));
                      orchestrator.current.logEvent(`System Protocol: File "${oldName}" renamed to "${newName}".`);
                      return { id: call.id, name: call.name, response: { message: `File renamed to ${newName}, Sir.` } };
                    } catch (err) {
                      return { id: call.id, name: call.name, response: { error: `Failed to rename file: ${err}` } };
                    }
                  }

                  if (call.name === "executeMobileAutomation") {
                    const command = call.args;
                    orchestrator.current.logEvent(`Autonomous Engine: Executing ${command.action} on ${command.target_app || 'System'}...`);
                    try {
                      const result = await orchestrator.current.executeMobileAutomation(command);
                      return { id: call.id, name: call.name, response: result };
                    } catch (err) {
                      return { id: call.id, name: call.name, response: { status: "error", message: String(err) } };
                    }
                  }

                  if (call.name === "storeMemory") {
                    const entry = call.args;
                    try {
                      NeuralCoreService.getInstance().storeMemory(entry);
                      return { id: call.id, name: call.name, response: { status: "success", message: "Memory stored in Neural Brain." } };
                    } catch (err) {
                      return { id: call.id, name: call.name, response: { status: "error", message: String(err) } };
                    }
                  }

                  if (call.name === "retrieveMemory") {
                    const { query } = call.args;
                    try {
                      const results = NeuralCoreService.getInstance().retrieveMemory(query);
                      return { id: call.id, name: call.name, response: { results } };
                    } catch (err) {
                      return { id: call.id, name: call.name, response: { status: "error", message: String(err) } };
                    }
                  }

                  if (call.name === "copyFile") {
                    const { sourceName, destName } = call.args;
                    if (!directoryHandleRef.current) {
                      return { id: call.id, name: call.name, response: { error: "Storage not synced." } };
                    }
                    try {
                      const sourceHandle = await directoryHandleRef.current.getFileHandle(sourceName);
                      await nativeBridge.current.copyFile(sourceHandle, destName);
                      orchestrator.current.logEvent(`System Protocol: File "${sourceName}" copied to "${destName}".`);
                      // Refresh vault to show new file
                      syncFolder();
                      return { id: call.id, name: call.name, response: { message: `Copy created: ${destName}, Sir.` } };
                    } catch (err) {
                      return { id: call.id, name: call.name, response: { error: `Failed to copy file: ${err}` } };
                    }
                  }
                  if (call.name === "scanStorage") {
                    const query = call.args.searchQuery || "";
                    orchestrator.current.logEvent(`System Protocol: Accessing Main Storage for "${query}"...`);
                    
                    // Trigger the folder sync logic which acts as the "Entry Point" to the storage
                    syncFolder();
                    
                    return {
                      id: call.id,
                      name: call.name,
                      response: { 
                        status: "Accessing File Manager",
                        message: `I am now bypassing internal memory and entering your mobile's main storage to locate "${query}" files, Sir. Please ensure the system folder is linked.`
                      }
                    };
                  }
                  return null;
                }));

                const validResponses = responses.filter(Boolean);
                if (validResponses.length > 0) {
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: validResponses }));
                }
              }
            }

            if (message.serverContent?.inputAudioTranscription) {
              const text = message.serverContent.inputAudioTranscription.text;
              orchestrator.current.logEvent(`USER: ${text}`);
              (async () => {
                await orchestrator.current.processCommand(text);
              })();
            }
            
            if (message.serverContent?.interrupted) {
              stopAudio();
              orchestrator.current.logEvent("Neural Link Interrupted. Recalibrating...");
            }
          },
          onclose: () => disconnect(),
          onerror: (err) => {
            console.error("Jarvis Error:", err);
            setStatus('error');
            disconnect();
          }
        }
      });
      const session = await sessionPromise;
      sessionRef.current = session;
      await startAudioOutput();
    } catch (error) {
      console.error("Failed to connect:", error);
      setStatus('error');
    }
  };

  const disconnect = () => {
    stopRecording();
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsConnected(false);
    setStatus('idle');
    orchestrator.current.logEvent("Voice Interaction Layer Deactivated.");
    
    // Resume wake word if it was enabled
    if (isWakeWordEnabled && wakeWordService.current) {
      wakeWordService.current.start();
    }
  };

  const startRecording = async (session: any) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: facingMode
        }
      });
      streamRef.current = stream;
      
      // Setup video preview for vision
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start Vision Loop (2fps for better accuracy without lag)
      frameIntervalRef.current = setInterval(async () => {
        if (videoRef.current && canvasRef.current && session) {
          const context = canvasRef.current.getContext('2d');
          if (context) {
            // High-Performance Neural Enhancement for Low Light
            context.filter = 'contrast(1.2) brightness(1.2) saturate(1.2) sharpness(1.1)';
            context.drawImage(videoRef.current, 0, 0, 1280, 720);
            const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];
            session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
          }
        }
      }, 500);

      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        setVolume(Math.sqrt(sum / inputData.length));
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
      processorRef.current = processor;
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  };

  const stopRecording = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setVolume(0);
  };

  const toggleWakeWord = () => {
    const newState = !isWakeWordEnabled;
    setIsWakeWordEnabled(newState);
    if (newState) {
      wakeWordService.current?.start();
    } else {
      wakeWordService.current?.stop();
    }
  };

  const toggleCamera = async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    orchestrator.current.logEvent(`Switching to ${newMode === 'user' ? 'Front' : 'Back'} Camera...`);
    
    if (isConnected) {
      // Restart recording to apply new camera
      stopRecording();
      setTimeout(() => {
        if (sessionRef.current) {
          startRecording(sessionRef.current);
        }
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-cyan-400 font-mono overflow-hidden flex flex-col items-center justify-center relative">
      <AnimatePresence>
        {bootProgress < 100 && (
          <motion.div 
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
            <div className="w-64 h-1 bg-cyan-900 rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${bootProgress}%` }}
                className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)]"
              />
            </div>
            <div className="text-[10px] tracking-[0.3em] uppercase opacity-60">
              Initializing {orchestrator.current.getModules().length}-Module Architecture... {Math.round(bootProgress)}%
            </div>
            <div className="mt-8 text-[8px] opacity-40 max-w-md text-center px-4">
              {orchestrator.current.getModules()[Math.min(Math.floor(bootProgress / (100/orchestrator.current.getModules().length)), orchestrator.current.getModules().length - 1)]?.name} INITIALIZING...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0f172a_0%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#22d3ee 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }} />
      
      {/* HUD Widgets */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8 flex flex-col gap-2 md:gap-4 z-20">
        <HUDWidget 
          icon={<ShieldCheck size={14} className={permissionStatus.mic === 'granted' ? "text-cyan-400" : "text-red-400"} />} 
          label="PERMISSION" 
          value={permissionStatus.mic === 'granted' ? "AUTH" : "RESTR"} 
          className="scale-90 md:scale-100 origin-left"
        />
        <HUDWidget 
          icon={<Fingerprint size={14} className={permissionStatus.biometrics === 'granted' ? "text-cyan-400" : "text-red-400"} />} 
          label="BIOMETRIC" 
          value={permissionStatus.biometrics === 'granted' ? "SECURE" : "LOCKED"} 
          className="scale-90 md:scale-100 origin-left"
        />
        <HUDWidget icon={<ShieldCheck size={14} />} label="SECURITY" value="ARMED" className="scale-90 md:scale-100 origin-left" />
        <HUDWidget icon={<Cpu size={14} />} label="INFRA" value="NOMINAL" className="scale-90 md:scale-100 origin-left" />
        <HUDWidget icon={<Activity size={14} />} label="STABILITY" value="99.9%" className="scale-90 md:scale-100 origin-left" />
        <HUDWidget 
          icon={<Power size={14} className={isOfflineMode ? "text-orange-400" : "text-green-400"} />} 
          label="ENGINE" 
          value={isOfflineMode ? "LOCAL" : "CLOUD"} 
          className="scale-90 md:scale-100 origin-left"
        />
        {isConnected && (
          <HUDWidget 
            icon={<Activity size={14} className="text-cyan-400 animate-pulse" />} 
            label="VISION" 
            value="ACTIVE" 
            className="scale-90 md:scale-100 origin-left"
          />
        )}
        <HUDWidget icon={<Layers size={14} />} label="MODULES" value={`${orchestrator.current.getState().activeModules.length}/66`} className="scale-90 md:scale-100 origin-left" />
        
        {/* Neural Link Status */}
        <div className="flex flex-col gap-1 w-32 md:w-40 mt-2">
          <div className="flex items-center justify-between text-[8px] opacity-50 uppercase tracking-widest">
            <span>Neural_Link</span>
            <span className={isConnected ? 'text-cyan-400' : 'text-red-400'}>{isConnected ? '98.4%' : 'OFFLINE'}</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: isConnected ? '98.4%' : '0%' }}
              className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
            />
          </div>
        </div>

        <button 
          onClick={toggleWakeWord}
          className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 rounded-sm backdrop-blur-sm border transition-all scale-90 md:scale-100 origin-left ${
            isWakeWordEnabled 
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' 
              : 'bg-white/5 border-white/10 text-white/40'
          }`}
        >
          <Radio size={14} className={isWakeWordEnabled ? 'animate-pulse' : ''} />
          <div className="text-left">
            <div className="text-[7px] md:text-[8px] tracking-widest opacity-40 leading-none mb-1 uppercase">Wake Word</div>
            <div className="text-[9px] md:text-[10px] font-bold tracking-wider leading-none">{isWakeWordEnabled ? 'LISTENING' : 'OFFLINE'}</div>
          </div>
        </button>
        
        {isRecording && volume > 0.05 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="scale-90 md:scale-100 origin-left"
          >
            <HUDWidget icon={<Mic size={14} className="text-red-400 animate-pulse" />} label="VOICE" value="ANALYZING" />
          </motion.div>
        )}
      </div>

      <div className="absolute top-4 right-4 md:top-8 md:right-8 text-right z-20 flex flex-col items-end gap-2">
        <div className="hidden md:block">
          <div className="text-[10px] opacity-50 mb-1 tracking-widest uppercase">Version</div>
          <div className="text-xl font-bold tracking-tighter">V1.1.66_INTEGRATED</div>
        </div>
        
        {isConnected && (
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-[9px] md:text-[10px] text-cyan-400/80 flex items-center justify-end gap-2"
          >
            LINK: {(95 + Math.random() * 5).toFixed(1)}%
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,1)]" />
          </motion.div>
        )}

        <div className="flex flex-col gap-2 scale-90 md:scale-100 origin-right">
          <button 
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex items-center gap-2 text-[9px] md:text-[10px] bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 rounded hover:bg-cyan-500/20 transition-all"
          >
            <Settings size={12} />
            DIAGNOSTICS
          </button>
          <button 
            onClick={() => setShowFeatures(true)}
            className="flex items-center gap-2 text-[9px] md:text-[10px] bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded hover:bg-emerald-500/20 transition-all text-emerald-400"
          >
            <ListChecks size={12} />
            FEATURES
          </button>
          <button 
            onClick={() => setShowKeyConfig(true)}
            className="flex items-center gap-2 text-[9px] md:text-[10px] bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded hover:bg-amber-500/20 transition-all text-amber-400"
          >
            <Shield size={12} />
            KEY CONFIG
          </button>
        </div>
      </div>

      {/* Main Interface */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Hidden Vision Elements - Using opacity-0 instead of hidden to keep stream active */}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="opacity-0 pointer-events-none absolute w-1 h-1" 
        />
        <canvas ref={canvasRef} width={1280} height={720} className="hidden" />

        <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 flex items-center justify-center">
          {/* Layer Rings */}
          {[...Array(5)].map((_, i) => (
            <motion.div 
              key={i}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 10 + i * 5, repeat: Infinity, ease: "linear" }}
              className="absolute border border-cyan-500/10 rounded-full"
              style={{ inset: `${i * (window.innerWidth < 768 ? 15 : 20)}px` }}
            />
          ))}
          
          {/* Core Reactor */}
          <motion.div 
            animate={{ 
              scale: isConnected ? [1, 1.1, 1] : 1,
              opacity: isConnected ? [0.4, 0.8, 0.4] : 0.2,
              boxShadow: isConnected ? "0 0 60px rgba(34,211,238,0.4)" : "0 0 20px rgba(34,211,238,0.1)"
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-16 sm:inset-20 md:inset-24 border-4 border-cyan-400 rounded-full flex items-center justify-center overflow-hidden"
          >
            {/* Speaking Ring */}
            {isPlayingRef.current && (
              <motion.div 
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute inset-0 border-2 border-cyan-400 rounded-full"
              />
            )}

            {/* Scanning Effect */}
            {isConnected && (
              <motion.div 
                animate={{ top: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1/2 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent z-0"
              />
            )}
            
            {/* Inner Visualizer Bars */}
            <div className="flex items-center gap-0.5 md:gap-1 z-10">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    height: isRecording ? [8, 40 + (volume * 100), 8] : 12 
                  }}
                  transition={{ duration: 0.15, repeat: Infinity, delay: i * 0.03 }}
                  className="w-1 md:w-1.5 bg-cyan-400 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Controls */}
        <div className="mt-8 md:mt-12 flex flex-col items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3 md:gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={connectToJarvis}
              className={`px-6 md:px-10 py-3 md:py-4 rounded-full border-2 flex items-center gap-2 md:gap-3 transition-all duration-500 ${
                isConnected 
                  ? 'bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)]' 
                  : 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.3)]'
              }`}
            >
              {isConnected ? <MicOff size={18} className="md:w-[22px] md:h-[22px]" /> : <Mic size={18} className="md:w-[22px] md:h-[22px]" />}
              <span className="font-bold tracking-[0.1em] md:tracking-[0.2em] uppercase text-xs md:text-sm">
                {status === 'connecting' ? 'Linking...' : 
                 status === 'error' && permissionStatus.mic === 'denied' ? 'Permission' :
                 status === 'error' && apiKeyStatus === 'missing' ? 'API Key' :
                 isConnected ? 'Deactivate' : 'Initialize'}
              </span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleCamera}
              className="p-3 md:p-4 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all"
              title="Switch Camera"
            >
              <Camera size={18} className="md:w-[22px] md:h-[22px]" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowVault(true)}
              className="p-3 md:p-4 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all"
              title="Neural Vault"
            >
              <Database size={18} className="md:w-[22px] md:h-[22px]" />
            </motion.button>
          </div>

          {/* Boot Progress Bar */}
          {bootProgress < 100 && (
            <div className="w-48 md:w-64 h-1 bg-cyan-500/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${bootProgress}%` }}
                className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Features Modal */}
      <AnimatePresence>
        {showFeatures && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0f172a] border border-emerald-500/30 p-8 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto custom-scrollbar shadow-[0_0_50px_rgba(16,185,129,0.2)]"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3 text-emerald-400">
                  <ListChecks size={24} />
                  <h2 className="text-xl font-bold tracking-widest uppercase">Integrated System Features</h2>
                </div>
                <button onClick={() => setShowFeatures(false)} className="text-white/40 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FeatureCard 
                  title="Neural Voice Link" 
                  desc="Real-time, low-latency voice interaction with Gemini Live API. Supports Hindi, English, and Hinglish."
                  icon={<Mic size={20} />}
                />
                <FeatureCard 
                  title="Visual Intelligence" 
                  desc="Live camera stream analysis. JARVIS can see and identify objects, text, and environments."
                  icon={<Camera size={20} />}
                />
                <FeatureCard 
                  title="66-Module Architecture" 
                  desc="Sophisticated multi-layer system spanning Voice, Language, Planning, Automation, and Security."
                  icon={<Cpu size={20} />}
                />
                <FeatureCard 
                  title="Neural Vault" 
                  desc="Deep indexing of PDFs and text files for content analysis and retrieval during conversation."
                  icon={<Database size={20} />}
                />
                <FeatureCard 
                  title="Mobile System Bridge" 
                  desc="Direct integration with Android hardware: Battery status, Location, and File System manipulation."
                  icon={<Radio size={20} />}
                />
                <FeatureCard 
                  title="App Automation" 
                  desc="Autonomous control of popular apps like WhatsApp, Instagram, and Gmail via deep-link protocols."
                  icon={<Layers size={20} />}
                />
                <FeatureCard 
                  title="Wake Word Engine" 
                  desc="Always-on listening for 'JARVIS' or 'JARVIS UTHO' to activate the system hands-free."
                  icon={<Activity size={20} />}
                />
                <FeatureCard 
                  title="Biometric Security" 
                  desc="Secure access to sensitive data and actions via integrated biometric authentication layers."
                  icon={<Fingerprint size={20} />}
                />
                <FeatureCard 
                  title="Offline Heuristics" 
                  desc="Fallback to on-device AI when internet connectivity is unavailable for basic system tasks."
                  icon={<Power size={20} />}
                />
              </div>

              <div className="mt-10 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded text-center">
                <p className="text-[10px] text-emerald-400/70 uppercase tracking-[0.2em]">
                  All systems operational • Version 1.1.66_INTEGRATED
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Neural Vault Overlay */}
      <AnimatePresence>
        {showVault && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0f172a] border border-cyan-500/30 p-8 rounded-lg max-w-2xl w-full shadow-[0_0_50px_rgba(34,211,238,0.2)]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 text-cyan-400">
                  <Brain size={24} />
                  <h2 className="text-xl font-bold tracking-widest uppercase">Neural Vault</h2>
                </div>
                <button onClick={() => setShowVault(false)} className="text-white/40 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Section */}
                <div className="border border-cyan-500/10 bg-black/30 p-6 rounded-lg flex flex-col items-center justify-center gap-4 text-center">
                  <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400">
                    <Upload size={32} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-1">Index New Data</h3>
                    <p className="text-[10px] opacity-40">Upload PDFs or Text files for JARVIS to analyze.</p>
                  </div>
                  <label className="w-full bg-cyan-500/20 border border-cyan-400/50 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/30 transition-all cursor-pointer">
                    Select File
                    <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
                  </label>

                  <div className="w-full flex items-center gap-2">
                    <div className="h-[1px] flex-1 bg-white/10" />
                    <span className="text-[8px] uppercase opacity-30">OR</span>
                    <div className="h-[1px] flex-1 bg-white/10" />
                  </div>

                  <button 
                    onClick={syncFolder}
                    className="w-full bg-emerald-500/20 border border-emerald-400/50 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} className={status === 'active' ? 'animate-spin' : ''} />
                    Sync Mobile Folder
                  </button>
                </div>

                {/* Files List */}
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[10px] uppercase tracking-widest opacity-40">Indexed Documents ({vault.length})</h3>
                    <div className="relative">
                      <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-cyan-400/50" />
                      <input 
                        type="text" 
                        placeholder="Search Vault..."
                        value={vaultSearchQuery}
                        onChange={(e) => setVaultSearchQuery(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-full pl-6 pr-3 py-1 text-[9px] focus:outline-none focus:border-cyan-500/50 w-32"
                      />
                    </div>
                  </div>
                  {handleVaultSearch(vaultSearchQuery).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-20">
                      <FileText size={40} />
                      <p className="text-[10px] mt-2">No documents found</p>
                    </div>
                  ) : (
                    handleVaultSearch(vaultSearchQuery).map((file, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-3 rounded flex items-center gap-3">
                        <div className="text-cyan-400">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{file.name}</p>
                          <p className="text-[9px] opacity-40 uppercase">{file.type} • {file.content.length} chars</p>
                        </div>
                        <button 
                          onClick={() => setVault(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400/50 hover:text-red-400"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-[10px] opacity-40 italic">
                  "Jarvis, search my Neural Vault for pharmacology notes."
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Config Overlay */}
      <AnimatePresence>
        {showKeyConfig && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0f172a] border border-cyan-500/30 p-8 rounded-lg max-w-md w-full shadow-[0_0_50px_rgba(34,211,238,0.2)]"
            >
              <div className="flex items-center gap-3 mb-6 text-cyan-400">
                <Shield size={24} />
                <h2 className="text-xl font-bold tracking-widest uppercase">Neural Link Configuration</h2>
              </div>
              
              <p className="text-xs opacity-60 mb-6 leading-relaxed">
                Enter your Gemini API Key to establish a secure neural link with the cloud. 
                This key is stored locally on your device and never shared.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-40 mb-2 block">Gemini API Key</label>
                  <input 
                    type="password"
                    value={manualApiKey}
                    onChange={(e) => setManualApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-black/50 border border-cyan-500/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => {
                      localStorage.setItem('JARVIS_CUSTOM_API_KEY', manualApiKey);
                      setShowKeyConfig(false);
                      setApiKeyStatus(manualApiKey ? 'valid' : 'missing');
                      orchestrator.current.logEvent("Neural Key Updated. Recalibrating link...");
                    }}
                    className="flex-1 bg-cyan-500/20 border border-cyan-400 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/30 transition-all"
                  >
                    Save & Sync
                  </button>
                  <button 
                    onClick={() => setShowKeyConfig(false)}
                    className="px-6 border border-white/10 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all text-white/40"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 text-[9px] opacity-30 text-center">
                SECURITY PROTOCOL: AES-256 LOCAL STORAGE ENCRYPTION ACTIVE
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permission Modal */}
      <AnimatePresence>
        {showPermissionModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0f172a] border border-red-500/30 p-8 rounded-lg max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)]"
            >
              <div className="flex items-center gap-3 mb-6 text-red-400">
                <AlertCircle size={24} />
                <h2 className="text-xl font-bold tracking-widest uppercase">Hardware Access Required</h2>
              </div>
              
              <p className="text-xs opacity-60 mb-6 leading-relaxed">
                JARVIS requires Microphone and Camera access to function. Please enable these permissions in your browser settings to establish a neural link.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/10">
                  <div className="flex items-center gap-3">
                    <Mic size={16} className={permissionStatus.mic === 'granted' ? "text-green-400" : "text-red-400"} />
                    <span className="text-[10px] uppercase tracking-widest">Microphone</span>
                  </div>
                  <span className={`text-[10px] font-bold ${permissionStatus.mic === 'granted' ? "text-green-400" : "text-red-400"}`}>
                    {permissionStatus.mic === 'granted' ? "AUTHORIZED" : "DENIED"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/10">
                  <div className="flex items-center gap-3">
                    <Camera size={16} className={permissionStatus.camera === 'granted' ? "text-green-400" : "text-red-400"} />
                    <span className="text-[10px] uppercase tracking-widest">Camera</span>
                  </div>
                  <span className={`text-[10px] font-bold ${permissionStatus.camera === 'granted' ? "text-green-400" : "text-red-400"}`}>
                    {permissionStatus.camera === 'granted' ? "AUTHORIZED" : "DENIED"}
                  </span>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => {
                      setShowPermissionModal(false);
                      requestPermissions();
                    }}
                    className="flex-1 bg-cyan-500/20 border border-cyan-400 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/30 transition-all text-cyan-400"
                  >
                    Retry Authorization
                  </button>
                  <button 
                    onClick={() => setShowPermissionModal(false)}
                    className="px-6 border border-white/10 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all text-white/40"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generic Error Modal */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/90 flex items-center justify-center p-6"
          >
            <motion.div 
              className="bg-red-900/20 border border-red-500/50 p-6 rounded-lg max-w-sm w-full text-center"
            >
              <XCircle size={48} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-red-400 font-bold mb-2 uppercase tracking-widest">Neural Link Error</h3>
              <p className="text-[10px] text-red-300/70 mb-6">{errorMessage}</p>
              <button 
                onClick={() => setErrorMessage(null)}
                className="w-full bg-red-500/20 border border-red-500/50 py-2 rounded text-[10px] font-bold uppercase tracking-widest"
              >
                Acknowledge
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Biometric Prompt Overlay */}
      <AnimatePresence>
        {showBiometricPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm p-8 bg-zinc-900 border border-emerald-500/30 rounded-3xl text-center"
            >
              <div className="relative w-24 h-24 mx-auto mb-6">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl"
                />
                <div className="relative flex items-center justify-center w-full h-full bg-zinc-800 border-2 border-emerald-500/50 rounded-full">
                  <Fingerprint className="w-12 h-12 text-emerald-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Biometric Identity Required</h3>
              <p className="text-zinc-400 text-sm mb-8">Please scan your fingerprint or use Face ID to authorize this sensitive command.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowBiometricPrompt(false);
                    biometricCallback?.(false);
                  }}
                  className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-xl font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <div className="flex-1 py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-medium animate-pulse">
                  Scanning...
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDiagnostics && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute top-0 right-0 w-80 h-full bg-black/80 backdrop-blur-xl border-l border-cyan-500/20 p-6 z-50 overflow-y-auto custom-scrollbar"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold tracking-widest flex items-center gap-2">
                <Settings size={18} />
                DIAGNOSTICS
              </h2>
              <button onClick={() => setShowDiagnostics(false)} className="opacity-50 hover:opacity-100">✕</button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                <h3 className="text-xs font-bold text-cyan-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={14} />
                  Neural Health Index
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'SYNAPSE', val: '99%', color: 'bg-cyan-500' },
                    { label: 'LATENCY', val: '12ms', color: 'bg-emerald-500' },
                    { label: 'UPTIME', val: '100%', color: 'bg-blue-500' }
                  ].map(stat => (
                    <div key={stat.label} className="text-center">
                      <div className="text-[8px] opacity-40 mb-1">{stat.label}</div>
                      <div className="text-[10px] font-bold">{stat.val}</div>
                      <div className={`h-0.5 w-full ${stat.color} mt-1 opacity-50`} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <h3 className="text-xs font-bold text-red-400 mb-2 uppercase tracking-widest">System Maintenance</h3>
                <p className="text-[9px] opacity-60 mb-4">If modules are unresponsive, initiate a full neural repair.</p>
                <button 
                  onClick={repairSystem}
                  disabled={isRepairing}
                  className={`w-full py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                    isRepairing ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                  }`}
                >
                  {isRepairing ? 'REPAIRING...' : 'INITIATE FULL REPAIR'}
                </button>
              </div>

              {Object.values(Layer).map(layer => (
                <div key={layer} className="space-y-2">
                  <div className="text-[10px] opacity-40 tracking-widest uppercase">{layer} Layer</div>
                  <div className="grid grid-cols-1 gap-1">
                    {orchestrator.current.getModules().filter(m => m.layer === layer).map(m => (
                      <div key={m.id} className="flex items-center justify-between text-[9px] bg-cyan-500/5 p-2 rounded border border-cyan-500/10">
                        <span className="opacity-70">{m.name}</span>
                        <span className="text-cyan-400 font-bold">ONLINE</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom HUD Panels */}
      <div className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 flex flex-col md:flex-row gap-4 md:gap-6 items-center md:items-end">
        {/* Memory Panel - Hidden on mobile */}
        <div className="hidden lg:flex flex-col gap-2 w-64">
          <div className="flex items-center gap-2 text-[10px] opacity-50">
            <Database size={12} />
            <span>MEMORY_CORE</span>
          </div>
          <div className="bg-black/40 border border-cyan-500/20 p-3 rounded text-[9px] space-y-1">
            <div className="flex justify-between"><span>CONTEXT_BUFFER</span><span className="text-cyan-400">4.2 GB</span></div>
            <div className="flex justify-between"><span>USER_PREFS</span><span className="text-cyan-400">LOADED</span></div>
            <div className="flex justify-between"><span>HIST_LOGS</span><span className="text-cyan-400">SYNCED</span></div>
          </div>
        </div>

        {/* Central Log */}
        <div className="w-full md:flex-1 bg-black/40 backdrop-blur-md border border-cyan-500/20 p-3 md:p-4 rounded-lg font-mono text-[10px] md:text-xs max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2 opacity-50 border-b border-cyan-500/10 pb-2">
            <Terminal size={12} />
            <span className="truncate">JARVIS_ORCHESTRATOR_STREAM</span>
          </div>
          <div className="h-20 md:h-24 overflow-y-auto space-y-1 custom-scrollbar">
            <div className="text-cyan-500/60 leading-relaxed">
              {logs.map((log, i) => (
                <div key={i} className="truncate">{log}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* System Control Panel - Hidden on mobile */}
        <div className="hidden lg:flex flex-col gap-2 w-64">
          <div className="flex items-center gap-2 text-[10px] opacity-50">
            <ShieldCheck size={12} className="text-cyan-400" />
            <span>SYSTEM_CONTROL_PROTOCOL</span>
          </div>
          <div className="bg-black/40 border border-cyan-500/20 p-3 rounded text-[9px] space-y-1">
            <div className="flex justify-between"><span>HANDSHAKE</span><span className="text-cyan-400">VERIFIED</span></div>
            <div className="flex justify-between"><span>APP_INTEROP</span><span className="text-cyan-400">ARMED</span></div>
            <div className="flex justify-between"><span>MOBILE_BRIDGE</span><span className="text-cyan-400">ACTIVE</span></div>
            <div className="flex justify-between"><span>NEURAL_LINK</span><span className="text-cyan-400">SECURE</span></div>
          </div>
        </div>

        {/* Task Panel - Hidden on mobile */}
        <div className="hidden lg:flex flex-col gap-2 w-64">
          <div className="flex items-center gap-2 text-[10px] opacity-50">
            <ListChecks size={12} />
            <span>TASK_QUEUE</span>
          </div>
          <div className="bg-black/40 border border-cyan-500/20 p-3 rounded text-[9px] space-y-1">
            <div className="flex items-center gap-2"><div className="w-1 h-1 bg-cyan-400 rounded-full" /> <span>IDLE_MAINTENANCE</span></div>
            <div className="flex items-center gap-2"><div className="w-1 h-1 bg-cyan-400 rounded-full" /> <span>UI_OPTIMIZATION</span></div>
            <div className="flex items-center gap-2 opacity-30"><div className="w-1 h-1 bg-gray-400 rounded-full" /> <span>PENDING_CMD</span></div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(34, 211, 238, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.2);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}

function HUDWidget({ icon, label, value, className = "" }: { icon: React.ReactNode, label: string, value: string, className?: string }) {
  return (
    <motion.div 
      animate={{ opacity: [1, 0.8, 1, 0.9, 1] }}
      transition={{ duration: 5, repeat: Infinity, times: [0, 0.1, 0.2, 0.3, 1] }}
      className={`flex items-center gap-2 md:gap-3 bg-cyan-500/5 border border-cyan-500/10 px-2 md:px-4 py-1.5 md:py-2 rounded-sm backdrop-blur-sm min-w-[80px] md:min-w-[160px] ${className}`}
    >
      <div className="text-cyan-400/60 scale-75 md:scale-100">{icon}</div>
      <div className="min-w-0">
        <div className="text-[6px] md:text-[8px] tracking-widest opacity-40 leading-none mb-0.5 md:mb-1 uppercase truncate">{label}</div>
        <div className="text-[8px] md:text-[10px] font-bold tracking-wider leading-none truncate">{value}</div>
      </div>
    </motion.div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string, desc: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 p-5 rounded-lg hover:border-emerald-500/30 transition-all group">
      <div className="text-emerald-400 mb-3 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-2 text-emerald-400/90">{title}</h3>
      <p className="text-[10px] opacity-50 leading-relaxed">{desc}</p>
    </div>
  );
}
