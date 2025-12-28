/**
 * ユーザー操作ログを記録するユーティリティ
 * すべてのログは日本時間のタイムスタンプとともに記録される
 */

const API_BASE_URL = 'http://localhost:8080';

/**
 * 日本時間のタイムスタンプを取得
 */
function getJapanTimestamp(): string {
  const now = new Date();
  // JavaScriptの Date は UTC なので、日本時間のオフセット (+9時間) を適用
  const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));

  // ISO形式: YYYY-MM-DDTHH:mm:ss.sssZ をさらに +09:00 を付与
  const isoString = jstDate.toISOString();
  // Z を +09:00 に置き換える
  return isoString.replace('Z', '+09:00');
}

/**
 * 汎用ログ送信関数
 */
async function sendLog(
  eventType: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const logRecord = {
      event_type: eventType,
      timestamp: getJapanTimestamp(),
      data
    };

    const response = await fetch(`${API_BASE_URL}/logs/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logRecord)
    });

    if (!response.ok) {
      console.warn(`Failed to log event: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error sending log:', error);
    // ログ送信エラーはサイレント（ユーザー体験に影響させない）
  }
}

/**
 * タブ切り替えイベントをログに記録
 */
export async function logTabSwitch(tab: string, matchName: string): Promise<void> {
  await sendLog(
    'tab_switch',
    {
      tab,
      match_name: matchName
    }
  );
}

/**
 * 音声再生イベント（再生・一時停止・シーク）をログに記録
 */
export async function logPlaybackEvent(
  eventType: 'play' | 'pause' | 'seek' | 'seek_start',
  speechIndex: number,
  timeSeconds: number
): Promise<void> {
  await sendLog(
    'playback',
    {
      action: eventType,
      speech_index: speechIndex,
      time_seconds: timeSeconds
    }
  );
}

/**
 * グラフのノードクリックイベントをログに記録
 */
export async function logGraphNodeClick(nodeId: number): Promise<void> {
  await sendLog(
    'graph_node_click',
    {
      node_id: nodeId
    }
  );
}

/**
 * 汎用イベントログ送信関数（柔軟性が必要な場合）
 */
export async function logCustomEvent(
  eventType: string,
  data: Record<string, any>
): Promise<void> {
  await sendLog(eventType, data);
}
