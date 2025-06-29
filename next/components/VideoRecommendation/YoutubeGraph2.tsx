import React, { useState, useEffect, useRef, createRef } from 'react';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { apiRoot } from '../utils/foundation';
import MacroStructure from '../MacroStructure/MacroStructure';
import Youtube from 'react-youtube';
import toast from "react-hot-toast";
import { useAtom } from 'jotai';
import { userNameAtom } from '../store/userAtom';
// import { toPng } from 'html-to-image';

interface MacroStructuralFeatures {
  distance: number;
  interval: number;
  order: number;
  rally: number;
}

interface DebateItem { //UI表示用にデータ生成する際のバリデーション
  id: number
  videoId: string
  title: string
  motion: string
  publishedAt: string
  tag: string
  description: string
  features: MacroStructuralFeatures

  graphItems: {
    roundId: number;
    pois: any;
    speeches: any;
    rebuttals: any;
  }
}
interface Round { //取得時のバリデーション
  id: number;
  video_id: string;
  title: string;
  description: string;
  motion: string;
  date_uploaded: string;
  channel_id: string;
  tag: string;
  features: MacroStructuralFeatures;

  pois: any;
  speeches: any;
  rebuttals: any;
}

const YoutubeGraph2 = () => {
  const [username, setUsername] = useAtom(userNameAtom);
  const [hydrated, setHydrated] = useState(false);

  const [ytPlayer, setYtPlayer] = useState<YT.Player | null>(null);
  const [ytId, setYtId] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytIsRight, setYtIsRight] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState('All');
  const [debateItems, setDebateItems] = useState<DebateItem[]>([]);
  const [selectedDebateItems, setSelectedDebateItems] = useState<DebateItem[]>([]);
  const [pinnedItems, setPinnedItems] = useState<number[]>([]);
  const [displayDebateItems, setDisplayDebateItems] = useState<DebateItem[]>([]);
  const [whenToSeek, setWhenToSeek] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [sortOption, setSortOption] = useState('Distance');

  // 各MacroStructureコンポーネントへのrefを格納する配列
  const macroStructureRefs = useRef<React.RefObject<HTMLDivElement>[]>([]);

  const tabValues = [
    { value: "All", label: "All" },
    { value: "CriminalJustice", label: "Criminal Justice" },
    { value: "Gender", label: "Gender" },
    { value: "Economy", label: "Economy" },
    { value: "Politics", label: "Politics" },
  ];

  const sortOptions = [
    { value: "Distance", label: "Distance" },
    { value: "Interval", label: "Interval" },
    { value: "Order", label: "Order" },
    { value: "Rally", label: "Rally" },
  ];
  const ytProps = {
    height: (800 * 9) / 16,
    width: 800,
    playerVars: {
      autoplay: 1, // 自動再生を無効
    },
  };

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!username) {
      const input = prompt('Please enter your name:');
      if (input) {
        setUsername(input);
      }
    }
  }, [hydrated, username]);

  useEffect(() => {
    fetch(apiRoot + '/batch-rounds-with-features', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then((data: Round[]) => {
        const debateItems = data.map(round => ({
          id: round.id,
          videoId: round.video_id,
          title: round.title,
          motion: round.motion,
          description: round.description,
          publishedAt: round.date_uploaded,
          tag: round.tag,
          features: round.features,
          graphItems: {
            roundId: round.id,
            pois: round.pois,
            speeches: round.speeches,
            rebuttals: round.rebuttals,
          }
        }));
        setDebateItems(debateItems);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setIsLoading(false); // エラーが発生してもローディング状態を解除
      });
  }, []);

  const logOperation = async (operation: string, data: object) => {
    const requestBody = {
      operation,
      data: {
        ...data, // 既存のデータを展開
        user_name: username, // user_name プロパティを追加
      },
    };

    try {
      const response = await fetch(apiRoot + '/log/operation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const result = await response.json();
      // console.log('Operation logged successfully:', result);
    } catch (error) {
      // console.error('Error ', error);
    }
  };

  useEffect(() => {
    logOperation('TagClicked', {
      tag: selectedTab,
    });

    setPinnedItems([]);

    const filteredItems = selectedTab === 'All'
      ? debateItems
      : debateItems.filter(item => item.tag && item.tag.toLowerCase().includes(selectedTab.toLowerCase()));

    setSelectedDebateItems(filteredItems);
  }, [selectedTab, debateItems]);

  useEffect(() => { //カテゴリ変更時、ピン留め時、またはソート変更時に更新
    const pinnedDebateItems = pinnedItems
      .map(pinnedId => selectedDebateItems.find(item => item.id === pinnedId))
      .filter(item => item !== undefined) as DebateItem[];

    const unpinnedDebateItems = selectedDebateItems
      .filter(item => !pinnedItems.includes(item.id))
      .sort((a, b) => {
        // ソートオプションに基づいて並び替え
        switch (sortOption) {
          case 'Distance':
            return b.features.distance - a.features.distance; // 降順
          case 'Interval':
            return b.features.interval - a.features.interval; // 降順
          case 'Order':
            return b.features.order - a.features.order; // 降順
          case 'Rally':
            return b.features.rally - a.features.rally; // 降順
          default:
            return b.id - a.id; // デフォルトは ID の降順
        }
      });

    setDisplayDebateItems([...pinnedDebateItems, ...unpinnedDebateItems]);
  }, [pinnedItems, selectedDebateItems, sortOption]);

  const onMovieItemClicked = (id: number) => async () => {
    setPinnedItems((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });

    await logOperation('MovieItemClicked', {
      clicked_round_id: id,
      previous_pinned_items: pinnedItems,
    });
  };

  const onGraphNodeRightClicked = async (roundId: number, start: number, nodeSequenceId: number) => {
    const nodeOwnerRound = selectedDebateItems.find(item => item.id === roundId);
    setWhenToSeek(start);

    if (!nodeOwnerRound) {
      console.error(`Round with id ${roundId} not found`);
      return;
    }

    if (!nodeOwnerRound.videoId || !nodeOwnerRound.title) {
      console.error(`Round with id ${roundId} is missing videoId or title`);
      return;
    }

    setYtId(nodeOwnerRound.videoId);
    setYtTitle(nodeOwnerRound.title);
    setIsVisible(true);

    await logOperation('GraphNodeClicked', {
      owner_round_id: roundId,
      node_start: start,
      node_sequence_id: nodeSequenceId,
    });

  };

  useEffect(() => {
    if (ytPlayer) {
      const timeoutId = setTimeout(() => {
        ytPlayer.seekTo(whenToSeek, true);
      }, 700); // 1.0秒 (1000ミリ秒) 遅らせる

      // クリーンアップ関数を返して、コンポーネントがアンマウントされたときにタイムアウトをクリア
      return () => clearTimeout(timeoutId);
    }
  }, [whenToSeek, ytPlayer]);

  const onPlayerReady = (event: any) => {
    setYtPlayer(event.target);
  };

  const taskIsDone = () => async () => {
    toast.success('Task is done!');
    await logOperation('TaskIsDone', {
      pinned_items: pinnedItems,
    });
  }

  // displayDebateItemsが変更されたときにrefの配列を更新
  useEffect(() => {
    macroStructureRefs.current = displayDebateItems.map((_, i) =>
      macroStructureRefs.current[i] || createRef()
    );
  }, [displayDebateItems]);

  // 一括画像エクスポート関数
  // const exportAllImages = async () => {
  //   setIsExporting(true);

  //   // ピン留めされたアイテムがある場合はそれらのみ、なければ全てをエクスポート
  //   const itemsToExport = pinnedItems.length > 0
  //     ? displayDebateItems.filter(item => pinnedItems.includes(item.id))
  //     : displayDebateItems;

  //   const exportType = pinnedItems.length > 0 ? 'ピン留め' : '全';
  //   toast.loading(`${exportType}画像をエクスポート中...`, { id: 'export-toast' });

  //   try {
  //     for (let i = 0; i < itemsToExport.length; i++) {
  //       const item = itemsToExport[i];
  //       // 元の配列でのインデックスを取得
  //       const originalIndex = displayDebateItems.findIndex(debateItem => debateItem.id === item.id);
  //       const ref = macroStructureRefs.current[originalIndex];

  //       if (ref && ref.current) {
  //         await new Promise(resolve => setTimeout(resolve, 500)); // 少し待機

  //         const targetElement = ref.current;

  //         // 余白を設定（ピクセル単位）
  //         const verticalPadding = 20; // 上下の余白
  //         const horizontalPadding = 0; // 左右の余白

  //         // 元のサイズを取得
  //         const originalWidth = targetElement.scrollWidth;
  //         const originalHeight = targetElement.scrollHeight;

  //         // 余白を含めた新しいサイズを計算
  //         const newWidth = originalWidth + (horizontalPadding * 2);
  //         const newHeight = originalHeight + (verticalPadding * 2);

  //         // 中央揃えのための変換を計算
  //         const translateX = horizontalPadding;
  //         const translateY = verticalPadding;

  //         // const dataUrl = await toPng(targetElement, {
  //         //   backgroundColor: '#ffffff',
  //         //   pixelRatio: 2, // 高解像度
  //         //   filter: (node:any) => {
  //         //     // ReactFlowのコントロールやミニマップを除外
  //         //     return !node?.classList?.contains('react-flow__controls') &&
  //         //       !node?.classList?.contains('react-flow__minimap') &&
  //         //       !node?.classList?.contains('react-flow__attribution');
  //         //   },
  //         //   // 余白を含めたサイズに設定
  //         //   width: newWidth,
  //         //   height: newHeight,
  //         //   style: {
  //         //     // 中央揃えのためのtransform
  //         //     transform: `translate(${translateX}px, ${translateY}px)`,
  //         //     transformOrigin: 'top left'
  //         //   }
  //         // });

  //         // ファイル名を生成（タイトルから不正な文字を除去）
  //         const fileName = item.description
  //           .replace(/[<>:"/\\|?*]/g, '') // 不正な文字を除去
  //           .replace(/\s+/g, '_') // スペースをアンダースコアに
  //           .substring(0, 100); // 長すぎる場合は切り詰め

  //         // ダウンロード
  //         const link = document.createElement('a');
  //         link.download = `${fileName}_graph.png`;
  //         link.href = dataUrl;
  //         link.click();

  //         // 少し待機（ブラウザの負荷軽減）
  //         await new Promise(resolve => setTimeout(resolve, 200));
  //       }
  //     }

  //     toast.success(`${itemsToExport.length}件の画像をエクスポートしました！`, { id: 'export-toast' });

  //     // 操作ログを記録
  //     await logOperation('BulkImageExport', {
  //       exported_count: itemsToExport.length,
  //       export_type: pinnedItems.length > 0 ? 'pinned_only' : 'all',
  //       current_tab: selectedTab,
  //       pinned_items: pinnedItems
  //     });

  //   } catch (error) {
  //     console.error('Export error:', error);
  //     toast.error('エクスポート中にエラーが発生しました', { id: 'export-toast' });
  //   } finally {
  //     setIsExporting(false);
  //   }
  // };

  return (
    <div className="bg-white flex flex-col w-full mx-auto p-4 gap-2 min-h-screen">
      {/* --- ヘッダーは常に表示 --- */}
      <header className="flex items-center justify-start">
        <h2 className="text-xl font-bold mr-20">
          Deba<span className="text-red-600">Tube</span>
        </h2>
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-auto justify-start">
          <TabsList>
            {tabValues.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        
        {/* ソート選択ドロップダウンを右上に追加 */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Sort by:</span>
          <select
            value={sortOption}
            onChange={(e) => {
              const newSortOption = e.target.value;
              setSortOption(newSortOption);
              logOperation('SortChanged', {
                sort_option: newSortOption,
              });
            }}
            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 一括エクスポートボタンを追加 */}
        {/* <button
          onClick={exportAllImages}
          disabled={isExporting || displayDebateItems.length === 0}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting
            ? '📥 エクスポート中...'
            : pinnedItems.length > 0
              ? `📥 ピン留め画像エクスポート (${pinnedItems.length}件)`
              : `📥 全画像エクスポート (${displayDebateItems.length}件)`}
        </button> */}

        {/* <div
          className="ml-auto text-gray-700 text-xl font-medium cursor-pointer hover:underline"
          onClick={() => {
            localStorage.removeItem('user_name');
            setUsername('');
          }}
          title="クリックでログアウト"
        >
          Welcome {username}
        </div> */}
      </header>

      {/* --- ユーザー名が未入力なら案内を表示 --- */}
      {false ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 mt-20">
          <p className="text-lg font-medium">ユーザー名を入力してください</p>
          <p className="text-sm text-gray-400 mt-2">ブラウザをリロードすると再入力できます</p>
        </div>
      ) : (
        <>
          {/* --- ユーザー名がある場合のみメインコンテンツを表示 --- */}

          {isLoading ? (
            <>
              {/* ローディング中のスケルトンUI（省略せず） */}
              <div className="bg-white relative overflow-y-auto" style={{ paddingLeft: '5vw', paddingRight: '5vw' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
                  {[...Array(8)].map((_, index) => (
                    <div key={index} className="flex flex-col border-4 border-white animate-pulse">
                      <div className="mb-1 flex gap-4 bg-white">
                        <div className="aspect-square relative bg-gray-300 ml-1 mt-1 rounded-md" style={{ width: '8vh', height: '8vh' }}></div>
                        <div className="flex flex-col flex-grow">
                          <div className="h-4 bg-gray-300 rounded w-3/4 mb-1"></div>
                          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                        </div>
                      </div>
                      <div className="aspect-[16/9] relative bg-gray-300 rounded-md" style={{ height: '35vh' }}></div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* debateItems 表示部（省略せず） */}
              <div className="bg-white relative overflow-y-auto" style={{ paddingLeft: '5vw', paddingRight: '5vw' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
                  {displayDebateItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex flex-col border-4 ${pinnedItems.includes(item.id) ? 'border-yellow-500' : 'border-white'}`}
                      onDoubleClick={onMovieItemClicked(item.id)}
                    >
                      <div className="mb-1 flex gap-4 bg-white">
                        <div className="aspect-square relative bg-muted ml-1 mt-1" style={{ width: '8vh', height: '8vh' }}>
                          <Image
                            src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                            alt={item.title}
                            layout="fill"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex flex-col flex-grow">
                          <h3 className="font-medium text-base mb-1 line-clamp-1"> {item.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-3">{item.motion}</p>
                          <p className="text-sm text-muted-foreground">{new Date(item.publishedAt).toISOString().split('T')[0]}</p>
                          {/* Features表示（デバッグ用） */}
                          <div className="text-xs text-gray-400 mt-1">
                            {sortOption}: {item.features[sortOption.toLowerCase() as keyof MacroStructuralFeatures]?.toFixed(3)}
                          </div>
                        </div>
                      </div>
                      <div
                        className="aspect-[16/9] relative bg-white"
                        style={{ height: '35vh' }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{ pointerEvents: 'none' }}
                        >
                          <MacroStructure
                            ref={macroStructureRefs.current[index]}
                            data={item.graphItems}
                            onGraphNodeClicked={onGraphNodeRightClicked}
                            isPinned={pinnedItems.includes(item.id)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* --- 動画ポップアップも username あるときだけ表示 --- */}
          {isVisible && (
            <div
              className={`fixed bottom-4 ${ytIsRight ? 'right-4' : 'left-4'} rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden bg-black`}
              style={{ width: '800px', height: '500px' }}
            >
              <div className="flex items-center justify-between bg-gray-800 text-white px-3 py-2">
                <h4 className="text-sm font-semibold">{ytTitle}</h4>
                <div className="ml-auto flex items-center">
                  <button
                    onClick={() => setYtIsRight(!ytIsRight)}
                    className="text-gray-300 hover:text-red-500 ml-10 mr-3"
                  >
                    <span>{ytIsRight ? '←左下へ移動' : '→右下へ移動'}</span>
                  </button>
                  <button
                    onClick={() => setIsVisible(false)}
                    className="text-gray-300 hover:text-red-500 mr-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="w-full h-full">
                <Youtube
                  videoId={ytId}
                  opts={ytProps}
                  onReady={onPlayerReady}
                  className="w-full h-full"
                />
              </div>
            </div>
          )}

          {/* --- フッター --- */}
          <footer className="text-center py-4">
            <span className="text-gray-500 underline">
              Powered by{' '}
              <a href="https://reactflow.dev/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700">
                React Flow
              </a>
            </span>
          </footer>
        </>
      )}
    </div>
  );

};

export default YoutubeGraph2;