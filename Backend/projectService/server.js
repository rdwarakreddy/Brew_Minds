require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const projectRoutes = require('./src/routes/projectRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5004;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'projectService' }));
app.use('/api/projects', projectRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => console.log(`[projectService] listening on port ${PORT}`));
