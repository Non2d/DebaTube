import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * バックグラウンド・バッチ処理のステップステータス
 * - not_in_queue: 処理がキューに登録されていない
 * - in_queue: キューに登録済み（処理待ち）
 * - processing: 処理中
 * - done: 完了
 * - error: エラー（前ステップが完了していない）
 */
export type BackgroundStepStatus = 'not_in_queue' | 'in_queue' | 'processing' | 'done' | 'error';

/**
 * バックエンド側のステータス文字列をフロント側の型に変換
 * バックエンド: "NOT_IN_QUEUE", "IN_QUEUE", "PROCESSING", "DONE"
 * フロント: 'not_in_queue', 'in_queue', 'processing', 'done'
 */
export function mapBackgroundStatus(backendStatus: string): BackgroundStepStatus {
  switch (backendStatus) {
    case 'NOT_IN_QUEUE':
      return 'not_in_queue';
    case 'IN_QUEUE':
      return 'in_queue';
    case 'PROCESSING':
      return 'processing';
    case 'DONE':
      return 'done';
    default:
      return 'not_in_queue';
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAPIRoot(): string {
    const host = typeof window !== "undefined" ? window.location.host : "";
    return host.endsWith(".ts.net")
        ? `https://${host}/v1`
        : process.env.NODE_ENV === "production"
        ? "https://vps4.nkmr.io/debates/v1"
        : "http://localhost:8080";
}

export function calculateMode(numbers: number[]): number | null {
    const frequencyMap: { [key: number]: number } = {};

    // 出現回数をカウント
    for (const num of numbers) {
        frequencyMap[num] = (frequencyMap[num] || 0) + 1;
    }

    // 最頻値を求める
    const entries = Object.entries(frequencyMap) as [string, number][];
    const modeEntry = entries.reduce<[number | null, number]>((acc, [num, count]) => {
        return count > acc[1] ? [Number(num), count] : acc;
    }, [null, 0]);

    return modeEntry[0];
}

/**
 * Convert internal model format to display format
 * "gemini_2_5_flash_studio" → "gemini-2.5-flash (google ai studio)"
 * "gemini_2_5_flash_vertex" → "gemini-2.5-flash (vertex ai)"
 */
export function formatModelName(internalName: string): string {
    const modelMap: { [key: string]: string } = {
        "gemini_2_5_flash_studio": "gemini-2.5-flash (google ai studio)",
        "gemini_2_5_flash_vertex": "gemini-2.5-flash (vertex ai)",
        "gemini_2_5_flash_lite_studio": "gemini-2.5-flash-lite (google ai studio)",
        "gemini_2_5_flash_lite_vertex": "gemini-2.5-flash-lite (vertex ai)",
        "gemini_3_flash_studio": "gemini-3-flash (google ai studio)",
    };
    return modelMap[internalName] || internalName;
}

/**
 * Convert display format back to internal model format
 * "gemini-2.5-flash (google ai studio)" → "gemini_2_5_flash_studio"
 * "gemini-2.5-flash (vertex ai)" → "gemini_2_5_flash_vertex"
 */
export function toInternalModelName(displayName: string): string {
    const reverseMap: { [key: string]: string } = {
        "gemini-2.5-flash (google ai studio)": "gemini_2_5_flash_studio",
        "gemini-2.5-flash (vertex ai)": "gemini_2_5_flash_vertex",
        "gemini-2.5-flash-lite (google ai studio)": "gemini_2_5_flash_lite_studio",
        "gemini-2.5-flash-lite (vertex ai)": "gemini_2_5_flash_lite_vertex",
        "gemini-3-flash (google ai studio)": "gemini_3_flash_studio",
    };
    return reverseMap[displayName] || displayName;
}
