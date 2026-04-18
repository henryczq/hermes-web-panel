import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ProfileState {
  selectedProfile: string | null
  setSelectedProfile: (name: string) => void
}

const ProfileContext = createContext<ProfileState>({
  selectedProfile: null,
  setSelectedProfile: () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)

  const handleSelect = useCallback((name: string) => {
    setSelectedProfile(name)
  }, [])

  return (
    <ProfileContext.Provider value={{ selectedProfile, setSelectedProfile: handleSelect }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileState {
  return useContext(ProfileContext)
}
