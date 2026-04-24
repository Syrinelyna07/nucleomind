import pool from '../config/dbConfig.js';

class Post {
    static async create(data) {
        const {post_description,nbComments,post_link} = data ;  
        try {
            console.log("Creating post with data:", data);
            if(!post_link) throw new Error("Post link is required") ;
            if(!post_description) throw new Error("Post description is required") ;
            const cond = await this.findByLink(post_link) ;
            if(cond === null) {
                const [result] = await pool.execute(`INSERT INTO posts (post_description,nbComments,post_link) VALUES (?,?,?)`,[post_description,nbComments,post_link]);
                return result.insertId ;
            }
        }           
        catch (error) {
            throw new Error(`Error creating post : ${error.message}`);
        }   
    }
    static async findByLink(post_link) {
        try {
            const [rows] = await pool.execute(`SELECT * FROM posts WHERE post_link = ?`, [post_link]);
            console.log("Finding post by link:", post_link, "Found:", rows);
            return rows.length > 0 ? rows[0] : null ;
        } catch (error) {
            throw new Error(`Error finding post by link : ${error.message}`);
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
    static async getNumbers(id){
        try {
            const [rows] = await pool.execute(`SELECT nbComments FROM posts WHERE id = ?`, [id]);
            const nbComments = rows[0].nbComments ;
            const [interactionRows] = await pool.execute(`SELECT COUNT(*) AS nbInteractions FROM interaction_posts WHERE postId = ?`, [id]);
            const [iteractionPositiveRows] = await pool.execute(`SELECT COUNT(*) AS nbPositiveInteractions FROM interaction_posts ip JOIN interactions i ON ip.interactionId = i.id WHERE ip.postId = ? AND i.sentiment_label = 'positive'`, [id]); 
            const nbPositiveInteractions = iteractionPositiveRows[0].nbPositiveInteractions ;
            const nbInteractions = interactionRows[0].nbInteractions ;
            return {nbComments, nbInteractions , nbPositiveInteractions} ;
        } catch (error) {
            throw new Error(`Error getting numbers for post : ${error.message}`);
        }
    }
}

export default Post;