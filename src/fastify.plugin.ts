import type {
  HttpServerPlugin,
  IAppBuilder,
  IConfigurationService,
  IXenoApplication,
  SetupAction,
  XenoRegistry,
} from '@xeno-js/core'
import { definePlugin, Guards, HttpServerModule, TOKENS } from '@xeno-js/core'
import type { FastifyServerOptions } from 'fastify'

import { FastifyHttpFactory } from './infrastructure/factories/fastify.factory'
import { FastifyHttpServer } from './infrastructure/server/fastify.server'

/**
 * @description Plugin to configure and use Fastify as the HTTP server.
 */
export const withFastify = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup?: SetupAction<FastifyServerOptions, IConfigurationService>,
): HttpServerPlugin<TRegistry> => {
  return definePlugin(
    'http-server',
    (
      builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
    ) => {
      builder.addModule(
        'HttpServerModule',
        async () => new HttpServerModule<TRegistry>(),
        undefined,
        9,
      )
      const fastifyOptions: FastifyServerOptions = {
        logger: false,
        trustProxy: true,
      }

      if (Guards.isDefined(setup)) setup(fastifyOptions, config)

      builder.addServices((container) => {
        container.addSingleton(TOKENS.HTTP_SERVER, (c) => {
          const routeMatcher = c.resolve(TOKENS.ROUTE_MATCHER)
          const dispatcher = c.resolve(TOKENS.HTTP_DISPATCHER)
          const adapter = c.resolve(TOKENS.HTTP_ADAPTER)

          const factory = new FastifyHttpFactory(routeMatcher, dispatcher, adapter)
          return new FastifyHttpServer(factory, fastifyOptions)
        })
      }, 10)
    },
  )
}
