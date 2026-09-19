# API Docs (Swagger)

Every HTTP service serves interactive OpenAPI docs at `/api`. Kitchen and rider
are RabbitMQ consumers with no HTTP API, so they have none.

| Service | Docs | Endpoints |
|---------|------|-----------|
| auth-service | http://localhost:3000/api | register, login, verify |
| item-service | http://localhost:3001/api | categories, items |
| orders-service | http://localhost:3002/api | place, list, get, cancel |

## What you get

- Every endpoint with method, path, request body schema, and response codes
- Example values on DTO fields, taken from `@ApiProperty()` decorators
- A `Try it out` button that fires real requests from the browser
- Padlocks on guarded routes plus an `Authorize` button for JWT

## How it is built

Three moving pieces, all in the service:

1. `DocumentBuilder` in `main.ts` sets the title, version, and calls
   `addBearerAuth()` to declare the JWT security scheme.
2. `SwaggerModule.createDocument(app, config)` generates the OpenAPI JSON from
   the running app's metadata, then `setup('api', app, document)` serves the UI.
3. Decorators feed the schemas: `@ApiProperty()` on DTO fields,
   `@ApiOperation()` + `@ApiResponse()` on handlers, `@ApiBearerAuth()` on
   guarded controllers or routes. `@ApiExcludeController()` keeps health
   endpoints out of the docs, they are monitoring, not API.

The docs are generated, not hand-written, so they match the code as long as the
decorators stay current. Rule: any DTO or route change updates its decorators in
the same commit, same as tests.

## The Authorize flow (try it yourself)

1. Open auth docs at `http://localhost:3000/api`.
2. Run `POST /auth/login` with a seeded login:
   `customer@swiftbite.local` / `Customer123!`.
3. Copy the `token` from the response.
4. Click **Authorize**, paste `Bearer <token>`, close.
5. Every padlocked route now carries the header automatically. On orders docs,
   place an order and watch its status change by polling `GET /orders/:id`.

The token lives only in that browser tab. Refresh the docs page and you authorize
again. That mirrors how the frontend holds the JWT in Redux, in memory, never in a
cookie.

## Security notes

Docs expose the API surface, so they should be disabled or gated in production
unless you want the surface public. Locally they are a free Postman. Decorators
never affect runtime behavior; a missing `@ApiBearerAuth()` only hides the padlock,
it does not weaken the actual guard.

See [service-discovery.md](./service-discovery.md) and
[database-schema.md](./database-schema.md) for the rest of the system.