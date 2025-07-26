'use client'

import { FeedbackFish } from '@feedback-fish/react'
import { MessageCircle } from 'lucide-react'
import { Button } from './ui/button'

interface FeedbackButtonProps {
  userId?: string
  userEmail?: string
}

export function FeedbackButton({ userId, userEmail }: FeedbackButtonProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 group">
      <FeedbackFish 
        projectId="56fa1909a90c87"
        userId={userId || userEmail}
      >
        <Button
          size="lg"
          className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </FeedbackFish>
      
      {/* Tooltip */}
      <div className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        Send Feedback
      </div>
    </div>
  )
} 