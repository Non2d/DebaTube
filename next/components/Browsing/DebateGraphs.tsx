import React, { useState, useEffect, useRef, createRef } from 'react';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { getAPIRoot } from '../lib/utils';
import MacroStructure from '../MacroStructure/MacroStructure';
import Youtube from 'react-youtube';
import toast from "react-hot-toast";
import Header from '../shared/Header';
import { useAtom } from 'jotai';
import { themeAtom } from '../store/userAtom';

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

const DebateGraphs = () => {
  const [isDark] = useAtom(themeAtom);
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
    fetch(getAPIRoot() + '/batch-rounds-with-features', {
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
        setIsLoading(false);
      });
  }, []);

  const logOperation = async (operation: string, data: object) => {
    const requestBody = {
      operation,
      data: {
        ...data,
        user_name: 'Anonymous',
      },
    };

    try {
      const response = await fetch(getAPIRoot() + '/log/operation', {
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
    } catch (error) {
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
    // まず選択されたアイテム全体をソートする
    const sortedSelectedItems = [...selectedDebateItems].sort((a, b) => {
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

    // ソート済みの中からピン留めとそうでないものを分ける
    const pinnedDebateItems = sortedSelectedItems.filter(item => pinnedItems.includes(item.id));
    const unpinnedDebateItems = sortedSelectedItems.filter(item => !pinnedItems.includes(item.id));

    setDisplayDebateItems([...pinnedDebateItems, ...unpinnedDebateItems]);
  }, [pinnedItems, selectedDebateItems, sortOption]);

  const onMovieItemClicked = (id: number) => async () => {
    setPinnedItems((prev) => {
      const newPinnedItems = prev.includes(id) 
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      
      return newPinnedItems;
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

  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-100';

  return (
    <>
      <Header />
      <div className={`${bgColor} ${textColor} flex flex-col w-full mx-auto p-4 gap-2 min-h-screen pt-20`}>
        {/* --- コンテンツヘッダー --- */}
        <header className={`flex items-center justify-between ${bgColor} border-b ${borderColor} pb-4`}>
          <div className="flex items-center gap-6">
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-auto">
              <TabsList>
                {tabValues.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        
        <div className="flex items-center gap-4">
          {/* ピン留め情報を表示 */}
          {pinnedItems.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 shadow-sm">
              <div className="p-1 bg-amber-100 rounded-lg">
                <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2L3 9h4v9h6v-9h4l-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-amber-800">
                {pinnedItems.length} pinned
              </span>
            </div>
          )}

          {/* ソート選択ドロップダウン */}
          <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Sort by</span>
            </div>
            <div className="h-4 w-px bg-gray-300"></div>
            <select
              value={sortOption}
              onChange={(e) => {
                const newSortOption = e.target.value;
                setSortOption(newSortOption);
                logOperation('SortChanged', {
                  sort_option: newSortOption,
                });
              }}
              className="bg-transparent border-none text-sm font-semibold text-gray-900 focus:outline-none focus:ring-0 cursor-pointer appearance-none min-w-[80px]"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value} className="text-gray-900 bg-white">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

        <>

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
                          {/* Features表示 */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {sortOption}: {item.features[sortOption.toLowerCase() as keyof MacroStructuralFeatures]?.toFixed(3)}
                            </span>
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

          {/* --- 動画ポップアップ --- */}
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
      </div>
    </>
  );

};

export default DebateGraphs;