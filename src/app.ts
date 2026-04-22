// src/app.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors'; 
import cookieParser from 'cookie-parser'; 
import config from './config/env'; // Import your config
import { globalErrorHandler } from './middleware/errorMiddleware';
import { notFound } from './middleware/notFound';
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import courtRoutes from "./routes/court.routes"
import swearingPreferenceRoutes from "./routes/swearingPreference.routes"
import guestRoutes from "./routes/guest.routes"
import noticeRouter from "./routes/notices.router";
import eventRouter from "./routes/event.routes"
import galleryRouter from "./routes/gallery.routes"
import chatRoutes from "./routes/chat.routes";
import documentRoutes from "./routes/documentRoutes"
import emergencyRoutes from "./routes/emergency.routes"

const app: Application = express();

// Configure CORS using config.FRONTEND_URL
app.use(cors({
  origin: config.FRONTEND_URL, 
  credentials: true,               
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser()); 

app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to the Judiciary API');
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/court', courtRoutes);
app.use('/api/v1/swearing-preferences', swearingPreferenceRoutes);
app.use('/api/v1/guests', guestRoutes);
app.use("/api/v1/notices", noticeRouter);
app.use("/api/v1/events", eventRouter);
app.use("/api/v1/gallery", galleryRouter);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/emergency", emergencyRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;