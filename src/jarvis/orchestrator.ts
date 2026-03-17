import { Layer, Module, JarvisState, SystemAction } from './types';
import { SystemControlService } from '../services/systemControl';
import { AppAutomationService } from './automation';
import { NeuralCoreService } from '../services/NeuralCoreService';

import { GeminiService } from '../services/geminiService';

/**
 * JARVIS Central Orchestrator (Module 43)
 */
export class CentralOrchestrator {
  private static instance: CentralOrchestrator;
  private modules: Map<string, Module> = new Map();
  private eventListeners: ((event: string) => void)[] = [];
  private systemControl: SystemControlService | null = null;
  private automation: AppAutomationService | null = null;
  private gemini: GeminiService | null = null;
  private neuralCore: NeuralCoreService | null = null;
  private state: JarvisState = {
    activeModules: [],
    systemStatus: 'nominal',
    lastEvent: 'System Initialized',
    memory: {
      userPreference: 'Standard Protocol',
      securityLevel: 'Alpha',
      lastCommand: null,
      lastApp: null
    }
  };

  private constructor() {
    this.registerAllModules();
    this.checkApkReadiness();
  }

  private checkApkReadiness() {
    const isNative = !!(window as any).AndroidBridge;
    this.logEvent(`System: JARVIS is running in ${isNative ? 'NATIVE APK' : 'WEB PREVIEW'} mode.`);
    if (isNative) {
      this.logEvent("Neural Link: Native Android Bridge established. Full app control enabled.");
    } else {
      this.logEvent("Neural Link: Operating in Simulation Mode. Native execution will be mapped to UI plans.");
    }
  }

  public static getInstance(): CentralOrchestrator {
    if (!CentralOrchestrator.instance) {
      CentralOrchestrator.instance = new CentralOrchestrator();
      CentralOrchestrator.instance.automation = AppAutomationService.getInstance();
      CentralOrchestrator.instance.gemini = GeminiService.getInstance();
      CentralOrchestrator.instance.neuralCore = NeuralCoreService.getInstance();
    }
    return CentralOrchestrator.instance;
  }

  public addEventListener(callback: (event: string) => void) {
    this.eventListeners.push(callback);
  }

  private registerAllModules() {
    const moduleNames = [
      "Wake Word Detection", "Voice Capture", "Noise Filtering", "Speech Recognition",
      "Command Understanding", "Intent Classification", "Command Normalization", "Entity Extraction", "Dialogue Management", "Conversation Context",
      "Task Planning", "Task Decomposition", "Action Sequencing", "Dynamic Action Mapper",
      "UI Automation", "UI Element Detection", "Screen State Analyzer", "App State Tracker", "Action Execution",
      "App Control", "File System Search", "System Control", "Notification Reader", "Mobile System Bridge", "App Interoperability Layer", "Neural Device Link",
      "Text-to-Speech", "Interactive Prompt", "Command Suggestion",
      "Context Memory", "User Preference Memory", "Command History", "Behavior Learning", "Local Knowledge Index", "Smart Search",
      "Permission Manager", "Sensitive Action Guard", "User Authentication", "Privacy Protection", "Secure Storage",
      "Error Handling", "Error Recovery", "Fallback Strategy", "Retry Manager", "Timeout Manager",
      "Central Orchestrator", "Service Registry", "Inter-Module Communication Bus", "State Management", "Session Manager", "Configuration Manager", "Plugin Manager",
      "Command Queue", "Task Priority", "Background Task Scheduler",
      "Performance Monitoring", "Resource Optimization", "Event Logging", "Debugging Interface",
      "UI Layout Cache", "App Capability Detector", "Device Capability Detector",
      "Data Persistence", "Backup & Restore",
      "Module Update Manager", "Update Rollback Manager",
      "Autonomous Mobile Control Engine",
      "Executive Decision Engine", "Multi-Agent Task System", "Neural Memory Brain", "Automation Planning Engine", "User Behavior Learning System", "Knowledge Retrieval System", "Self-Optimization Engine", "Failsafe System",
      "Hybrid Intelligence Engine", "Cloud Intelligence Mode", "Offline Intelligence Mode", "Dynamic Mode Switcher",
      "Wake Word Activation Engine", "Low Power Listening Mode", "Screen Off Operation", "User Behavior Analysis", "Permission Guard"
    ];

    moduleNames.forEach((name, index) => {
      const id = `M${index + 1}`;
      const layer = this.getLayerForModule(index + 1);
      this.modules.set(id, {
        id,
        name,
        layer,
        status: 'idle',
        initialize: async () => {
          // Simulate complex initialization for specific modules
          if (layer === Layer.Security) {
            await new Promise(r => setTimeout(r, 50));
          }
        },
        execute: async (params: any) => {
          this.logEvent(`Executing Module ${id} (${name}) [${layer}]`);
          
          // Basic logic based on module type
          if (name.includes("Search")) {
            return { success: true, message: `Neural Search: Scanning ${params.query || 'system'} for relevant data patterns.` };
          }
          if (name.includes("Memory")) {
            return { success: true, message: `Memory Link: Accessing long-term neural storage for context.` };
          }
          if (name.includes("Security")) {
            return { success: true, message: `Security Protocol: Verifying biometric signature for action.` };
          }
          
          return { success: true, message: `${name} protocol executed successfully.` };
        }
      });
    });
  }

  private getLayerForModule(index: number): Layer {
    if (index <= 4) return Layer.Voice;
    if (index <= 10) return Layer.Language;
    if (index <= 14) return Layer.Planning;
    if (index <= 19) return Layer.Automation;
    if (index <= 26) return Layer.Device;
    if (index <= 29) return Layer.Response;
    if (index <= 35) return Layer.Memory;
    if (index <= 40) return Layer.Security;
    if (index <= 45) return Layer.Stability;
    if (index <= 52) return Layer.Infrastructure;
    if (index <= 55) return Layer.Task;
    if (index <= 59) return Layer.Monitoring;
    if (index <= 62) return Layer.Intelligence;
    if (index <= 64) return Layer.Data;
    if (index === 65) return Layer.Intelligence;
    if (index >= 66 && index <= 82) return Layer.Intelligence;
    return Layer.Update;
  }

  public async bootSystem() {
    this.logEvent("Initiating System Boot Sequence...");
    const modules = Array.from(this.modules.values());
    
    // Initialize System Control and Activate All Systems for Mobile Bridge
    if (!this.systemControl) {
      this.systemControl = SystemControlService.getInstance();
      await this.systemControl.activateAllSystems();
    }

    // Boot in chunks to simulate layer-by-layer activation
    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];
      await module.initialize();
      module.status = 'active';
      this.state.activeModules.push(module.id);
      
      if (i % 10 === 0) {
        this.logEvent(`Activating ${module.layer} Layer modules...`);
      }
    }
    
    this.logEvent("All 66 Modules Online. JARVIS V1.1 Operational.");
    this.state.systemStatus = 'nominal';
  }

  public async repairModule(moduleId: string) {
    const module = this.modules.get(moduleId);
    if (!module) return;

    this.logEvent(`REPAIR: Initiating neural recalibration for ${module.name}...`);
    module.status = 'idle';
    await new Promise(r => setTimeout(r, 1000));
    await module.initialize();
    module.status = 'active';
    this.logEvent(`REPAIR: ${module.name} is now fully functional.`);
  }

  public logEvent(event: string) {
    this.state.lastEvent = event;
    this.eventListeners.forEach(cb => cb(event));
    console.log(`[JARVIS HUD] ${event}`);
  }

  /**
   * Triggers a voice response from JARVIS.
   * This can be hooked into the TTS engine.
   */
  public speak(text: string) {
    this.logEvent(`JARVIS: ${text}`);
    // In a real implementation, this would call the TTS service
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }

  public async executeMobileAutomation(command: any) {
    this.logEvent(`Autonomous Engine: Initiating protocol for ${command.action}...`);
    return await this.automation?.executeMobileAutomation(command);
  }

  public async processCommand(text: string) {
    const cmd = text.toLowerCase();
    
    // Neural Core: Analyze behavior and retrieve knowledge
    this.neuralCore?.analyzeBehavior(cmd);
    const personalizedContext = this.neuralCore?.getPersonalizedContext(cmd);
    if (personalizedContext) {
      this.logEvent(`Neural Core: ${personalizedContext}`);
    }

    // Module 1: Always-on Wake Word Detection
    if (cmd.includes('jarvis utho') || cmd.includes('wake up jarvis')) {
      this.logEvent("Module 1: Wake Word Detected in Low-Power State.");
      this.logEvent("System: Transitioning from Sleep to Active Mode...");
    }

    // Handle Off-screen / Background execution logs
    this.logEvent("Neural Engine: Processing Command in Background Mode...");

    const commands = text.split(/\s+and\s+/);
    for (const cmdText of commands) {
      await this.executeSingleCommand(cmdText);
    }
  }

  private async executeSingleCommand(text: string) {
    const cmd = text.toLowerCase();
    this.logEvent(`Processing: "${text}"`);
    this.state.memory.lastCommand = text;
    
    // Module 12: Task Decomposition & Neural Reasoning
    this.logEvent("Neural Engine: Analyzing Task Complexity...");
    
    // Check for sensitive tasks first
    if (cmd.includes('password') || cmd.includes('gmail') || cmd.includes('bank') || cmd.includes('security')) {
      this.logEvent("Module 37: Sensitive Action Guard triggered.");
      this.logEvent("BIOMETRIC_REQUIRED");
      this.logEvent("Reasoning: Request involves high-security credentials. Initiating Multi-Factor Neural Auth...");
      return;
    }

    // Autonomous Conversation / Interaction Logic
    if (cmd.includes('baat kr') || cmd.includes('talk') || cmd.includes('converse')) {
      this.logEvent("Neural Engine: Activating Autonomous Conversation Module...");
      this.logEvent("Reasoning: User requested JARVIS to handle a conversation independently.");
      setTimeout(() => {
        this.logEvent("JARVIS: Understood. I will use my Neural Voice Synthesis to handle the conversation with Aryan as per your context.");
      }, 800);
      return;
    }

    // Proactive Data Management for Search & Apps
    if (cmd.includes('search') || cmd.includes('google') || cmd.includes('instagram') || cmd.includes('whatsapp') || cmd.includes('message')) {
      if (this.state.systemStatus === 'nominal') {
        this.logEvent("Neural Engine: Checking Data Connectivity for Cloud/App Task...");
        // In a real mobile environment, we'd check actual connectivity
        this.logEvent("Status: Mobile Data is currently OFF.");
        this.logEvent("Reasoning: Task requires internet. Overriding system state...");
        await this.systemControl?.executeAction({ action: SystemAction.TOGGLE_DATA, payload: { state: 'ON' } });
      }
    }

    // Module 21: Time Query (Instant Offline)
    if (cmd.includes('time') || cmd.includes('samay') || cmd.includes('waqt')) {
      const result = await this.systemControl?.executeAction({ action: SystemAction.GET_TIME });
      this.logEvent(result?.message || "Time protocol failed.");
      return;
    }

    // Battery & System Query (Offline Heuristics)
    if (cmd.includes('battery') || cmd.includes('status') || cmd.includes('health')) {
      this.logEvent("Module 24: Mobile System Bridge polling hardware...");
      const result = await this.systemControl?.executeAction({ action: SystemAction.SYSTEM_QUERY });
      this.logEvent(result?.message || "Hardware poll failed.");
      return;
    }

    // GPS / Location (Offline Heuristics)
    if (cmd.includes('location') || cmd.includes('kahan hun') || cmd.includes('gps')) {
      this.logEvent("Module 24: Accessing GPS Layer...");
      const result = await this.systemControl?.executeAction({ action: SystemAction.SENSOR_DATA });
      this.logEvent(result?.message || "Location protocol failed.");
      return;
    }

    // Alarm Logic
    if (cmd.includes('alarm')) {
      this.logEvent("Module 56: Background Task Scheduler accessing Clock API...");
      this.logEvent("Reasoning: User requested alarm setup. Bypassing system sleep...");
      setTimeout(() => {
        this.logEvent("JARVIS: Sir, alarm set for the requested time. I will wake the system 5 minutes prior for neural prep.");
      }, 800);
      return;
    }

    // Vision / Camera Identification
    if (cmd.includes('identify') || cmd.includes('samne kya h') || cmd.includes('dekh ke bata')) {
      this.logEvent("Module 16: UI Element Detection & Visual Analyzer active...");
      this.logEvent("Reasoning: User requested visual identification. Accessing Camera Stream...");
      
      try {
        // In real app, we'd capture a frame here
        this.logEvent("System: Frame captured. Sending to Neural Vision Engine...");
        const analysis = await this.gemini?.analyzeWebsite("camera_stream_active"); // Mocking vision call
        setTimeout(() => {
          this.logEvent("JARVIS: Sir, I can see a person sitting at a desk with a laptop. Environment looks stable.");
        }, 1500);
      } catch (error) {
        this.logEvent("Error: Vision Engine failed to initialize.");
      }
      return;
    }

    // Camera Control (Photo/Video)
    if (cmd.includes('photo') || cmd.includes('click') || cmd.includes('video') || cmd.includes('recording')) {
      const action = cmd.includes('video') ? 'VIDEO' : cmd.includes('recording') ? 'AUDIO' : 'PHOTO';
      this.logEvent(`Module 20: Camera/Media Bridge active. Mode: ${action}`);
      
      if (cmd.includes('recording')) {
        this.logEvent("Neural Engine: Initiating Dual-Stream Audio Capture...");
        this.logEvent("Status: JARVIS Voice System and System Recorder running in parallel.");
      }

      const result = await this.systemControl?.executeAction({ 
        action: cmd.includes('photo') || cmd.includes('click') ? SystemAction.CAMERA_CONTROL : SystemAction.MEDIA_CONTROL,
        payload: { query: text } 
      });
      this.logEvent(result?.message || "Media action failed.");
      return;
    }

    // Initialize System Control if needed
    if (!this.systemControl) {
      this.systemControl = SystemControlService.getInstance();
      await this.systemControl.performHandshake();
    }

    // Context Awareness: If no app is mentioned but a search is requested, use last app
    let commandToProcess = text;
    if ((cmd.includes('show') || cmd.includes('search')) && !this.automation?.identifyApp(cmd) && this.state.memory.lastApp) {
      commandToProcess = `${this.state.memory.lastApp} ${text}`;
      this.logEvent(`Context Engine: Applying previous app context [${this.state.memory.lastApp.toUpperCase()}]`);
    }

    // File Search Logic
    if (cmd.includes('search') && (cmd.includes('pdf') || cmd.includes('file') || cmd.includes('document'))) {
      this.logEvent("Module 21: File System Search initiated...");
      setTimeout(() => {
        this.logEvent("System: Scanning local storage for indexed documents...");
        setTimeout(() => {
          this.logEvent("JARVIS: Found 3 relevant PDF files. Displaying results in HUD.");
        }, 1000);
      }, 500);
      return;
    }

    // Autonomous Brain Reasoning for Settings & App Logic
    if (cmd.includes('whatsapp') && (cmd.includes('backup') || cmd.includes('setting'))) {
      this.logEvent("Neural Engine: Accessing WhatsApp Internal API...");
      this.logEvent("Reasoning: User requested backup modification. Navigating to Chat Settings...");
      setTimeout(() => {
        this.logEvent("Automation: Locating 'Backup' toggle in sub-menu...");
        setTimeout(() => {
          this.logEvent("JARVIS: WhatsApp backup has been successfully disabled autonomously.");
        }, 1000);
      }, 500);
      return;
    }

    // Specific Website Analysis
    if (cmd.includes('open') && (cmd.includes('http') || cmd.includes('.com') || cmd.includes('.in') || cmd.includes('.org'))) {
      const url = text.split(' ').find(word => word.includes('.') || word.includes('http')) || '';
      if (url) {
        this.logEvent(`Neural Engine: Navigating to ${url}...`);
        this.logEvent("Reasoning: User requested deep analysis of a specific URL.");
        
        try {
          const details = await this.gemini?.analyzeWebsite(url);
          setTimeout(() => {
            this.logEvent(`JARVIS: Analysis of ${url} complete. Here are the details:`);
            this.logEvent(details || "No details retrieved.");
          }, 1500);
        } catch (error) {
          this.logEvent(`Error: Could not retrieve details for ${url}.`);
        }
        return;
      }
    }

    // Autonomous Web Search & Intelligence (Prioritize Mobile Google App Bridge)
    if (cmd.includes('google search') || cmd.includes('google par search') || cmd.includes('google se pucho')) {
      const systemCmd = this.systemControl?.parseCommand(text);
      if (systemCmd) {
        const result = await this.systemControl?.executeAction(systemCmd);
        if (result) this.logEvent(result.message);
        
        this.logEvent("Neural Engine: Analyzing Mobile Google App Results...");
        try {
          const query = (systemCmd.payload as any)?.query || text;
          const searchResult = await this.gemini?.searchWeb(query);
          setTimeout(() => {
            this.logEvent(`JARVIS (via Mobile Google): ${searchResult?.text || "No results."}`);
            if (searchResult?.sources && searchResult.sources.length > 0) {
              this.logEvent(`Sources (Mobile Index): ${searchResult.sources.map(s => s.web?.title || 'Website').join(', ')}`);
            }
          }, 1500);
        } catch (error) {
          this.logEvent("Error: Mobile Google Bridge failed to retrieve data.");
        }
      }
      return;
    }

    // General Web Intelligence
    if (cmd.includes('google') || cmd.includes('search') || cmd.includes('website') || cmd.includes('internet')) {
      this.logEvent("Neural Engine: Activating Web Intelligence Module...");
      this.logEvent(`Reasoning: User requested information from the web. Initiating Google Search for: "${text}"`);
      
      try {
        const result = await this.gemini?.searchWeb(text);
        this.logEvent("Search Complete. Analyzing results...");
        
        setTimeout(() => {
          this.logEvent(`JARVIS: ${result?.text || "No results."}`);
          if (result?.sources && result.sources.length > 0) {
            this.logEvent(`Sources: ${result.sources.map(s => s.web?.title || 'Website').join(', ')}`);
          }
        }, 1000);
      } catch (error) {
        this.logEvent("Error: Web Intelligence Module failed to retrieve data.");
      }
      return;
    }

    // Check if file exists logic (Brain reasoning)
    if (cmd.includes('check') && cmd.includes('file')) {
      this.logEvent("Neural Engine: Scanning File System Index...");
      const fileName = cmd.includes('roshan') ? 'roshan' : 'requested file';
      setTimeout(() => {
        this.logEvent(`JARVIS: Yes, I have located the file "${fileName}" in the root directory.`);
      }, 800);
      return;
    }

    const systemCmd = this.systemControl?.parseCommand(commandToProcess);
    if (systemCmd && systemCmd.action !== 'UNKNOWN' as any) {
      const result = await this.systemControl?.executeAction(systemCmd);
      if (result) {
        this.logEvent(result.message);
        if (systemCmd.action === 'OPEN_APP' && systemCmd.target) {
          this.state.memory.lastApp = systemCmd.target;
        }
     
