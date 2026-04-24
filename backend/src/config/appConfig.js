import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

const appConfig = (app) => {
    app.use(express.json());
    app.use(cors());
    app.use(morgan("dev"));
    app.use(express.text());
}

export default appConfig;