export enum ModelStatus {
  PRODUCTION = 'production',
  COMING_SOON = 'coming-soon',
  DEV_ONLY = 'dev-only',
}

interface ModelOption<T extends string = string> {
  value: T;
  label: string;
  enabled: boolean;
  status: ModelStatus;
}

/**
 * Transcription Model Values
 */
export enum TranscriptionModelValue {
  COLAB_FASTER_WHISPER = 'colab-faster-whisper-large-v2',
  GPU_SERVICE_FASTER_WHISPER = 'gpu-service-faster-whisper-large-v2',
  GROQ_WHISPER_V3 = 'groq-whisper-large-v3',
  GROQ_WHISPER_V3_TURBO = 'groq-whisper-large-v3-turbo',
  OPENAI_WHISPER = 'openai-whisper-1',
}

/**
 * Audio/Transcription Models
 */
const TRANSCRIPTION_MODELS_LIST: ModelOption<TranscriptionModelValue>[] = [
  { value: TranscriptionModelValue.COLAB_FASTER_WHISPER, label: 'faster-whisper / whisper-large-v2 (Colab)', enabled: false, status: ModelStatus.COMING_SOON },
  { value: TranscriptionModelValue.GPU_SERVICE_FASTER_WHISPER, label: 'faster-whisper / whisper-large-v2 (GPU Service)', enabled: true, status: ModelStatus.PRODUCTION },
  { value: TranscriptionModelValue.GROQ_WHISPER_V3, label: 'whisper-large-v3 (Groq)', enabled: false, status: ModelStatus.COMING_SOON },
  { value: TranscriptionModelValue.GROQ_WHISPER_V3_TURBO, label: 'whisper-large-v3-turbo (Groq)', enabled: false, status: ModelStatus.COMING_SOON },
  { value: TranscriptionModelValue.OPENAI_WHISPER, label: 'whisper-1 (OpenAI)', enabled: false, status: ModelStatus.COMING_SOON },
];

export const TRANSCRIPTION_MODELS = {
  list: TRANSCRIPTION_MODELS_LIST,

  requiresColabConfig(model: TranscriptionModelValue): boolean {
    return model === TranscriptionModelValue.COLAB_FASTER_WHISPER;
  },

  requiresGpuServiceConfig(model: TranscriptionModelValue): boolean {
    return model === TranscriptionModelValue.GPU_SERVICE_FASTER_WHISPER;
  },
};

/**
 * NLP/LLM Model Values
 */
export enum NLPLLMValue {
  GEMINI_2_5_FLASH_STUDIO = 'gemini_2_5_flash_studio',
  GEMINI_2_5_FLASH_VERTEX = 'gemini_2_5_flash_vertex',
  GEMINI_2_5_FLASH_LITE_STUDIO = 'gemini_2_5_flash_lite_studio',
  GEMINI_2_5_FLASH_LITE_VERTEX = 'gemini_2_5_flash_lite_vertex',
  GEMINI_3_FLASH_STUDIO = 'gemini_3_flash_studio',
}

/**
 * NLP/LLM Models (for debate analysis)
 */
const NLP_LLMS_LIST: ModelOption<NLPLLMValue>[] = [
  { value: NLPLLMValue.GEMINI_2_5_FLASH_STUDIO, label: 'gemini-2.5-flash (google ai studio)', enabled: true, status: ModelStatus.PRODUCTION },
  { value: NLPLLMValue.GEMINI_2_5_FLASH_VERTEX, label: 'gemini-2.5-flash (vertex ai)', enabled: true, status: ModelStatus.DEV_ONLY },
  { value: NLPLLMValue.GEMINI_2_5_FLASH_LITE_STUDIO, label: 'gemini-2.5-flash-lite (google ai studio)', enabled: true, status: ModelStatus.DEV_ONLY },
  { value: NLPLLMValue.GEMINI_2_5_FLASH_LITE_VERTEX, label: 'gemini-2.5-flash-lite (vertex ai)', enabled: true, status: ModelStatus.DEV_ONLY },
  { value: NLPLLMValue.GEMINI_3_FLASH_STUDIO, label: 'gemini-3-flash (google ai studio)', enabled: true, status: ModelStatus.PRODUCTION },
];

export const NLP_LLMS = {
  list: NLP_LLMS_LIST,

  /**
   * Get available models based on environment
   * Filters out DEV_ONLY models in production
   */
  available() {
    if (process.env.NODE_ENV === 'production') {
      return NLP_LLMS_LIST.filter(m => m.status !== ModelStatus.DEV_ONLY && m.enabled);
    }
    return NLP_LLMS_LIST.filter(m => m.enabled);
  },

  /**
   * Get default model for the current environment
   */
  default(): NLPLLMValue {
    const available = this.available();
    return available[0]?.value || NLPLLMValue.GEMINI_2_5_FLASH_STUDIO;
  },
};
