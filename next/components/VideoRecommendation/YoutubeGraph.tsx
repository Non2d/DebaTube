'use client'
import MacroStructure from '../../components/MacroStructure/MacroStructure';
import Youtube from 'react-youtube';
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { apiRoot } from '../../components/utils/foundation';
import 'reactflow/dist/style.css'
import { Button } from '../ui/button'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../ui/tabs'
interface DebateItem { //UI表示用にデータ生成する際のバリデーション
  id: number
  videoId: string
  title: string
  motion: string
  publishedAt: string

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

  pois: any;
  speeches: any;
  rebuttals: any;
}
export default function YoutubeGraph() {
  const ytProps = {
    height: (400 * 9) / 16,
    width: 400,
    playerVars: {
      autoplay: 1, // 自動再生を無効
    },
  };
  const [ytPlayer, setYtPlayer] = useState<YT.Player>();
  const [ytId, setYtId] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytIsRight, setYtIsRight] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all')
  const tabValues = [
    { value: "all", label: "All" },
    { value: "criminal", label: "Criminal Justice" },
    { value: "feminism", label: "Feminism" },
    { value: "economy", label: "Economy" },
    { value: "politics", label: "Politics" },
    { value: "environment", label: "Environment" },
    { value: "others", label: "Others" },
  ];

  const [scrollPosition, setScrollPosition] = useState(0);

  const [debateItems, setDebateItems] = useState<DebateItem[]>([]);

  useEffect(() => {
    console.log("selected tab: ", selectedTab);
    fetch(apiRoot + '/rounds', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then((data: Round[]) => {
        const filteredRounds = selectedTab === 'all'
          ? data
          : data.filter(round => selectedTab.includes(round.tag));
        const debateItems = filteredRounds.map(round => {
          return {
            id: round.id,
            videoId: round.video_id,
            title: round.title,
            motion: round.motion,
            publishedAt: round.date_uploaded,
            graphItems: {
              roundId: round.id,
              pois: round.pois,
              speeches: round.speeches,
              rebuttals: round.rebuttals,
            }
          }
        })
        setDebateItems(debateItems);
      })
      .catch(error => console.error('Error fetching data:', error));
  }, [selectedTab])

  const scrollNext = () => {
    setScrollPosition(prev => Math.min(prev + 1, debateItems.length - 1))
  }
  const scrollPrevious = () => {
    setScrollPosition(prev => Math.max(prev - 1, 0))
  }
  const onMovieItemClicked = (videoId: string, videoTitle: string) => () => {
    setYtId(videoId);
    setYtTitle(videoTitle);
    setIsVisible(true);
  }

  const onGraphNodeClicked = (roundId:number, start:number) => {
    const nodeOwnerRound = debateItems.find(item => item.id === roundId);
    setYtId(nodeOwnerRound?.videoId);
    setYtTitle(nodeOwnerRound?.title);
    setIsVisible(true);
    ytPlayer.seekTo(start, true);
  }

  return (
    <div className="flex flex-col w-full mx-auto p-4 gap-6">
      <header className="flex items-center justify-start">
        <h2 className="text-2xl font-bold mr-20">Debate Structure Visualizer</h2>
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-auto justify-start">
          <TabsList>
            {tabValues.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>
      <div className="relative">
        <div
          className="flex gap-6 transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${scrollPosition * 100 / 4}%)`, marginLeft: '15%' }}
        >
          {debateItems.map((item) => (
            <div
              key={item.videoId}
              className="flex-none w-1/4"
            >
              <div className="flex flex-col gap-4">
                <div
                  className="flex gap-4 bg-white hover:bg-gray-300 cursor-pointer transition-all duration-300 ease-in-out"
                  onClick={onMovieItemClicked(item.videoId, item.title)}
                >
                  <div className="w-[180px] flex-none">
                    <div className="aspect-video relative bg-muted rounded-lg overflow-hidden">
                      <Image
                        src={`https://img.youtube.com/vi/${item.videoId}/maxresdefault.jpg`}
                        alt={item.title}
                        layout="fill"
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col flex-grow">
                    <h3 className="font-medium text-base mb-1 line-clamp-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">{item.motion}</p>
                    <p className="text-sm text-muted-foreground">{new Date(item.publishedAt).toISOString().split('T')[0]}</p>
                  </div>
                </div>
                <div className="aspect-[16/9] relative bg-white rounded-lg overflow-hidden" style={{ height: '70vh' }}>
                  <MacroStructure data={item.graphItems} onGraphNodeClicked={onGraphNodeClicked} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {scrollPosition > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-10 top-24 h-12 w-12 rounded-full bg-background/60 backdrop-blur-sm hover:bg-background/70"
          onClick={scrollPrevious}
        >
          <ChevronLeft className="h-32 w-32" />
          <span className="sr-only">Previous</span>
        </Button>
      )}
      {scrollPosition < debateItems.length - 3 && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed right-10 top-24 h-12 w-12 rounded-full bg-background/60 backdrop-blur-sm hover:bg-background/70"
          onClick={scrollNext}
        >
          <ChevronRight className="h-32 w-32" />
          <span className="sr-only">Next</span>
        </Button>
      )}
      {
        isVisible && (
          <div
            className={`fixed bottom-4 ${ytIsRight ? 'right-4' : 'left-4'
              } w-128 h-68 rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden bg-black`}
          >
            <div className="flex items-center justify-start bg-gray-800 text-white px-3 py-2">
              <h4 className="text-sm font-semibold">{ytTitle}</h4>
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
            <div className="w-full h-full">
              <Youtube
                videoId={ytId}
                opts={ytProps}
                onReady={(e) => setYtPlayer(e.target)}
                className="w-full h-full"
              />
            </div>
          </div>
        )
      }
    </div>
  )
}