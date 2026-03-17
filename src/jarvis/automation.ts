import { Layer } from './types';
import { SystemControlService } from '../services/systemControl';

export interface AppAction {
  appName: string;
  action: 'OPEN' | 'MESSAGE' | 'POST' | 'SEARCH' | 'CALL' | 'DELETE' | 'HIDE' | 'DUPLICATE';
  target?: string;
  content?: string;
}

export class AppAutomationService {
  private static instance: AppAutomationService;
  private knownApps: Map<string, string> = new Map([
    ['instagram', 'com.instagram.android'],
    ['whatsapp', 'com.whatsapp'],
    ['facebook', 'com.facebook.katana'],
    ['youtube', 'com.google.android.youtube'],
    ['spotify', 'com.spotify.music'],
    ['maps', 'com.google.android.apps.maps'],
    ['gmail', 'com.google.android.gm'],
    ['twitter', 'com.twitter.android'],
    ['x', 'com.twitter.android'],
    ['telegram', 'org.telegram.messenger'],
    ['snapchat', 'com.snapchat.android'],
    ['netflix', 'com.netflix.mediaclient'],
    ['amazon', 'com.amazon.mShop.android.shopping'],
    ['uber', 'com.ubercab'],
    ['zomato', 'com.application.zomato']
  ]);

  private constructor() {}

  public static getInstance(): AppAutomationService {
    if (!AppAutomationService.instance) {
      AppAutomationService.instance = new AppAutomationService();
    }
    return AppAutomationService.instance;
  }

  public identifyApp(query: string): string | null {
    const q = query.toLowerCase();
    for (const [name, id] of this.knownApps.entries()) {
      if (q.includes(name)) return name;
    }
    return null;
  }

  public parseAutomationCommand(text: string): AppAction | null {
    const cmd = text.toLowerCase();
    const appName = this.identifyApp(cmd);
    
    if (!appName) return null;

    if (cmd.includes('delete') || cmd.includes('uninstall')) {
      return { appName, action: 'DELETE' };
    }

    if (cmd.includes('hide') || cmd.includes('chhupa')) {
      return { appName, action: 'HIDE' };
    }

    if (cmd.includes('duplicate') || cmd.includes('clone')) {
      return { appName, action: 'DUPLICATE' };
    }

    if (cmd.includes('search') || cmd.includes('dhundo') || cmd.includes('find')) {
      return {
        appName,
        action: 'SEARCH',
        content: cmd.split(/search|dhundo|find/)[1]?.trim() || ''
      };
    }

    if (cmd.includes('message') || cmd.includes('bhejo') || cmd.includes('send')) {
      // Simple extraction: "send [content] to [target]" or "message [target] [content]"
      let target = 'detected_user';
      let content = text;
      
      if (cmd.includes(' to ')) {
        const parts = cmd.split(' to ');
        target = parts[1]?.trim() || 'detected_user';
        content = parts[0]?.replace(/send|message|bhejo/g, '').trim() || text;
      }

      return {
        appName,
        action: 'MESSAGE',
        target,
        content
      };
    }

    if (cmd.includes('open') || cmd.includes('kholo') || cmd.includes('chalana') || cmd.includes('launch')) {
      return { appName, action: 'OPEN' };
    }

    return { appName, action: 'OPEN' };
  }

  public async executeMobileAutomation(command: any): Promise<{ status: string; message: string }> {
    console.log(`[AUTONOMOUS ENGINE] Executing:`, command);
    
    // Simulate execution steps
    if (command.automation_steps && command.automation_steps.length > 0) {
      for (const step of command.automation_steps) {
        console.log(`[STEP ${step.step}] ${step.action}: ${step.description}`);
        await new Promise(r => setTimeout(r, 500)); // Simulate time taken for each step
      }
    }

    // Handle specific actions
    switch (command.action) {
      case 'open_app':
        return { status: "success", message: `Sir, I have successfully opened ${command.target_app}.` };
      case 'click':
        return { status: "success", message: `Action completed: Clicked on element ${command.parameters?.element_id || 'target'}.` };
      case 'type':
        return { status: "success", message: `Action completed: Typed "${command.parameters?.text}" into the field.` };
      case 'system_op':
        const sysResult = await SystemControlService.getInstance().handleSystemOperation(command.parameters?.operation || '');
        return { status: sysResult.success ? "success" : "error", message: sysResult.message };
      default:
        return { status: "success", message: `Autonomous task on ${command.target_app || 'system'} completed, Sir.` };
    }
  }

  public async executeAutomation(action: AppAction): Promise<{ success: boolean; message: string }> {
    console.log(`[AUTOMATION] Executing:`, action);
    
    // Security Layer Check (Simulating App Lock detection)
    const hasLock = true; // Simulating that the app has a lock
    if (hasLock) {
      console.log(`[SECURITY] App Lock Detected for ${action.appName}. Triggering Biometric Bypass...`);
    }

    switch (action.action) {
      case 'OPEN':
        return { 
          success: true, 
          message: hasLock 
            ? `System: App Lock Detected. Biometric Identity Verified. Launching ${action.appName.toUpperCase()}...`
            : `System: Identifying ${action.appName.toUpperCase()}... Launching via Deep Link Protocol.` 
        };
      case 'SEARCH':
        return {
          success: true,
          message: `System: Navigating to ${action.appName.toUpperCase()} Search... Inputting query: "${action.content}".`
        };
      case 'DELETE':
        return { success: true, message: `Neural Engine: Initiating autonomous uninstallation of ${action.appName.toUpperCase()}...` };
      case 'HIDE':
        return { success: true, message: `Neural Engine: Moving ${action.appName.toUpperCase()} to secure hidden vault...` };
      case 'DUPLICATE':
        return { success: true, message: `Neural Engine: Creating autonomous clone of ${action.appName.toUpperCase()}...` };
      case 'MESSAGE':
        return { 
          success: true, 
          message: hasLock
            ? `System: Security Layer Bypassed. Accessing ${action.appName.toUpperCase()} API... Routing message.`
            : `System: Accessing ${action.appName.toUpperCase()} API... Routing message to ${action.target || 'target'}.` 
        };
      default:
        return { success: true, message: `Action ${action.action} initiated for ${action.appName}.` };
    }
  }
}
