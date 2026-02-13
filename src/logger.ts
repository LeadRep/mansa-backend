// src/logger.ts

import pino from 'pino';

// Get the environment from an environment variable, defaulting to 'local'
const env = process.env.APP_ENV || 'local';

// Always emit JSON logs unless explicitly requested via PINO_PRETTY=true
const usePretty = String(process.env.PINO_PRETTY || '').toLowerCase() === 'true';
const transport = usePretty
    ? {
          target: 'pino-pretty',
          options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
          },
      }
    : undefined;

const logLevel = process.env.PINO_LOG_LEVEL || (env === 'local' ? 'debug' : 'info');

const logger = pino({
    level: logLevel,
    transport,
    // *** Add a base object to every log entry ***
    base: {
        env: env, // This adds a field named "env" with the value of the environment
    },
});

export default logger;
