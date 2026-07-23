interface AppConfig {
  appName: string
  appDescription: string
  developer: string
  links: {
    twitter: string
    github: string
    telegram: string
    discord: string
    docs: string
    buy: string
  }
  contracts: {
    main: string
    token: string
  }
  features: {
    darkMode: boolean
    smoothScroll: boolean
  }
}

export const config: AppConfig = {
  appName: 'RYKA CORE',
  appDescription: 'Real-time hand tracking and gesture recognition powered by Google MediaPipe.',
  developer: 'Muhammad Rafi Priyo',

  links: {
    twitter: '',
    github: '',
    telegram: '',
    discord: '',
    docs: '',
    buy: '',
  },

  contracts: {
    main: '',
    token: '',
  },

  features: {
    darkMode: true,
    smoothScroll: true,
  },
}

export type Config = AppConfig
