import express from 'express';
import appConfig from './config/appConfig.js';
import envConfig from './config/envConfig.js';
import organizerRoute from './routes/organizerRoute.js';
import interactionRoute from './routes/interactionRoute.js';
import accountRoute from './routes/accountRoute.js';
import postRoute from './routes/postRoute.js';
import problemRoute from './routes/problemRoute.js';
import pool from './config/dbConfig.js';

const app = express();
pool.getConnection()
  .then(() => console.log("Connected to Railway DB ✅"))
  .catch(err => console.error(err));
appConfig(app);
app.use('/api',organizerRoute)
app.use('/accounts', accountRoute);
app.use('/interactions', interactionRoute);
app.use('/posts', postRoute);
app.use('/problems', problemRoute);

export default app;