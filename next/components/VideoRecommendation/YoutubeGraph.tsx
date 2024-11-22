'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import 'reactflow/dist/style.css'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../ui/tabs'
interface DebateItem {
  videoId: string
  title: string
  channel: string
  views: string
  publishedAt: string
  graphUrl: string
}
interface VideoInfo {
  title: string
  channel: string
  views: string
  publishedAt: string
}
export default function YoutubeGraph() {
  const [scrollPosition, setScrollPosition] = useState(0);
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  const videoInfo = async (videoId: string) => {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet%2Cstatistics&id=${videoId}&key=${YOUTUBE_API_KEY}`)
    const data = await response.json()
    return data
  }

  useEffect(() => {
    const fetchVideoInfo = async () => {
      const data = await videoInfo('LGTZGNpZ7X8')
      console.log(data)
    }
    fetchVideoInfo()
  }, [])

  const debateItems: DebateItem[] = [
    { videoId: 'LGTZGNpZ7X8', title: '[spno]構造員を理解sakdfjkjksejj', channel: 'Debate Channel 1', views: '10K views', publishedAt: '1 week ago', graphUrl: '/placeholder.svg?height=200&width=300' },
  ]
  const scrollNext = () => {
    setScrollPosition(prev => Math.min(prev + 1, debateItems.length - 1))
  }
  const scrollPrevious = () => {
    setScrollPosition(prev => Math.max(prev - 1, 0))
  }
  return (
    <div className="flex flex-col w-full mx-auto p-4 gap-6">
      <header className="flex items-center justify-start">
        <h2 className="text-2xl font-bold mr-20">Debate Structure Visualizer</h2>
        <Tabs defaultValue="all" className="w-auto justify-start">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="criminal">Criminal Justice</TabsTrigger>
            <TabsTrigger value="feminism">Feminism</TabsTrigger>
            <TabsTrigger value="economy">Economy</TabsTrigger>
            <TabsTrigger value="politics">Politics</TabsTrigger>
            <TabsTrigger value="environment">Environment</TabsTrigger>
            <TabsTrigger value="others">Others</TabsTrigger>
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
                <div className="flex gap-4">
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
                    <h3 className="font-medium text-base mb-1 line-clamp-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mb-1">{item.channel}</p>
                    <p className="text-sm text-muted-foreground">{item.views} • {item.publishedAt}</p>
                  </div>
                </div>
                <div className="aspect-[16/9] relative bg-blue-100 rounded-lg overflow-hidden" style={{ height: window.innerHeight - 210 }}>
                  {/* <Image
                    src={item.graphUrl}
                    alt="Debate Graph"
                    layout="fill"
                    className="object-cover"
                  /> */}
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
          className="fixed left-10 bottom-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90"
          onClick={scrollPrevious}
        >
          <ChevronLeft className="h-8 w-8" />
          <span className="sr-only">Previous</span>
        </Button>
      )}
      {scrollPosition < debateItems.length - 3 && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed right-10 bottom-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90"
          onClick={scrollNext}
        >
          <ChevronRight className="h-8 w-8" />
          <span className="sr-only">Next</span>
        </Button>
      )}
    </div>
  )
}