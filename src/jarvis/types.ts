/**
 * JARVIS V1 Architecture Types
 */

export enum Layer {
  Voice = "Voice",
  Language = "Language",
  Planning = "Planning",
  Automation = "Automation",
  Device = "Device",
  Response = "Response",
  Memory = "Memory",
  Security = "Security",
  Stability = "Stability",
  Infrastructure = "Infrastructure",
  Task = "Task",
  Monitoring = "Monitoring",
  Intelligence = "Intelligence",
  Data = "Data",
  Update = "Update",
  Sandbox = "Sandbox"
}

export interface Module {
  id: string;
  name: string;
  layer: Layer;
  status: 'idle' | 'active' | 'error';
  initialize: () => Promise<void>;
  execute: (params?: any) => Promise<any>;
}

export enum SystemAction {
  OPEN_APP = 'OPEN_APP',
  SEND_MESSAGE = 'SEND_MESSAGE',
  SYSTEM_QUERY = 'SYSTEM_QUERY',
  CAMERA_ACCESS = 'CAMERA_ACCESS',
  CONTACTS_SYNC = 'CONTACTS_SYNC',
  SENSOR_DATA = 'SENSOR_DATA',
  FILE_SYSTEM = 'FILE_SYSTEM',
  BIOMETRIC_AUTH = 'BIOMETRIC_AUTH',
  SETTINGS_CONTROL = 'SETTINGS_CONTROL',
  APP_MANAGEMENT = 'APP_MANAGEMENT',
  APP_INSTALL = 'APP_INSTALL',
  CAMERA_CONTROL = 'CAMERA_CONTROL',
  WEB_SEARCH = 'WEB_SEARCH',
  GOOGLE_SEARCH = 'GOOGLE_SEARCH',
  CALL_PERSON = 'CALL_PERSON',
  TOGGLE_DATA = 'TOGGLE_DATA',
  GET_TIME = 'GET_TIME',
  MEDIA_CONTROL = 'MEDIA_CONTROL',
  SENSITIVE_ACTION = 'SENSITIVE_ACTION',
  UNKNOWN = 'UNKNOWN',
  ALARM_CONTROL = 'ALARM_CONTROL',
  SANDBOX_EXECUTION = 'SANDBOX_EXECUTION'
}

export interface JarvisState {
  activeModules: string[];
  systemStatus: 'nominal' | 'warning' | 'critical';
  lastEvent: string;
  memory: Record<string, any>;
}

