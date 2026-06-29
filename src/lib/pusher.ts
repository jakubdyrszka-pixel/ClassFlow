import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID || 'fallback-id',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || 'fallback-key',
  secret: process.env.PUSHER_SECRET || 'fallback-secret',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu',
  useTLS: true,
})

// Używamy singletona, by w trybie dev HMR nie tworzył wielu instancji połączeń
declare global {
  var pusherClientInstance: PusherClient | undefined
}

export const pusherClient =
  globalThis.pusherClientInstance ||
  new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY || 'fallback-key', {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu',
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.pusherClientInstance = pusherClient
}

/**
 * Bezpieczny trigger - ignoruje błędy (np. brak kluczy), by nie wysadzić aplikacji lokalnie.
 */
export async function triggerPusherEvent(channel: string, event: string, data: any) {
  try {
    if (!process.env.PUSHER_APP_ID) {
      console.warn('Pusher nie jest skonfigurowany, pomijam powiadomienie:', event)
      return
    }
    await pusherServer.trigger(channel, event, data)
  } catch (err) {
    console.error('Błąd Pusher trigger:', err)
  }
}
