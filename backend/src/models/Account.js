import pool from '../config/dbConfig'

class Account {
    static async create(firstName,lastName,email,password_hass){
        try {
            const [row] = await pool.execute(``);
            return row.insertId ;
        } catch (error) {
            throw new error(`Error creating user :${error.message}`);
        }
    }
    static async updateFirstName (id,newFirstName) {
        try {
            const [result] = await pool.execute(`UPDATE accounts SET firstName = ? WHERE id = ? `,[newFirstName,id]);
            return result.affectedRows ;
        } catch (error) {
            throw new Error(`Error updating the first name of the user .`);
        }
    }
    static async updatePassword(id,newPassword) {
        try {
            const [result] = await pool.execute(`UPDATE accounts SET password_hash = ? WHERE id = ? `,[newPassword,id]);
            return result.affectedRows ;
        } catch (error) {
            throw new Error(`Error updating the password.`);
        }
    }
    static async updateLastName (id,newLasttName) {
        try {
            const [result] = await pool.execute(`UPDATE accounts SET lastName = ? WHERE id = ? `,[newLasttName,id]);
            return result.affectedRows ;
        } catch (error) { 
            throw new Error(`Error updating the first name of the user .`);
        }
    }
    static async searchByEmail (email){
        try {
            const [result] = await pool.execute(`SELECT * FROM accounts WHERE email = ?`,[email])
            if(result.length > 0){
                return result[0];
            }
        } catch (error) {
            throw new Error(`Error in the searchByEmail function`,error.message);
        }
    }
    static async getById(id) {
        try {
            const [result] = await pool.execute(`SELECT * FROM acccounts WHERE id = ? `,[id]);
            if(result.length > 0) {
                return result[0];
            }
        } catch (error) {
            throw new Error(`error in the getByid function : `,error.message);
        }
    }
    static async getFirstName(id){
        try {
            const [result] = await pool.execute(`SELECT firstName FROM accounts WHERE id = ?`,[id]);
            if(result.length > 0){
                const account = result[0];
                return account.firstName ;
            }
        } catch (error) {
            throw new Error(`error in the getFirstName :`,error.message);
        }
    }
    static async getLastName(id){
        try {
            const [result] = await pool.execute(`SELECT lastName FROM accounts WHERE id = ?`,[id]);
            if(result.length > 0){
                const account = result[0];
                return account.lastName ;
            }
        } catch (error) {
            throw new Error(`error in the getLastName :`,error.message);
        }
    }
    static async getCreatedAt(id){
        try {
            const [result] = await pool.execute(`SELECT createdAt FROM accounts WHERE id = ?`,[id]);
            if(result.length > 0){
                const account = result[0];
                return account.createdAt ;
            }
        } catch (error) {
            throw new Error(`error in the getCreatedAt :`,error.message);
        }
    }
}