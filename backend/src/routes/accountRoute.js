import express from 'express';
import authController from '../controllers/authController.js';
import accountController from '../controllers/accountController.js';
import authMiddleware from '../middlewares/authMiddleWare.js'

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes (require JWT)
router.get('/me', authMiddleware, authController.me);
router.get('/profile', authMiddleware, accountController.getProfile);
router.put('/profile', authMiddleware, accountController.updateProfile);
router.put('/change-password', authMiddleware, accountController.changePassword);
router.delete('/delete', authMiddleware, accountController.deleteAccount);
router.get('/', authMiddleware, accountController.getAllAccounts);

export default router;