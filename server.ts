import 'dotenv/config';
import { createApp } from './server/index';
import { startServer } from './server/lifecycle';

const PORT = 3001;

const app = createApp();
startServer({ app, port: PORT });
