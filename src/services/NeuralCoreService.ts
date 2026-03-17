import { CentralOrchestrator } from '../jarvis/orchestrator';

export interface MemoryEntry {
  memory_type: "long_term" | "task_memory" | "behavior_pattern" | "learning_update";
  category?: string;
  content?: string;
  importance?: "low" | "medium" | "high";
  task_name?: string;
  app_used?: string;
  steps?: string[];
  success?: boolean;
  pattern?: string;
  confidence?: "low" | "medium" | "high";
  task?: string;
  problem_detected?: string;
  improved_strategy?: string;
}

export class NeuralCoreService {
  private static instance: NeuralCoreService;
  private memory: MemoryEntry[] = [];

  private constructor() {
    this.loadMemory();
  }

  private get orchestrator() {
    return CentralOrchestrator.getInstance();
  }

  public static getInstance(): NeuralCoreService {
    if (!NeuralCoreService.instance) {
      NeuralCoreService.instance = new NeuralCoreService();
    }
    return NeuralCoreService.instance;
  }

  private loadMemory() {
    const stored = localStorage.getItem('JARVIS_NEURAL_MEMORY');
    if (stored) {
      try {
        this.memory = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse neural memory", e);
      }
    }
  }

  private saveMemory() {
    localStorage.setItem('JARVIS_NEURAL_MEMORY', JSON.stringify(this.memory));
  }

  public storeMemory(entry: MemoryEntry) {
    this.memory.push(entry);
    this.saveMemory();
    this.orchestrator.logEvent(`Neural Core: Stored ${entry.memory_type} in category ${entry.category || 'general'}.`);
  }

  public retrieveMemory(query: string): MemoryEntry[] {
    const q = query.toLowerCase();
    return this.memory.filter(m => 
      (m.content?.toLowerCase().includes(q)) || 
      (m.category?.toLowerCase().includes(q)) ||
      (m.task_name?.toLowerCase().includes(q)) ||
      (m.pattern?.toLowerCase().includes(q))
    );
  }

  public analyzeBehavior(interaction: string) {
    // Simple heuristic for demo
    if (interaction.includes("whatsapp") && interaction.includes("morning")) {
      this.storeMemory({
        memory_type: "behavior_pattern",
        pattern: "User opens WhatsApp frequently in the morning",
        confidence: "medium"
      });
    }
  }

  public updateLearning(task: string, success: boolean, error?: string) {
    if (!success) {
      this.storeMemory({
        memory_type: "learning_update",
        task,
        problem_detected: error || "Unknown error",
        improved_strategy: "Analyze UI elements more precisely before clicking."
      });
    }
  }

  public getPersonalizedContext(query: string): string {
    const relevant = this.retrieveMemory(query);
    if (relevant.length > 0) {
      const preferences = relevant.filter(m => m.category === 'user_preferences');
      if (preferences.length > 0) {
        return `User Preference Detected: ${preferences[0].content}`;
      }
    }
    return "";
  }
}
