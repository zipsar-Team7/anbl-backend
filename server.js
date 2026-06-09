import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './config/db.js';
import apiRoutes from './routes/index.js';
import rateLimit from 'express-rate-limit';
import { exec } from 'child_process';

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS

// Enhanced CORS Configuration for Production
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(helmet());
app.use(morgan('dev'));

// Anti-Scraping Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);



// Routes
app.use('/api', apiRoutes);

// Global Error Handler (Security Optimized)
app.use((err, req, res, next) => {
  // Log the error internally for developers
  console.error('SERVER_ERROR:', err.message);

  // Send a sanitized message to the user (no stack traces in production)
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    status: 'error',
    message: isDev ? err.message : 'A server error occurred. Our team has been notified.',
    ...(isDev && { stack: err.stack })
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode.`);
});