'use client'

import { TamaguiProvider } from 'tamagui'
import config from '../tamagui.config'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      {children}
    </TamaguiProvider>
  )
}

