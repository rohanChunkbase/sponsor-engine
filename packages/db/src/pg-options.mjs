/**
 * Options for postgres.js on the Supavisor transaction pooler (port 6543).
 * prepare: false keeps the driver off named prepared statements.
 * max: 1 fits one serverless instance. The worker runs one query at a time.
 */
export function postgresOptions(url) {
  const local = /localhost|127\.0\.0\.1/.test(url);
  return {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
    fetch_types: false,
    ssl: local ? false : { rejectUnauthorized: false },
    connection: { application_name: "sponsor-engine" },
    onnotice() {},
    transform: { undefined: null },
    types: {
      int8: {
        to: 20,
        from: [20],
        serialize: (value) => String(value),
        parse: (value) => Number(value),
      },
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (value) => String(value),
        parse: (value) => Number(value),
      },
    },
  };
}
