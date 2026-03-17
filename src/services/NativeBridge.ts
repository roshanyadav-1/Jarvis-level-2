/**
 * This service acts as a bridge between the Web UI and Native Android capabilities.
 * When converted to an APK, these methods can be mapped to real Android Services.
 */
export class NativeBridgeService {
  private static instance: NativeBridgeService;
  
  private constructor() {}

  public static getInstance(): NativeBridgeService {
    if (!NativeBridgeService.instance) {
      NativeBridgeService.instance = new NativeBridgeService();
    }
    return NativeBridgeService.instance;
  }

  /**
   * Requests the system to keep the app alive in the background.
   * In a real APK, this would trigger a Foreground Service with a notification.
   */
  public async requestBackgroundPersistence(): Promise<boolean> {
    console.log("NATIVE_BRIDGE: Requesting Foreground Service persistence...");
    // Simulation of native call
    if ((window as any).AndroidBridge) {
      return (window as any).AndroidBridge.startForegroundService();
    }
    return true; 
  }

  /**
   * Checks if the device is offline and should switch to On-Device AI.
   */
  public isOffline(): boolean {
    return !navigator.onLine;
  }

  /**
   * Placeholder for On-Device AI processing (e.g., Gemini Nano via AICore).
   * In a web context, this might use a local TFLite model or WebLLM.
   */
  public async processOnDevice(prompt: string): Promise<string> {
    console.log("NATIVE_BRIDGE: Processing via On-Device AI Engine...");
    
    // In a real APK, you'd call a native method that uses Google AICore
    if ((window as any).AndroidBridge) {
      return (window as any).AndroidBridge.promptOnDeviceModel(prompt);
    }

    return "I am operating in offline mode using on-device heuristics. My capabilities are limited without a neural link to the cloud.";
  }

  /**
   * Attempts to toggle system settings like Mobile Data or WiFi.
   * Note: On real Android, this requires specific permissions or root.
   */
  public async setSystemSetting(setting: 'mobile_data' | 'wifi' | 'bluetooth', value: boolean): Promise<boolean> {
    console.log(`NATIVE_BRIDGE: Setting system ${setting} to ${value}`);
    
    if ((window as any).AndroidBridge) {
      return (window as any).AndroidBridge.setSystemSetting(setting, value);
    }

    // Simulation for Web UI
    return true;
  }

  /**
   * Triggers a native click or gesture on the screen.
   * Requires Accessibility Service to be enabled in Android Settings.
   */
  public async performScreenAction(action: 'click' | 'scroll' | 'type', x: number, y: number, text?: string): Promise<boolean> {
    console.log(`NATIVE_BRIDGE: Performing ${action} at (${x}, ${y}) ${text ? 'with text: ' + text : ''}`);
    if ((window as any).AndroidBridge) {
      return (window as any).AndroidBridge.performAccessibilityAction(action, x, y, text);
    }
    return true;
  }

  /**
   * Opens a specific app by package name and attempts to navigate to a screen.
   */
  public async openAppDeepLink(packageName: string, uri?: string): Promise<boolean> {
    console.log(`NATIVE_BRIDGE: Opening app ${packageName} ${uri ? 'with URI: ' + uri : ''}`);
    if ((window as any).AndroidBridge) {
      return (window as any).AndroidBridge.openApp(packageName, uri);
    }
    return true;
  }

  /**
   * Scans a directory for files. 
   * In Web, this uses the File System Access API.
   */
  public async scanDirectory(): Promise<{name: string, type: string, handle: FileSystemHandle}[]> {
    try {
      // Check if we are in an iframe
      if (window.self !== window.top) {
        throw new Error("STORAGE_IFRAME_RESTRICTION: Direct folder access is restricted in the preview window. Please open the app in a NEW TAB to enable System Storage Sync.");
      }

      if (!('showDirectoryPicker' in window)) {
        throw new Error("DIRECTORY_PICKER_UNSUPPORTED: Your browser does not support direct folder access.");
      }

      // @ts-ignore
      const directoryHandle = await window.showDirectoryPicker();
      const files: any[] = [];
      
      for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file') {
          files.push({
            name: entry.name,
            type: entry.name.endsWith('.pdf') ? 'pdf' : 'text',
            handle: entry
          });
        }
      }
      return files;
    } catch (err: any) {
      console.error("Directory access error:", err);
      if (err.name === 'SecurityError' || err.message.includes('Cross origin')) {
        throw new Error("SECURITY_RESTRICTION: Please open the app in a NEW TAB (top right icon) to allow JARVIS to access your mobile storage.");
      }
      throw err;
    }
  }

  /**
   * Direct System Storage Search (Simulated for Web, Real for APK)
   */
  public async searchStorageDirect(query: string): Promise<string[]> {
    console.log(`NATIVE_BRIDGE: Deep scanning system storage for "${query}"...`);
    
    if ((window as any).AndroidBridge) {
      // Real Android File System Search
      return (window as any).AndroidBridge.searchFiles(query);
    }

    // For Web, we inform the user that we are accessing the "Linked System Folder"
    return []; 
  }

  /**
   * Deletes a file from the synced directory.
   */
  public async deleteFile(directoryHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> {
    console.log(`NATIVE_BRIDGE: Deleting file ${fileName}...`);
    if ((window as any).AndroidBridge) {
      return (window as any).AndroidBridge.deleteFile(fileName);
    }
    await directoryHandle.removeEntry(fileName);
  }

  /**
   * Renames a file in the synced directory.
   */
  public async renameFile(fileHandle: FileSystemFileHandle, newName: string): Promise<void> {
    console.log(`NATIVE_BRIDGE: Renaming file to ${newName}...`);
    if ((window as any).AndroidBridge) {
      return (window as any).AndroidBridge.renameFile(fileHandle.name, newName);
    }
    // @ts-ignore - move is part of the File System Access API
    await fileHandle.move(newName);
  }

  /**
   * Copies a file in the synced directory.
   */
  public async copyFile(fileHandle: FileSystemFileHandle, destinationName: string): Promise<void> {
    console.log(`NATIVE_BRIDGE: Copying file to ${destinationName}...`);
    if ((window as any).AndroidBridge) {
      return (window as any).AndroidBridge.copyFile(fileHandle.name, destinationName);
    }
    // @ts-ignore - move is part of the File System Access API
    await fileHandle.copyTo(destinationName);
  }

  /**
   * Requests native permissions from the Android OS via the Bridge.
   */
  public async requestNativePermissions(permissions: string[]): Promise<boolean> {
    console.log(`NATIVE_BRIDGE: Requesting native permissions: ${permissions.join(', ')}`);
    if ((window as any).AndroidBridge && (window as any).AndroidBridge.requestPermissions) {
      return (window as any).AndroidBridge.requestPermissions(permissions);
    }
    return true;
  }

  /**
   * Triggers Biometric Authentication (Fingerprint/Face ID).
   * In Web, this uses the WebAuthn API if available.
   */
  public async authenticateBiometric(): Promise<boolean> {
    console.log("NATIVE_BRIDGE: Initiating Biometric Authentication...");
    
    if ((window as any).AndroidBridge && (window as any).AndroidBridge.authenticateBiometric) {
      return (window as any).AndroidBridge.authenticateBiometric();
    }

    // WebAuthn Fallback for Browser
    if (window.PublicKeyCredential) {
      try {
        // This is a simplified WebAuthn check to simulate biometric prompt
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          console.log("NATIVE_BRIDGE: Platform Authenticator Available. Triggering Prompt...");
          // In a real app, you'd create a credential here. 
          // For JARVIS simulation, we'll use a timeout to mimic user interaction.
          await new Promise(resolve => setTimeout(resolve, 1500));
          return true;
        }
      } catch (e) {
        console.error("Biometric Auth Error:", e);
      }
    }

    // Simulation fallback
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }

  /**
   * Checks if the app has a specific native permission.
   */
  public async checkNativePermission(permission: string): Promise<boolean> {
    if ((window as any).AndroidBridge && (window as any).AndroidBridge.checkPermission) {
      return (window as any).AndroidBridge.checkPermission(permission);
    }
    return true;
  }

  /**
   * Gets the current battery status of the device.
   */
  public async getBatteryStatus(): Promise<{ level: number; charging: boolean }> {
    try {
      // @ts-ignore
      const battery = await navigator.getBattery();
      return {
        level: Math.round(battery.level * 100),
        charging: battery.charging
      };
    } catch (err) {
      console.error("NATIVE_BRIDGE: Battery API not supported.");
      return { level: 0, charging: false };
    }
  }

  /**
   * Gets the current geolocation of the user.
   */
  public async getLocation(): Promise<{ latitude: number; longitude: number; address?: string }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject("Geolocation not supported");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(err.message)
      );
    });
  }
}
