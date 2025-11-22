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
}

const BackfillContext = createContext<BackfillContextType | undefined>(undefined)

export function BackfillProvider({ children }: { children: ReactNode }) {
  const [activeBackfillId, setActiveBackfillId] = useState<string | null>(null)
  const [activeBackfillInfo, setActiveBackfillInfo] = useState<BackfillInfo | null>(null)

  return (
    <BackfillContext.Provider value={{ 
      activeBackfillId, 
      setActiveBackfillId,
      activeBackfillInfo,
      setActiveBackfillInfo
    }}>
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
