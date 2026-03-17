import { CentralOrchestrator } from '../jarvis/orchestrator';
import { NativeBridgeService } from './NativeBridge';

export class WakeWordService {
  private recognition: any;
  private isListening: boolean = false;
  private onWake: () => void;
  private orchestrator: CentralOrchestrator;
  private nativeBridge: NativeBridgeService;

  constructor(onWake: () => void) {
    this.onWake = onWake;
    this.orchestrator = CentralOrchestrator.getInstance();
    this.nativeBridge = NativeBridgeService.getInstance();
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (transcript.includes('jarvis')) {
          this.orchestrator.logEvent("Wake Word 'JARVIS' Detected.");
          
          if (this.nativeBridge.isOffline()) {
            this.orchestrator.logEvent("System Offline: Activating On-Device AI Protocols...");
          }
          
          this.onWake();
        }
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        this.recognition.start();
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error("WakeWord Recognition Error:", event.error);
      if (event.error === 'not-allowed') {
        this.isListening = false;
      }
    };
  }

  public start() {
    if (this.recognition && !this.isListening) {
      this.isListening = true;
      try {
        this.recognition.start();
        this.orchestrator.logEvent("Wake Word Engine: ONLINE. Listening for 'JARVIS'...");
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
      this.orchestrator.logEvent("Wake Word Engine: OFFLINE.");
    }
  }
}
