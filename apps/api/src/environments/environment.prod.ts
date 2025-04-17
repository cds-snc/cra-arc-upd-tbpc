export const environment = {
  production: true,
  dbHost: process.env.DB_HOST,
  redisHost: process.env.REDIS_HOST || 'redis',
  redisUsername: undefined,
  redisPassword: undefined,
};
