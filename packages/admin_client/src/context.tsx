import { createContext, useContext, type ReactNode } from 'react'
import { HermesAdminClient } from './index.js'

const client = new HermesAdminClient()

const HermesAdminClientContext = createContext<HermesAdminClient>(client)

export function HermesAdminClientProvider({ children }: { children: ReactNode }) {
  return (
    <HermesAdminClientContext.Provider value={client}>
      {children}
    </HermesAdminClientContext.Provider>
  )
}

export function useHermesClient(): HermesAdminClient {
  return useContext(HermesAdminClientContext)
}
