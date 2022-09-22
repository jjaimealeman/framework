import { execa } from 'execa'
import { getRandomPort, waitForPort } from 'get-port-please'
import { fetch as _fetch, $fetch as _$fetch, FetchOptions } from 'ohmyfetch'
import * as _kit from '@nuxt/kit'
import { resolve } from 'pathe'
import { stringifyQuery } from 'ufo'
import { useTestContext } from './context'

// @ts-ignore type cast
const kit: typeof _kit = _kit.default || _kit

export async function startServer () {
  const ctx = useTestContext()
  await stopServer()
  const port = await getRandomPort()
  ctx.url = 'http://127.0.0.1:' + port
  if (ctx.options.dev) {
    const nuxiCLI = await kit.resolvePath('nuxi/cli')
    ctx.serverProcess = execa(nuxiCLI, ['dev'], {
      cwd: ctx.nuxt!.options.rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'development'
      }
    })
    await waitForPort(port, { retries: 32 })
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      try {
        const res = await $fetch('/')
        if (!res.includes('__NUXT_LOADING__')) {
          return
        }
      } catch {}
    }
    throw new Error('Timeout waiting for dev server!')
  } else {
    ctx.serverProcess = execa('node', [
      resolve(ctx.nuxt!.options.nitro.output!.dir!, 'server/index.mjs')
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test'
      }
    })
    await waitForPort(port, { retries: 8 })
  }
}

export async function stopServer () {
  const ctx = useTestContext()
  if (ctx.serverProcess) {
    await ctx.serverProcess.kill()
  }
}

export function fetch (path: string, options?: any) {
  return _fetch(url(path), options)
}

export function $fetch (path: string, options?: FetchOptions) {
  return _$fetch(url(path), options)
}

export function $fetchComponent (filepath: string, props?: Record<string, any>) {
  return $fetch(componentTestUrl(filepath, props))
}

export function componentTestUrl (filepath: string, props?: Record<string, any>) {
  const ctx = useTestContext()
  filepath = resolve(ctx.options.rootDir, filepath)
  const path = stringifyQuery({
    path: filepath,
    props: JSON.stringify(props)
  })
  return `/__nuxt_component_test__/?${path}`
}

export function url (path: string) {
  const ctx = useTestContext()
  if (!ctx.url) {
    throw new Error('url is not available (is server option enabled?)')
  }
  if (path.startsWith(ctx.url)) {
    return path
  }
  return ctx.url + path
}
