import { create } from 'zustand'

interface FeedbackNotifyState {
  pendingCount: number
  userHasNewReply: boolean
  setPendingCount: (n: number) => void
  setUserHasNewReply: (v: boolean) => void
}

export const useFeedbackStore = create<FeedbackNotifyState>((set) => ({
  pendingCount: 0,
  userHasNewReply: false,
  setPendingCount: (n) => set({ pendingCount: n }),
  setUserHasNewReply: (v) => set({ userHasNewReply: v })
}))
