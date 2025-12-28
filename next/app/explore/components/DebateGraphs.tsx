import React, { useState, useEffect, useRef, createRef } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Pin } from 'lucide-react';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { getAPIRoot } from '../../../components/lib/utils';
import MacroStructure from './MacroStructure';
import Youtube from 'react-youtube';
import Header from '../../../components/shared/Header';
import { useTranslation } from '../../../context/LanguageContext';
import { useRouter } from 'next/navigation';

interface MacroStructuralFeatures {
  distance: number;
  interval: number;
  order: number;
  rally: number;
}
//...
// (Keep intervening interfaces - wait, replace_file_content needs exact match or smartness.)
// I will target the imports and the hook usage separately or using a large chunk if stable.
// Let's use simple separate replacements if possible, or one chunk if I am sure.
// The interfaces are long. I will target Top imports first.

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
  tryCount: number

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
  try_count: number;

  pois: any;
  speeches: any;
  rebuttals: any;
}

const DebateGraphs = () => {
  const { isDark, t } = useTranslation();
  const router = useRouter();
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
  const [sortOption, setSortOption] = useState('Date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 各MacroStructureコンポーネントへのrefを格納する配列
  const macroStructureRefs = useRef<React.RefObject<HTMLDivElement>[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* 
   * タブとソートオプションの定義をuseTranslationフック内に移動するか、
   * レンダリング時に翻訳関数を使用するように変更する必要があります。
   * ここでは単純にレンダリング部分で翻訳キーを使用するように変更します。
   */
  const tabValues = [
    { value: "All", labelKey: "explore.tabs.all" },
    { value: "CriminalJustice", labelKey: "explore.tabs.criminalJustice" },
    { value: "Gender", labelKey: "explore.tabs.gender" },
    { value: "Economy", labelKey: "explore.tabs.economy" },
    { value: "Politics", labelKey: "explore.tabs.politics" },
  ];

  const sortOptions = [
    { value: "Date", labelKey: "explore.sort.date", descriptionKey: "explore.sort.dateDesc" },
    { value: "Distance", labelKey: "explore.sort.distance", descriptionKey: "explore.sort.distanceDesc" },
    { value: "Interval", labelKey: "explore.sort.interval", descriptionKey: "explore.sort.intervalDesc" },
    { value: "Order", labelKey: "explore.sort.order", descriptionKey: "explore.sort.orderDesc" },
    { value: "Rally", labelKey: "explore.sort.rally", descriptionKey: "explore.sort.rallyDesc" },
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
          tryCount: round.try_count || 1,
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

  useEffect(() => {
    const sortedItems: DebateItem[] = [...selectedDebateItems];

    const getSortValue = (item: DebateItem) => {
      switch (sortOption) {
        case 'Date': return new Date(item.publishedAt).getTime();
        case 'Distance': return item.features.distance;
        case 'Interval': return item.features.interval;
        case 'Order': return item.features.order;
        case 'Rally': return item.features.rally;
        default: return item.id;
      }
    };

    sortedItems.sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });

    const sortedPinnedItems = sortedItems.filter(item => pinnedItems.includes(item.id));
    const unpinnedItems = sortedItems.filter(item => !pinnedItems.includes(item.id));

    setDisplayDebateItems([...sortedPinnedItems, ...unpinnedItems]);
  }, [pinnedItems, selectedDebateItems, sortOption, sortOrder]);

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

  // displayDebateItemsが変更されたときにrefの配列を更新
  useEffect(() => {
    macroStructureRefs.current = displayDebateItems.map((_, i) =>
      macroStructureRefs.current[i] || createRef()
    );
  }, [displayDebateItems]);

  // ドロップダウンの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
              <TabsList className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 h-9">
                {tabValues.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="px-3 py-1 text-sm">
                    {t(tab.labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-4">
            {/* ピン留め情報を表示 */}
            {pinnedItems.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 shadow-sm">
                <div className="p-1 bg-amber-100 dark:bg-amber-800 rounded-lg">
                  <Pin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {t('explore.pinned', { count: pinnedItems.length })}
                </span>
              </div>
            )}

            {/* ソート選択ドロップダウン */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-700 shadow-sm h-9">
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex items-center justify-center p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                title={sortOrder === 'desc' ? t('explore.sort.largestFirst') : t('explore.sort.smallestFirst')}
              >
                {sortOrder === 'desc' ? (
                  <ArrowDownWideNarrow className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                ) : (
                  <ArrowUpNarrowWide className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                )}
              </button>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

              {/* カスタムドロップダウン */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md px-2 py-1 transition-colors min-w-[100px]"
                >
                  <span className="font-normal">{t(sortOptions.find(opt => opt.value === sortOption)?.labelKey || '')}</span>
                  <ChevronDown className={`w-3 h-3 text-gray-500 dark:text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortOption(option.value);
                          setIsDropdownOpen(false);
                          logOperation('SortChanged', {
                            sort_option: option.value,
                          });
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${sortOption === option.value ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400' : ''
                          }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100 mb-0.5 text-sm">{t(option.labelKey)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t(option.descriptionKey)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                    <div key={index} className="flex flex-col border-4 border-white dark:border-gray-900 animate-pulse">
                      <div className="mb-1 flex gap-4 bg-white dark:bg-gray-900">
                        <div className="aspect-square relative bg-gray-300 dark:bg-gray-700 ml-1 mt-1 rounded-md" style={{ width: '8vh', height: '8vh' }}></div>
                        <div className="flex flex-col flex-grow">
                          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-1"></div>
                          <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                      </div>
                      <div className="aspect-[16/9] relative bg-gray-300 dark:bg-gray-700 rounded-md" style={{ height: '35vh' }}></div>
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
                      className={`flex flex-col border-4 cursor-pointer ${pinnedItems.includes(item.id) ? 'border-yellow-500' : 'border-white dark:border-gray-900'}`}
                      onClick={() => {
                        // Navigate to Record page visualization tab with round name and try count
                        const roundName = item.title; // Assuming title is the round name
                        router.push(`/record?tab=visualization&roundName=${encodeURIComponent(roundName)}&tryCount=${item.tryCount}`);
                      }}
                      onDoubleClick={onMovieItemClicked(item.id)}
                    >
                      <div className="mb-1 flex gap-4 bg-white dark:bg-gray-900">
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
                          <h3 className="font-medium text-base mb-1 line-clamp-1 dark:text-gray-100"> {item.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-3">{item.motion}</p>
                          <p className="text-sm text-muted-foreground">{new Date(item.publishedAt).toISOString().split('T')[0]}</p>
                          {/* Features表示 */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {t(sortOptions.find(opt => opt.value === sortOption)?.labelKey || '')}: {
                                sortOption === 'Date'
                                  ? new Date(item.publishedAt).toISOString().split('T')[0]
                                  : item.features[sortOption.toLowerCase() as keyof MacroStructuralFeatures]?.toFixed(3)
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="aspect-[16/9] relative bg-white dark:bg-gray-900"
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