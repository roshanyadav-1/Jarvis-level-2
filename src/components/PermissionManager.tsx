import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Smartphone, Camera, Mic, FolderOpen, MousePointer2 } from 'lucide-react';
import { NativeBridgeService } from '../services/NativeBridge';
import { motion, AnimatePresence } from 'motion/react';

interface PermissionStatus {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'granted' | 'denied' | 'pending';
  androidPermission: string;
  description: string;
}

export const PermissionManager: React.FC = () => {
  const bridge = NativeBridgeService.getInstance();
  const [permissions, setPermissions] = useState<PermissionStatus[]>([
    {
      id: 'storage',
      name: 'Storage Access',
      icon: <FolderOpen className="w-5 h-5" />,
      status: 'pending',
      androidPermission: 'android.permission.READ_EXTERNAL_STORAGE',
      description: 'Required to read and manage your files.'
    },
    {
      id: 'camera',
      name: 'Camera',
      icon: <Camera className="w-5 h-5" />,
      status: 'pending',
      androidPermission: 'android.permission.CAMERA',
      description: 'Required for vision analysis and taking photos.'
    },
    {
      id: 'mic',
      name: 'Microphone',
      icon: <Mic className="w-5 h-5" />,
      status: 'pending',
      androidPermission: 'android.permission.RECORD_AUDIO',
      description: 'Required for voice commands and wake word detection.'
    },
    {
      id: 'accessibility',
      name: 'Automation Service',
      icon: <MousePointer2 className="w-5 h-5" />,
      status: 'pending',
      androidPermission: 'android.settings.ACCESSIBILITY_SETTINGS',
      description: 'CRITICAL: Required for JARVIS to control other apps.'
    }
  ]);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    const updated = await Promise.all(permissions.map(async (p) => {
      const granted = await bridge.checkNativePermission(p.androidPermission);
      return { ...p, status: granted ? 'granted' : 'denied' } as PermissionStatus;
    }));
    setPermissions(updated);
  };

  const requestPermission = async (p: PermissionStatus) => {
    const success = await bridge.requestNativePermissions([p.androidPermission]);
    if (success) {
      setPermissions(prev => prev.map(item => 
        item.id === p.id ? { ...item, status: 'granted' } : item
      ));
    }
  };

  const allGranted = permissions.every(p => p.status === 'granted');

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-lg flex items-center justify-center transition-colors ${
          allGranted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
        }`}
      >
        {allGranted ? <Shield className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6 animate-pulse" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-16 right-0 w-80 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="p-4 border-bottom border-white/5 bg-white/5 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                Native Permissions
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white">
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
              {permissions.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/5 text-indigo-400">
                        {p.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{p.name}</p>
                        <p className="text-[10px] text-white/40 leading-tight">{p.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.status === 'granted' && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          <span className="text-[8px] font-bold text-emerald-500 uppercase">Granted</span>
                        </div>
                      )}
                      {p.status === 'denied' && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span className="text-[8px] font-bold text-red-500 uppercase">Denied</span>
                          </div>
                          <button
                            onClick={() => requestPermission(p)}
                            className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/50 rounded-md hover:bg-red-500/30 transition-all"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {p.status === 'pending' && (
                        <button
                          onClick={() => requestPermission(p)}
                          className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all active:scale-95"
                        >
                          Grant Access
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!allGranted && (
              <div className="p-4 bg-amber-500/10 border-t border-amber-500/20">
                <p className="text-[10px] text-amber-200/70 leading-relaxed">
                  <AlertTriangle className="w-3 h-3 inline mr-1 mb-0.5" />
                  {!(window as any).AndroidBridge ? 
                    "NATIVE_BRIDGE_MISSING: This APK was built without native integration. Permissions cannot be managed automatically." :
                    "Some permissions are missing. JARVIS might not be able to execute all automation commands in APK mode."
                  }
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
