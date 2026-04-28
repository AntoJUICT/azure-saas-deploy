import { auth, signIn, signOut } from '@/lib/auth'

export default async function Home() {
  const session = await auth()

  return (
    <main>
      <h1>Starter App</h1>
      {session ? (
        <>
          <p>Ingelogd als {session.user?.name}</p>
          <form
            action={async () => {
              'use server'
              await signOut()
            }}
          >
            <button type="submit">Uitloggen</button>
          </form>
        </>
      ) : (
        <form
          action={async () => {
            'use server'
            await signIn('microsoft-entra-id')
          }}
        >
          <button type="submit">Inloggen met Microsoft</button>
        </form>
      )}
    </main>
  )
}
