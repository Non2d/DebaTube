export enum ModelStatus {
  PRODUCTION = 'production',
  COMING_SOON = 'coming-soon',
  DEV_ONLY = 'dev-only',
}

/**
 * Audio/Transcription Models
 */
export const TRANSCRIPTION_MODELS = [
  { value: 'colab-faster-whisper-large-v2', label: 'faster-whisper / whisper-large-v2 (Colab)', enabled: false, status: ModelStatus.COMING_SOON },
  { value: 'gpu-service-faster-whisper-large-v2', label: 'faster-whisper / whisper-large-v2 (GPU Service)', enabled: true, status: ModelStatus.PRODUCTION },
  { value: 'groq-whisper-large-v3', label: 'whisper-large-v3 (Groq)', enabled: false, status: ModelStatus.COMING_SOON },
  { value: 'groq-whisper-large-v3-turbo', label: 'whisper-large-v3-turbo (Groq)', enabled: false, status: ModelStatus.COMING_SOON },
  { value: 'openai-whisper-1', label: 'whisper-1 (OpenAI)', enabled: false, status: ModelStatus.COMING_SOON },
] as const;

export type TranscriptionModelValue = typeof TRANSCRIPTION_MODELS[number]['value'];

/**
 * Check if a model requires Colab configuration
 */
export function requiresColabConfig(model: TranscriptionModelValue): boolean {
  return model === 'colab-faster-whisper-large-v2';
}

/**
 * Check if a model requires GPU Service configuration
 */
export function requiresGpuServiceConfig(model: TranscriptionModelValue): boolean {
  return model === 'gpu-service-faster-whisper-large-v2';
}
