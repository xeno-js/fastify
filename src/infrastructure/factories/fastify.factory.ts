import type {
  IFactory,
  IHttpAdapter,
  IHttpDispatcher,
  IRouteMatcher,
  Optional,
  XenoRegistry,
} from '@xeno-js/core'
import { Guards, STATUS_CODES } from '@xeno-js/core'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'

import { FastifyRequestMapper } from '../mappers/fastify.mapper'

/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface IHttpFastifyFactory extends IFactory<
  Optional<FastifyServerOptions>,
  FastifyInstance
> {}

export class FastifyHttpFactory<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IHttpFastifyFactory {
  constructor(
    private readonly _routeMatcher: IRouteMatcher,
    private readonly _dispatcher: IHttpDispatcher<TRegistry>,
    private readonly _adapter: IHttpAdapter,
  ) {}

  create(opts?: FastifyServerOptions): FastifyInstance {
    const fastify = Fastify(opts)

    fastify.route({
      method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      url: '/*',
      handler: async (req, reply) => {
        try {
          const matchedRoute = this._routeMatcher.match(req.url ?? '/', req.method ?? 'GET')

          if (!Guards.isDefined(matchedRoute)) {
            return FastifyRequestMapper.mapResponse(reply, STATUS_CODES.NOT_FOUND, {
              error: `Route ${req.method} ${req.url} not found`,
            })
          }

          const incomingRequest = FastifyRequestMapper.mapRequest(req)
          const extendedRequest = this._adapter.adapt(incomingRequest)

          const routeResult = await matchedRoute.handler({
            req: extendedRequest,
            handle: (token, input) => this._dispatcher.handle(extendedRequest, token, input),
          })

          if (Guards.isDefined(routeResult)) {
            FastifyRequestMapper.mapResponse(
              reply,
              routeResult.status,
              routeResult.data,
              routeResult.headers,
            )
          }
        } catch (error: unknown) {
          FastifyRequestMapper.mapResponse(reply, STATUS_CODES.INTERNAL_SERVER_ERROR, {
            error: (error as Error).message,
          })
        }
      },
    })

    return fastify
  }
}
