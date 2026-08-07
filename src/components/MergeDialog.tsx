import { t } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import ConfirmDialog from './ConfirmDialog'

export default function MergeDialog() {
  const pendingMerge = useAuthStore((s) => s.pendingMerge)
  const mergeWithCloud = useAuthStore((s) => s.mergeWithCloud)
  const setPendingMerge = useAuthStore((s) => s.setPendingMerge)
  const lang = useAppStore((s) => s.settings.language)
  const count = useAppStore((s) => s.countLocalRecords())

  if (!pendingMerge) return null
  return (
    <ConfirmDialog
      open
      title={t(lang, 'mergeTitle')}
      body={t(lang, 'mergeBody', { n: count })}
      confirmText={t(lang, 'mergeAction')}
      cancelText={t(lang, 'mergeLater')}
      onConfirm={() => void mergeWithCloud()}
      onCancel={() => setPendingMerge(false)}
    />
  )
}
