require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const notificationRoutes = require('./src/routes/notificationRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { startReminderScanner } = require('./src/jobs/reminderScanner');
const { ensureSchema } = require('./src/config/ensureSchema');

const app = express();
const PORT = process.env.PORT || 5010;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notificationService' }));
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

ensureSchema()
  .catch((err) => {
    console.error('[notificationService] Failed to ensure database schema on startup:', err.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`[notificationService] listening on port ${PORT}`);
      // Start the cron-scheduled background job that watches for meeting
      // reminders and lead follow-ups that have come due.
      startReminderScanner();
    });
  });
