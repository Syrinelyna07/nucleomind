import pool from '../config/database.js';

class Post {
    static async create(data) {
        const {post_description,nbComments,post_link} = data ;  
        try {
            const [result] = await pool.execute(`INSERT INTO posts (post_description,nbComments,post_link) VALUES (?,?,?)`,[post_description,nbComments,post_link]);
            return result.insertId ;
        }           
        catch (error) {
            throw new Error(`Error creating post : ${error.message}`);
        }   
    }
    static async findAll() {
        try {
            const [rows] = await pool.execute(`SELECT * FROM posts`);        
            return rows;
        } catch (error) {
            throw new Error(`Error finding posts : ${error.message}`);
        }
    }
    static async findById(id) {
        try {
            const [rows] = await pool.execute(`SELECT * FROM posts WHERE id = ?`, [id]);
            return rows[0];
        } catch (error) {
            throw new Error(`Error finding post by id : ${error.message}`);
        }   
    }
    static async update(id, data) {
        const {post_description,nbComments,post_link} = data ;  
        try {
            await pool.execute(`UPDATE posts SET post_description = ?, nbComments = ?, post_link = ? WHERE id = ?`, [post_description,nbComments,post_link, id]);
        } catch (error) {
            throw new Error(`Error updating post : ${error.message}`);
        }   
    }
    static async delete(id) {
        try {
            await pool.execute(`DELETE FROM posts WHERE id = ?`, [id]);
        } catch (error) {
            throw new Error(`Error deleting post : ${error.message}`);
        }   
    }
    static async findByInteractionId(interactionId) {
        try {
            const [rows] = await pool.execute(`SELECT p.* FROM posts p JOIN interaction_posts ip ON p.id = ip.postId WHERE ip.interactionId = ?`, [interactionId]);
            return rows;
        } catch (error) {
            throw new Error(`Error finding posts by interaction id : ${error.message}`);
        }
    }
    static async linkInteractionPost(interactionId, postId) {
        try {
            await pool.execute(`INSERT INTO interaction_posts (interactionId, postId) VALUES (?, ?)`, [interactionId, postId]);
        } catch (error) {
            throw new Error(`Error linking interaction and post : ${error.message}`);
        }
    }
    static async findInteractionByPostId(postId) {
        try {
            const [rows] = await pool.execute(`SELECT i.* FROM interactions i JOIN interaction_posts ip ON i.id = ip.interactionId WHERE ip.postId = ?`, [postId]);
            return rows;
        } catch (error) {
            throw new Error(`Error finding interactions by post id : ${error.message}`);
        }
    }
}