import express from 'express';
import multer from 'multer';
import controller from '../controllers/organizerController.js';
import exportController from '../controllers/exportController.js';

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.get('/import', (req, res) => {
    res.json({ message: 'Import endpoint ready' });
});
router.post('/import', upload.single('file'), controller.importCSV);
router.post('/ingest/batch', controller.ingestBatchJson);

router.get('/stats/general', controller.generalStats);
router.get('/stats/problems', controller.ProblemSolutionData);
router.get('/stats/posts', controller.postStat);

router.get('/export/stats/pdf', exportController.exportStatsPDF);
router.get('/export/interactions/csv', exportController.exportInteractionsCSV);
router.get('/export/problems/csv', exportController.exportProblemsCSV);

export default router;
