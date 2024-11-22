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
    { id: '4', videoId: 'video4', title: '[spno]構造員を理解...', channel: 'Debate Channel 4', views: '20K views', publishedAt: '1 month ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '5', videoId: 'video5', title: 'Debate Topic 5', channel: 'Debate Channel 5', views: '8K views', publishedAt: '2 days ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '6', videoId: 'video6', title: 'Debate Topic 6', channel: 'Debate Channel 6', views: '12K views', publishedAt: '1 week ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '7', videoId: 'video7', title: 'Debate Topic 7', channel: 'Debate Channel 7', views: '7K views', publishedAt: '3 weeks ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '8', videoId: 'video8', title: 'Debate Topic 8', channel: 'Debate Channel 8', views: '9K views', publishedAt: '1 day ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
    { id: '9', videoId: 'video9', title: 'Debate Topic 9', channel: 'Debate Channel 9', views: '11K views', publishedAt: '2 weeks ago', thumbnailUrl: '/placeholder.svg?height=180&width=320', graphUrl: '/placeholder.svg?height=200&width=300' },
  ]
  const scrollNext = () => {
    setScrollPosition(prev => Math.min(prev + 1, debateItems.length - 1))
  }
  const scrollPrevious = () => {
    setScrollPosition(prev => Math.max(prev - 1, 0))
  }
  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto p-4 gap-6">
      <header className="flex items-center justify-start">
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
          style={{ transform: `translateX(-${scrollPosition * 100}%)` }}
        >
          {debateItems.map((item) => (
            <div
              key={item.id}
              className="flex-none w-1/3"
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
                <div className="aspect-[16/9] relative bg-muted rounded-lg overflow-hidden">
                  <Image
                    src={item.graphUrl}
                    alt="Debate Graph"
                    layout="fill"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {scrollPosition > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90"
            onClick={scrollPrevious}
          >
            <ChevronLeft className="h-8 w-8" />
            <span className="sr-only">Previous</span>
          </Button>
        )}
        {scrollPosition < debateItems.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90"
            onClick={scrollNext}
          >
            <ChevronRight className="h-8 w-8" />
            <span className="sr-only">Next</span>
          </Button>
        )}
      </div>
    </div>
  )
}