import { config as configBase } from '@tamagui/config/v3'
import { createTamagui } from 'tamagui'

const config = {
  ...configBase,
  // Web-only optimizations
  shouldAddPrefersColorThemes: false,
  // Disable React Native specific features
}

const appConfig = createTamagui(config)

export default appConfig

export type Conf = typeof appConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

