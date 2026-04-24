import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import envConfig from './envConfig.js';

const dbConfig = {
    host : envConfig.DB_HOST,
    user : envConfig.DB_USER,
    password : envConfig.DB_PASSWORD,
    database : envConfig.DB_NAME,
    port: Number(envConfig.DB_PORT),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
console.log('DB CONFIG:', envConfig.DB_HOST, envConfig.DB_PORT);
const pool = mysql.createPool(dbConfig);

async function createAccountTable() {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            firstName VARCHAR(255) NOT NULL,
            lastName VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch (error) {
        throw new Error(`Error creating the accounts table : ${error.message}`);
    }
}
const createInteractionTable = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS interactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            status ENUM ('traited', 'not_traited') NOT NULL,
            description TEXT,
            source_type ENUM ('public_comment','private_comment','private_dm') NOT NULL,
            author_username VARCHAR(255),
            content_text TEXT,
            sentiment_label ENUM ('positive', 'negative', 'neutral'),
            emotion_label VARCHAR(255),
            suggested_reply TEXT,
            content_lg VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch (error) {
        throw new Error(`Error creating the interactions table : ${error.message}`);
    }
}
const createPostTable = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            post_description TEXT,
            nbComments INT,
            post_link VARCHAR(255),
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch (error) {
        throw new Error(`Error creating the posts table : ${error.message}`);
    }
}
const createInteractionPostTable = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS interaction_posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            interactionId INT NOT NULL,
            postId INT NOT NULL,
            FOREIGN KEY (interactionId) REFERENCES interactions(id) ON DELETE CASCADE,
            FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
        )`);
    } catch (error) {
        throw new Error(`Error creating the interaction_posts table : ${error.message}`);
    }
}
const createProblemTable = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS problems (
            id INT AUTO_INCREMENT PRIMARY KEY,
            problem_summary TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch (error) {
        throw new Error(`Error creating the problems table : ${error.message}`);
    }
}
const createSolutionTable = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS solutions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            solution VARCHAR(255) NOT NULL, 
            solution_summary TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch (error) {
        throw new Error(`Error creating the solutions table : ${error.message}`);
    }
}
const createProblemSolutionTable = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS problem_solution (
            id INT AUTO_INCREMENT PRIMARY KEY,
            problemId INT NOT NULL,
            solutionId INT NOT NULL,
            FOREIGN KEY (problemId) REFERENCES problems(id) ON DELETE CASCADE,
            FOREIGN KEY (solutionId) REFERENCES solutions(id) ON DELETE CASCADE
        )`);
    } catch (error) {
        throw new Error(`Error creating the problem_solution table : ${error.message}`);
    }
}
const createInteractionProblemTable = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS interaction_problems (  
            id INT AUTO_INCREMENT PRIMARY KEY,
            interactionId INT NOT NULL,
            problemId INT NOT NULL,
            FOREIGN KEY (interactionId) REFERENCES interactions(id) ON DELETE CASCADE,
            FOREIGN KEY (problemId) REFERENCES problems(id) ON DELETE CASCADE
        )`);
    } catch (error) {
        throw new Error(`Error creating the interaction_problems table : ${error.message}`);
    }
}
const createKeyWordTabele = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS keywords (
            id INT AUTO_INCREMENT PRIMARY KEY,
            keyword VARCHAR(255) NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch (error) {
        throw new Error(`Error creating the keywords table : ${error.message}`);
    }
}
const createInteractionKeywordTable = async () => {
    try {
        const [result] = await pool.execute(`CREATE TABLE IF NOT EXISTS interaction_keywords (
            id INT AUTO_INCREMENT PRIMARY KEY,
            interactionId INT NOT NULL,
            keywordId INT NOT NULL,
            FOREIGN KEY (interactionId) REFERENCES interactions(id) ON DELETE CASCADE,
            FOREIGN KEY (keywordId) REFERENCES keywords(id) ON DELETE CASCADE
        )`);
    } catch (error) {
        throw new Error(`Error creating the interaction_keywords table : ${error.message}`);
    }
}

async function createTables() {
    await createAccountTable();
    await createInteractionTable();
    await createKeyWordTabele();
    await createInteractionKeywordTable();
    await createProblemTable();
    await createSolutionTable();
    await createProblemSolutionTable();
    await createInteractionProblemTable();
    await createPostTable();
    await createInteractionPostTable();
}

createTables();
export default pool;