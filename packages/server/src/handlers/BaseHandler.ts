import EventEmitter from 'node:events'

import type {ServerOptions} from '../types'
import type {DataStore} from '../models'
import type http from 'node:http'

const reExtractFileID = /([^/]+)\/?$/
const reForwardedHost = /host="?([^";]+)/
const reForwardedProto = /proto=(https?)/

export class BaseHandler extends EventEmitter {
  options: ServerOptions
  store: DataStore

  constructor(store: DataStore, options: ServerOptions) {
    super()
    if (!store) {
      throw new Error('Store must be defined')
    }

    this.store = store
    this.options = options
  }

  write(res: http.ServerResponse, status: number, headers = {}, body = '') {
    headers = status === 204 ? headers : {...headers, 'Content-Length': body.length}
    res.writeHead(status, headers)
    res.write(body)
    return res.end()
  }

  generateUrl(req: http.IncomingMessage, id: string) {
    id = encodeURIComponent(id)

    const forwarded = req.headers.forwarded as string | undefined
    const path = this.options.path === '/' ? '' : this.options.path
    // @ts-expect-error baseUrl type doesn't exist?
    const baseUrl = req.baseUrl ?? ''
    let proto
    let host

    // console.log("full_header", req.headers) 
    // console.log("forwardedppp", forwarded) 
    // console.log("base_url_1", baseUrl)
    // console.log("relativeLocation", this.options.relativeLocation)
    if (this.options.relativeLocation) {
      return `${baseUrl}${path}/${id}`
    }

    // console.log("respectForwardedHeaders", this.options.respectForwardedHeaders)
    if (this.options.respectForwardedHeaders) {
      if (forwarded) {
        host ??= reForwardedHost.exec(forwarded)?.[1]
        proto ??= reForwardedProto.exec(forwarded)?.[1]
      }

      const forwardHost = req.headers['x-forwarded-host']
      const forwardProto = req.headers['x-forwarded-proto']

      // console.log("forwardHost", forwardHost)
      // console.log("forwardProto", forwardProto)

      // @ts-expect-error we can pass undefined
      if (['http', 'https'].includes(forwardProto)) {
        proto ??= forwardProto as string
      }
      // console.log("proto", proto)
      host ??= forwardHost
    }

    host ??= req.headers.host
    proto ??= 'http'
    // console.log("final_proto", proto)
    return `${proto}://${host}${baseUrl}${path}/${id}`
  }

  getFileIdFromRequest(req: http.IncomingMessage) {
    const match = reExtractFileID.exec(req.url as string)

    if (!match || this.options.path.includes(match[1])) {
      return false
    }

    return decodeURIComponent(match[1])
  }
}
