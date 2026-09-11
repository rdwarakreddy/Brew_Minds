require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const paymentRoutes = require('./src/routes/paymentRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { ensureSchema } = require('./src/config/ensureSchema');

const app = express();
const PORT = process.env.PORT || 5005;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'paymentService' }));
app.use('/api/payments', paymentRoutes);

app.use(notFound);
app.use(errorHandler);

// Makes sure this service's own tables exist before it starts accepting
// traffic -- see ensureSchema.js for why this matters.
ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`[paymentService] listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('[paymentService] Failed to ensure database schema on startup:', err.message);
    app.listen(PORT, () => console.log(`[paymentService] listening on port ${PORT} (schema check failed -- see above)`));
  });
