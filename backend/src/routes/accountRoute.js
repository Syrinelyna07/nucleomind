import express from 'express';
import accountController from '../controllers/accountController';
import authController from '../controllers/authController';
const router = express.Router();
const upload = multer({dest: 'uploads/'});


export default router ;