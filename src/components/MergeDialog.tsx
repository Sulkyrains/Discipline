import { useState } from 'react'
import { t } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import ConfirmDialog from './ConfirmDialog'

export default function MergeDialog() {
  const pendingMerge = useAuthStore((s) => s.pendingMerge)
  const mergeWithCloud = useAuthStore((s) => s.mergeWithCloud)
  const setPendingMerge = useAuthStore((s) => s.setPendingMerge)
  const mergeError = useAuthStore((s) => s.mergeError)
  const lang = useAppStore((s) => s.settings.language)
  const count = useAppStore((s) => s.countLocalRecords())
  const [merging, setMerging] = useState(false)

  if (!pendingMerge) return null

  const confirm = async () => {
    if (merging) return
    setMerging(true)
    await mergeWithCloud()
    setMerging(false)
  }

  return (
    <ConfirmDialog
      open
      title={t(lang, 'mergeTitle')}
      body={
        mergeError
          ? `${t(lang, 'mergeBody', { n: count })}\n\n⚠️ ${mergeError}`
          : t(lang, 'mergeBody', { n: count })
      }
      confirmText={merging ? t(lang, 'merging') : t(lang, 'mergeAction')}
      cancelText={t(lang, 'mergeLater')}
      disabled={merging}
      onConfirm={() => void confirm()}
      onCancel={() => {
        useAuthStore.setState({ mergeError: null })
        setPendingMerge(false)
      }}
    />
  )
}
