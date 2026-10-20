import { readFile, writeFile } from 'node:fs/promises';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const string = { type: 'string' },
  number = { type: 'number' },
  boolean = { type: 'boolean' };
const properties = {
  expectedUpdatedAt: {
    type: 'number',
    description: 'Required for PATCH/DELETE: the exact updatedAt last read from the entity.',
  },
  name: { type: 'string', minLength: 1, maxLength: 80 },
  activityId: string,
  note: { type: 'string', maxLength: 4000 },
  tags: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 40 } },
  spans: {
    type: 'array',
    minItems: 1,
    description:
      'Ordered non-overlapping active intervals, in Unix epoch milliseconds. Pauses are gaps.',
    items: {
      type: 'object',
      required: ['start', 'end'],
      properties: { start: number, end: number },
    },
  },
  nature: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
  color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
  pointsPerHour: number,
  archived: boolean,
  period: { type: 'string', enum: ['day', 'week'] },
  minutes: { type: 'number', minimum: 1 },
  date: { type: 'string', format: 'date' },
  direction: { type: 'string', enum: ['up', 'down'] },
  spanIndex: { type: 'integer', minimum: 0 },
  fromPreviousRecord: boolean,
  restore: boolean,
  id: { type: 'string', maxLength: 100 },
  timerId: string,
};
const schema = (fields, required = []) => ({
  type: 'object',
  properties: Object.fromEntries(fields.map((key) => [key, properties[key]])),
  ...(required.length ? { required } : {}),
});
const content = (schema) => ({ 'application/json': { schema } });
const paths = {};
const headers = [
  {
    name: 'Idempotency-Key',
    in: 'header',
    required: false,
    schema: { type: 'string', maxLength: 128 },
    description: 'Write deduplication in the current app process (up to 256 keys).',
  },
];
function op(route, method, summary, body, parameters = []) {
  const params = [
    ...(route.includes('{id}') ? [{ name: 'id', in: 'path', required: true, schema: string }] : []),
    ...parameters,
    ...(method === 'get' ? [] : headers),
  ];
  const operationId = method + route.replace(/\W+/g, '_');
  (paths[route] ||= {})[method] = {
    operationId,
    summary,
    parameters: params,
    ...(body ? { requestBody: { required: true, content: content(body) } } : {}),
    responses: {
      200: { description: 'Success; JSON entity or list' },
      ...(method === 'post' ? { 201: { description: 'Created' } } : {}),
      400: { description: 'Invalid request or domain validation failure' },
      401: { description: 'Missing or wrong token' },
      403: { description: 'Browser Origin or non-loopback Host rejected' },
      404: { description: 'Not found' },
      409: { description: 'Concurrent edit, timer mismatch or reused key' },
      428: { description: 'Missing expectedUpdatedAt' },
      503: { description: 'App unavailable. Query state before retrying writes.' },
    },
  };
}
const date = {
  name: 'date',
  in: 'query',
  schema: { type: 'string', format: 'date' },
  description: 'Device-local date YYYY-MM-DD; defaults to today where supported.',
};
op('/v1/health', 'get', 'Application and API version');
op('/v1/openapi', 'get', 'OpenAPI description');
op('/v1/backup', 'get', 'Read full portable backup without changing data');
op('/v1/stats', 'get', 'Daily union duration, points and all-time balance', null, [date]);
op('/v1/timer', 'get', 'Active timer and elapsed active milliseconds');
op('/v1/timeline', 'get', 'Latest-first records, active timer and idle cards for a day', null, [
  date,
]);
op(
  '/v1/records/{id}/fill',
  'post',
  'Extend one record span into its adjacent idle interval',
  schema(
    ['date', 'spanIndex', 'direction', 'expectedUpdatedAt'],
    ['date', 'spanIndex', 'direction', 'expectedUpdatedAt'],
  ),
);
op(
  '/v1/timer/start',
  'post',
  'Start a timer; reject if another timer is active',
  schema(['activityId', 'note', 'fromPreviousRecord'], ['activityId']),
);
for (const action of ['pause', 'resume', 'stop', 'cancel'])
  op(
    `/v1/timer/${action}`,
    'post',
    `${action} the matching active timer`,
    schema(['timerId'], ['timerId']),
  );
for (const [resource, fields, required] of [
  ['activities', ['name', 'color', 'nature', 'pointsPerHour', 'archived'], ['name']],
  ['records', ['id', 'activityId', 'note', 'tags', 'spans', 'restore'], ['activityId', 'spans']],
  [
    'goals',
    ['name', 'activityId', 'minutes', 'period', 'archived'],
    ['name', 'activityId', 'minutes'],
  ],
]) {
  const query =
    resource === 'records'
      ? [
          date,
          ...['q', 'activityId', 'includeDeleted', 'offset', 'limit'].map((name) => ({
            name,
            in: 'query',
            schema:
              name === 'offset' || name === 'limit'
                ? {
                    type: 'integer',
                    minimum: name === 'limit' ? 1 : 0,
                    ...(name === 'limit' ? { maximum: 500 } : {}),
                  }
                : string,
          })),
        ]
      : resource === 'goals'
        ? [date]
        : [];
  op(`/v1/${resource}`, 'get', `List ${resource}`, null, query);
  if (resource !== 'rewards') op(`/v1/${resource}/{id}`, 'get', `Read one ${resource} entity`);
  op(`/v1/${resource}`, 'post', `Create ${resource} entity`, schema(fields, required));
  op(
    `/v1/${resource}/{id}`,
    'patch',
    `Edit ${resource} using an optimistic version precondition`,
    schema([...fields.filter((key) => key !== 'id'), 'expectedUpdatedAt'], ['expectedUpdatedAt']),
  );
  op(
    `/v1/${resource}/{id}`,
    'delete',
    `Soft delete or archive ${resource} entity`,
    schema(['expectedUpdatedAt'], ['expectedUpdatedAt']),
  );
}
const document = {
  openapi: '3.0.3',
  info: {
    title: 'Open Timelog local API',
    version,
    description:
      'Desktop only. Start the app and read its local api.json discovery file. API listens on 127.0.0.1; requires Bearer authentication and rejects browser Origin headers. No arbitrary scripts, shell, filesystem access or destructive full-state restore.',
  },
  servers: [
    {
      url: 'http://127.0.0.1:43127',
      description: 'Preferred port; use actual address from api.json if occupied.',
    },
  ],
  security: [{ bearerAuth: [] }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
  paths,
};
await writeFile('public/openapi.json', JSON.stringify(document, null, 2) + '\n');
