import dotenv from 'dotenv';

dotenv.config();

const envConfig = {
    PORT: process.env.PORT || 7000,
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_NAME: process.env.DB_NAME || 'nucleomind',
    JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_key',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret_key',
    JWT_EXPIRATION: process.env.JWT_EXPIRATION || '1h',
    DB_PORT: process.env.DB_PORT,
};

export default envConfig;