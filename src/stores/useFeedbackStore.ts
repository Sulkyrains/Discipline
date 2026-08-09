import { create } from 'zustand'

interface FeedbackNotifyState {
  pendingCount: number
  userNewReplyCount: number
  setPendingCount: (n: number) => void
  setUserNewReplyCount: (n: number) => void
}

export const useFeedbackStore = create<FeedbackNotifyState>((set) => ({
  pendingCount: 0,
  userNewReplyCount: 0,
  setPendingCount: (n) => set({ pendingCount: n }),
  setUserNewReplyCount: (n) => set({ userNewReplyCount: n })
}))
