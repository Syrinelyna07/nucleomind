import pool from '../config/dbConfig.js';
import crypto from 'crypto';

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

class Account {
    static async create({ firstName, lastName, email, password }) {
        const password_hash = hashPassword(password);
        try {
            const [result] = await pool.execute(
                `INSERT INTO accounts (firstName, lastName, email, password_hash) VALUES (?, ?, ?, ?)`,
                [firstName, lastName, email, password_hash]
            );
            return result.insertId;
        } catch (error) {
            throw new Error(`Error creating account: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [result] = await pool.execute(
                `SELECT id, firstName, lastName, email, createdAt FROM accounts WHERE id = ?`,
                [id]
            );
            return result[0] || null;
        } catch (error) {
            throw new Error(`Error in findById: ${error.message}`);
        }
    }
    static async getPasswordHashById(id) {
        try {
            const [result] = await pool.execute(`SELECT password_hash FROM accounts WHERE id = ?`,[id]);
        } catch (error) {
            
        }
    }
    static async searchByEmail(email) {
        try {
            const [result] = await pool.execute(
                `SELECT * FROM accounts WHERE email = ?`,
                [email]
            );
            return result[0] || null;
        } catch (error) {
            throw new Error(`Error in searchByEmail: ${error.message}`);
        }
    }

    static async findByEmail(email) {
        return Account.searchByEmail(email);
    }

    static async updateProfile(id, { firstName, lastName, email }) {
        try {
            const [result] = await pool.execute(
                `UPDATE accounts SET firstName = ?, lastName = ?, email = ? WHERE id = ?`,
                [firstName, lastName, email, id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error updating profile: ${error.message}`);
        }
    }

    static async updatePassword(id, newPassword) {
        const password_hash = hashPassword(newPassword);
        try {
            const [result] = await pool.execute(
                `UPDATE accounts SET password_hash = ? WHERE id = ?`,
                [password_hash, id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error updating password: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.execute(
                `DELETE FROM accounts WHERE id = ?`,
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error deleting account: ${error.message}`);
        }
    }

    static async getAll() {
        try {
            const [result] = await pool.execute(
                `SELECT id, firstName, lastName, email, createdAt FROM accounts`
            );
            return result;
        } catch (error) {
            throw new Error(`Error getting all accounts: ${error.message}`);
        }
    }

    static comparePassword(plainPassword, hash) {
        return hashPassword(plainPassword) === hash;
    }
}

export default Account;