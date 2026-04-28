import type { NextConfig } from 'next'
import fs from 'fs'
import path from 'path'
import os from 'os'

if (process.env.NODE_ENV !== 'production') {
  const sharedEnvPath = path.join(os.homedir(), '.azure-saas-deploy', 'shared.env')
  if (fs.existsSync(sharedEnvPath)) {
    const lines = fs.readFileSync(sharedEnvPath, 'utf-8').split('\n')
    for (const line of lines) {
      const [key, ...rest] = line.split('=')
      if (key && !key.startsWith('#') && !(key in process.env)) {
        process.env[key.trim()] = rest.join('=').trim()
      }
    }
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
