// src/logger.ts

import pino from 'pino';

// Get the environment from an environment variable, defaulting to 'development'
const env = process.env.APP_ENV || 'local';

let transport;

if (env === 'poduction' || env === 'test') {
    transport = undefined;
} else {
    transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    };
}

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