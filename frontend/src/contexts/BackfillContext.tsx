import { createContext, useContext, useState, ReactNode } from 'react'

interface BackfillContextType {
  activeBackfillId: string | null
  setActiveBackfillId: (id: string | null) => void
}

const BackfillContext = createContext<BackfillContextType | undefined>(undefined)

export function BackfillProvider({ children }: { children: ReactNode }) {
  const [activeBackfillId, setActiveBackfillId] = useState<string | null>(null)

  return (
    <BackfillContext.Provider value={{ activeBackfillId, setActiveBackfillId }}>
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
