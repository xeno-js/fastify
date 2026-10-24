import type { IHttpServer, NativeListenOptions, Optional } from '@xeno-js/core'
import { Guards } from '@xeno-js/core'
import type { FastifyInstance, FastifyServerOptions } from 'fastify'

import type { IHttpFastifyFactory } from '../factories/fastify.factory'

export class FastifyHttpServer implements IHttpServer {
  private _serverInstance: Optional<FastifyInstance> = undefined

  constructor(
    private readonly _factoryServer: IHttpFastifyFactory,
    private readonly _options: FastifyServerOptions,
  ) {}

  public async listen<T = void>(options: NativeListenOptions): Promise<T> {
    this._serverInstance = this._factoryServer.create(this._options)

    await this._serverInstance.listen({
      port: options.port ?? 3000,
      host: options.host ?? 'localhost',
    })

    options.onListening?.({ port: options.port ?? 3000, host: options.host ?? 'localhost' })

    return this._serverInstance as unknown as T
  }

  public async dispose(): Promise<void> {
    if (Guards.isDefined(this._serverInstance)) {
      await this._serverInstance.close()
      this._serverInstance = undefined
    }
  }
}
