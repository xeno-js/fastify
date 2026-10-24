import type { Dictionary, XenoIncomingRequest } from '@xeno-js/core'
import { Guards, HttpHelper } from '@xeno-js/core'
import type { FastifyReply, FastifyRequest } from 'fastify'

export class FastifyRequestMapper {
  /**
   * @description Maps a FastifyRequest to a XenoIncomingRequest.
   * @param req - The FastifyRequest to map.
   * @returns The mapped XenoIncomingRequest.
   * @throws {Error} If the request is not a Fastify
   */
  public static mapRequest(req: FastifyRequest): XenoIncomingRequest {
    const normalizedHeaders = HttpHelper.normalizeHeaders(req.headers)
    const path = (req.url ?? '/').split('?')[0]
    const abortController = new AbortController()

    ;(req.raw as { on: (event: 'aborted', listener: () => void) => void }).on('aborted', () => {
      abortController.abort()
    })

    return {
      url: req.url,
      path,
      method: req.method ?? 'GET',
      headers: new Headers(normalizedHeaders as HeadersInit),
      body: req.body,
      query: req.query as Dictionary<string>,
      signal: abortController.signal,
      socket: {
        remoteAddress: (req.socket as { remoteAddress?: string })?.remoteAddress,
        remotePort: (req.socket as { remotePort?: number })?.remotePort,
      },
    }
  }

  /**
   * @description Applys the response to the FastifyReply.
   * @param reply - The FastifyReply to apply the response to.
   * @param status - The status code of the response.
   * @param body - The body of the response.
   * @param headers - The headers of the response.
   */
  public static mapResponse(
    reply: FastifyReply,
    status: number,
    body: unknown,
    headers?: Record<string, string | string[] | undefined>,
  ): void {
    reply.status(status)
    if (Guards.isDefined(headers)) {
      const cleanHeaders = { ...headers }
      delete cleanHeaders['content-length']
      reply.headers(cleanHeaders)
    }

    const payload = !Guards.isDefined(body) ? { success: status >= 200 && status < 300 } : body
    reply.send(payload)
  }
}
