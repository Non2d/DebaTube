'use client'
import * as React from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import 'reactflow/dist/style.css'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../ui/tabs'
interface DebateItem {
  id: string
  videoId: string
  title: string
  channel: string
  views: string
  publishedAt: string
  thumbnailUrl: string
  graphUrl: string
}
export default function YoutubeGraph() {
  const [scrollPosition, setScrollPosition] = React.useState(0)
  const debateItems: DebateItem[] = [
    { id: '1', videoId: 'video1', title: '[spno]構造員を理解...', channel: 'Debate Channel 1', views: '10K views', publishedAt: '1 week ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '2', videoId: 'video2', title: 'The Kansai 2019 RT', channel: 'Debate Channel 2', views: '5K views', publishedAt: '2 weeks ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '3', videoId: 'video3', title: 'WSDC 2024 R2 Ja', channel: 'Debate Channel 3', views: '15K views', publishedAt: '3 days ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '4', videoId: 'video4', title: '[spno]構造員を理解...', channel: 'Debate Channel 4', views: '20K views', publishedAt: '1 month ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=3000' },
    { id: '5', videoId: 'video5', title: 'The Kansai 2019 RT', channel: 'Debate Channel 5', views: '7K views', publishedAt: '2 months ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '6', videoId: 'video6', title: 'WSDC 2024 R2 Ja', channel: 'Debate Channel 6', views: '25K views', publishedAt: '3 months ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '7', videoId: 'video7', title: '[spno]構造員を理解...', channel: 'Debate Channel 7', views: '30K views', publishedAt: '1 year ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '8', videoId: 'video8', title: 'The Kansai 2019 RT', channel: 'Debate Channel 8', views: '35K views', publishedAt: '2 years ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
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
              key={item.id}
              className="flex-none w-1/4"
            >
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="w-[180px] flex-none">
                    <div className="aspect-video relative bg-muted rounded-lg overflow-hidden">
                      <Image
                        src={item.thumbnailUrl}
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