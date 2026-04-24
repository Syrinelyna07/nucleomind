import express from 'express';
import multer from 'multer';
import controller from '../controllers/organizerController.js';

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.get('/import', (req, res) => {
    res.json({ message: "Import endpoint ready" });
});
router.post('/import', upload.single('file'), controller.importCSV);

export default router;