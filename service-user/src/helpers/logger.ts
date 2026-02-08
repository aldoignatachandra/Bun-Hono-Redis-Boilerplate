import pino from 'pino';
import { configLoader } from '../config/loader';

const logger = pino({
  level: configLoader.getConfig().logging.level,
  transport: configLoader.getConfig().logging.pretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export default logger;
