/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, ReactNode } from 'react'

interface BackfillInfo {
  backfillId: string
  type: 'global' | 'district'
  districtId?: string
}

interface BackfillContextType {
  activeBackfillId: string | null
  activeBackfillInfo: BackfillInfo | null
  setActiveBackfillId: (id: string | null) => void
  setActiveBackfillInfo: (info: BackfillInfo | null) => void
  activeBackfills: BackfillInfo[]
  addBackfill: (info: BackfillInfo) => void
  removeBackfill: (backfillId: string) => void
}

const BackfillContext = createContext<BackfillContextType | undefined>(
  undefined
)

export function BackfillProvider({ children }: { children: ReactNode }) {
  const [activeBackfillId, setActiveBackfillId] = useState<string | null>(null)
  const [activeBackfillInfo, setActiveBackfillInfo] =
    useState<BackfillInfo | null>(null)
  const [activeBackfills, setActiveBackfills] = useState<BackfillInfo[]>([])

  const addBackfill = (info: BackfillInfo) => {
    setActiveBackfills(prev => {
      // Remove any existing backfill with the same ID
      const filtered = prev.filter(b => b.backfillId !== info.backfillId)
      return [...filtered, info]
    })
  }

  const removeBackfill = (backfillId: string) => {
    setActiveBackfills(prev => prev.filter(b => b.backfillId !== backfillId))
  }

  return (
    <BackfillContext.Provider
      value={{
        activeBackfillId,
        setActiveBackfillId,
        activeBackfillInfo,
        setActiveBackfillInfo,
        activeBackfills,
        addBackfill,
        removeBackfill,
      }}
    >
      {children}
    </BackfillContext.Provider>
  )
}

export function useBackfillContext() {
  const context = useContext(BackfillContext)
  if (context === undefined) {
    throw new Error('useBackfillContext must be used within a BackfillProvider')
  }
  return context
}
