import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IGetEventsQuery, IJudicialEvent } from "../interfaces/events.interface";

/**
 * @desc Get judicial events with dynamic status filtering
 */
export const getEvents = catchAsync(async (req: Request<{}, {}, {}, IGetEventsQuery>, res: Response, next: NextFunction) => {
  const { status, search } = req.query;

  // Base query
  let query = `SELECT * FROM judicial_events WHERE 1=1`;
  const values: any[] = [];

  // 1. Filter by Status (Dynamic comparison against database time)
  if (status && status !== 'ALL') {
    if (status === 'UPCOMING') {
      query += ` AND start_time > NOW()`;
    } else if (status === 'PAST') {
      query += ` AND end_time < NOW()`;
    } else if (status === 'ONGOING') {
      query += ` AND start_time <= NOW() AND end_time >= NOW()`;
    }
  }

  // 2. Filter by Search (Case-insensitive)
  if (search) {
    values.push(`%${search}%`);
    query += ` AND (title ILIKE $${values.length} OR organizer ILIKE $${values.length})`;
  }

  // Sort by earliest start time
  query += ` ORDER BY start_time ASC`;

  const result = await pool.query(query, values);
  
  res.status(200).json({
    status: "success",
    results: result.rowCount,
    data: result.rows
  });
});

/**
 * @desc Create a new judicial event (Admin only)
 */
export const createEvent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { 
    title, 
    description, 
    location, 
    start_time, 
    end_time, 
    is_virtual, 
    organizer 
  }: IJudicialEvent = req.body;

  // Basic validation check before hitting DB
  if (!title || !start_time || !end_time) {
    return next(new ErrorHandler("Please provide title, start time, and end time", 400));
  }

  const query = `
    INSERT INTO judicial_events 
    (title, description, location, start_time, end_time, is_virtual, organizer)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`;
  
  const result = await pool.query(query, [
    title, 
    description, 
    location, 
    start_time, 
    end_time, 
    is_virtual || false, 
    organizer
  ]);

  res.status(201).json({ 
    status: "success", 
    data: result.rows[0] 
  });
});

/**
 * @desc Delete an event
 */
export const deleteEvent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const result = await pool.query("DELETE FROM judicial_events WHERE id = $1 RETURNING id", [id]);

  if (result.rowCount === 0) {
    return next(new ErrorHandler("No event found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    data: null
  });
});

/**
 * @desc Update an existing judicial event (Admin only)
 */
export const updateEvent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { 
    title, 
    description, 
    location, 
    start_time, 
    end_time, 
    is_virtual, 
    organizer 
  }: Partial<IJudicialEvent> = req.body;

  // 1. Check if the event exists first
  const checkEvent = await pool.query("SELECT id FROM judicial_events WHERE id = $1", [id]);
  
  if (checkEvent.rowCount === 0) {
    return next(new ErrorHandler("Judicial event record not found", 404));
  }

  // 2. Perform the update
  // We use COALESCE to keep existing values if the update field is undefined
  const query = `
    UPDATE judicial_events 
    SET 
      title = COALESCE($1, title),
      description = COALESCE($2, description),
      location = COALESCE($3, location),
      start_time = COALESCE($4, start_time),
      end_time = COALESCE($5, end_time),
      is_virtual = COALESCE($6, is_virtual),
      organizer = COALESCE($7, organizer),
      updated_at = NOW()
    WHERE id = $8
    RETURNING *`;

  const result = await pool.query(query, [
    title, 
    description, 
    location, 
    start_time, 
    end_time, 
    is_virtual, 
    organizer,
    id
  ]);

  res.status(200).json({ 
    status: "success", 
    message: "Event updated successfully",
    data: result.rows[0] 
  });
});