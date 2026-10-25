 <div align="center">
  <img src="logo/logo.png" alt="Xeno.JS Logo" width="140" />

  <h1>Xeno.JS Fastify</h1>
  <p><strong>A Typescript application framework architecture for Node.js, designed for lower technical debt, and faster infrastructure migrations.</strong></p>
  <p>Build long-lived applications with explicit dependency injection, DDD, CQRS, and transport-independent business logic.</p>

  <p>
    <a href="https://www.npmjs.com/package/@xeno-js/fastify"><img src="https://img.shields.io/npm/v/@xeno-js/fastify?style=flat-square" alt="NPM Version" /></a>
    <a href="https://github.com/xeno-js/fastify"><img src="https://img.shields.io/badge/Powered%20by-Xeno-blueviolet?style=flat-square" alt="Powered by Xeno" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License: MIT" /></a>
    <a href="https://buymeacoffee.com/xenojs">
      <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
    </a>
  </p>
</div>

---

`@xeno-js/fastify` integrates [Fastify](https://www.fastify.io/) as the
transport layer for the Xeno.JS ecosystem. It translates native Fastify requests
and replies into Xeno's domain-agnostic request structures, delegating execution
through core dispatchers.

## Install

```bash
npm install @xeno-js/fastify fastify

```

Requires `@xeno-js/core` and an active Fastify peer dependency.

---

## 1. HTTP Server Plugin Integration

**Problem.** Transport frameworks like Fastify manage their own network
listeners and lifecycle loops, requiring an explicit mechanism to bridge
incoming HTTP traffic into the application's core architecture without leaking
transport specifics into use cases.

**Principle:** Keep transport concerns at the edge. The server adapter must
translate transport inputs into uniform application requests and route them
through core dispatchers.

**Mechanism:** The `withFastify` plugin registers an `HttpServerModule` and
binds `FastifyHttpServer` to the container under `TOKENS.HTTP_SERVER`. It
configures a universal wildcard route (`/*`) that intercepts incoming traffic,
matches routes via `ROUTE_MATCHER`, and executes requests using
`HTTP_DISPATCHER`.

**Implementation:**

```ts
// src/routes.ts
import {
  NativeRouteDefinition,
  RouteHandlerContext,
  HttpRouteParamHelper,
  withCors,
} from '@xeno-js/core'
import { MyRegistry } from './registry'

export const routes: NativeRouteDefinition<MyRegistry>[] = [
  withCors<MyRegistry>(
    {
      path: '/api/v1/products',
      method: 'GET',
      handler: async (ctx: RouteHandlerContext<MyRegistry>) => {
        const input = await HttpRouteParamHelper.extractInput<{
          page?: number
          pageSize?: number
        }>(ctx.req, '/api/v1/products')
        return ctx.handle('GET_PRODUCTS_CONTROLLER', input)
      },
    },
    ['*'],
    false,
  ),
  withCors<MyRegistry>(
    {
      path: '/api/v1/products/:id',
      method: 'GET',
      handler: async (ctx: RouteHandlerContext<MyRegistry>) => {
        const input = await HttpRouteParamHelper.extractInput<{ id: string }>(
          ctx.req,
          '/api/v1/products/:id',
        )
        return ctx.handle('GET_PRODUCT_BY_ID_CONTROLLER', input)
      },
    },
    ['*'],
    false,
  ),
]

// src/bootstrap.ts
import { XenoAppBuilder } from '@xeno-js/core'
import { withFastify } from '@xeno-js/fastify'
import { routes } from './routes'

const app = await new XenoAppBuilder()
  .addHttpServer(
    withFastify((options, config) => {
      options.logger = true
      options.trustProxy = true
    }),
  )
  .addRoutes(routes)
  .build()

await app.listen({ port: 3000, host: '0.0.0.0' })
```

**Behavior:** When `.listen()` is invoked, `FastifyHttpServer` initializes the
underlying Fastify instance configured with the specified options and opens the
network port. Incoming HTTP requests are intercepted by the universal route
handler, mapped via `FastifyRequestMapper`, dispatched through the container's
routing layer, and serialized back to the client.

**Boundary:** This package handles Fastify lifecycle management, header
normalization, and status code mapping. It does not contain application business
logic or direct database access; all requests are delegated to core domain
handlers.

---

## 2. Request Mapping and Lifecycle Management

**Problem.** Framework-specific request and response objects (such as Fastify's
`FastifyRequest` and `FastifyReply`) cannot be passed directly into domain
handlers or core dispatchers.

**Principle:** Decouple transport types from domain execution contracts by
enforcing strict normalization layers at the boundary.

**Mechanism:** `FastifyRequestMapper` extracts raw headers, normalizes query
strings and paths, establishes an `AbortController` linked to client
disconnection events (`req.raw.on('aborted')`), and wraps them into a
`XenoIncomingRequest`. Responses are mapped back by assigning status codes,
cleaning restricted headers (e.g., `content-length`), and safely serializing
payloads.

**Implementation:**

The mapping runs automatically inside the Fastify wildcard route handler defined
by `FastifyHttpFactory`:

```ts
// Internal mapping flow within FastifyHttpFactory route handler
const incomingRequest = FastifyRequestMapper.mapRequest(req)
const extendedRequest = this._adapter.adapt(incomingRequest)
const routeResult = await matchedRoute.handler({
  req: extendedRequest,
  handle: (token, input) =>
    this._dispatcher.handle(extendedRequest, token, input),
})

FastifyHttpServer.mapResponse(
  reply,
  routeResult.status,
  routeResult.data,
  routeResult.headers,
)
```

**Behavior:** If a route is not matched, it automatically yields a standardized
`404 Not Found` response. Unhandled runtime errors caught during dispatch are
safely formatted and returned as `500 Internal Server Error` payloads without
crashing the Fastify process.

**Boundary:** `FastifyRequestMapper` relies strictly on Fastify's request and
reply interfaces. It does not mutate global state or handle session persistence.

---

## License

Released under the [MIT License](LICENSE).
