import express from 'express';
import appConfig from './config/appConfig';
import envConfig from './config/envConfig';
const app = express();

appConfig(app);


export default app;