import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IGetEventsQuery, IJudicialEvent } from "../interfaces/events.interface";

/**
 * @desc Get judicial events with automatic status calculation
 * Logic: Compares start/end times against DB NOW() to determine status on-the-fly.
 */
export const getEvents = catchAsync(async (req: Request<{}, {}, {}, IGetEventsQuery>, res: Response, next: NextFunction) => {
  const { status, search } = req.query;

  // 1. Base Query with Virtual Status Columns
  // We use PostgreSQL's NOW() to ensure the server clock is the single source of truth.
  let query = `
    SELECT *, 
    (end_time < NOW()) as is_past,
    CASE 
      WHEN start_time > NOW() THEN 'UPCOMING'
      WHEN end_time < NOW() THEN 'PAST'
      ELSE 'ONGOING'
    END as current_status
    FROM judicial_events 
    WHERE 1=1`;
  
  const values: any[] = [];

  // 2. Dynamic Filtering
  if (status && status !== 'ALL') {
    if (status === 'UPCOMING') {
      query += ` AND start_time > NOW()`;
    } else if (status === 'PAST') {
      query += ` AND end_time < NOW()`;
    } else if (status === 'ONGOING') {
      query += ` AND start_time <= NOW() AND end_time >= NOW()`;
    }
  }

  // 3. Search Implementation
  if (search) {
    values.push(`%${search}%`);
    query += ` AND (title ILIKE $${values.length} OR organizer ILIKE $${values.length})`;
  }

  // 4. Sorting
  // Orders active/upcoming events first, then sorts by time
  query += ` ORDER BY is_past ASC, start_time ASC`;

  const result = await pool.query(query, values);
  
  res.status(200).json({
    status: "success",
    results: result.rowCount,
    data: result.rows
  });
});

/**
 * @desc Create a new judicial event
 */
export const createEvent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { 
    title, description, location, 
    start_time, end_time, is_virtual, organizer 
  }: IJudicialEvent = req.body;

  // Validation: End time must be after start time
  if (new Date(start_time) >= new Date(end_time)) {
    return next(new ErrorHandler("Event end time must be after the start time", 400));
  }

  const query = `
    INSERT INTO judicial_events 
    (title, description, location, start_time, end_time, is_virtual, organizer)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *, (end_time < NOW()) as is_past`;
  
  const result = await pool.query(query, [
    title, description, location, 
    start_time, end_time, is_virtual || false, organizer
  ]);

  res.status(201).json({ 
    status: "success", 
    data: result.rows[0] 
  });
});

/**
 * @desc Update an existing judicial event
 */
export const updateEvent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { 
    title, description, location, 
    start_time, end_time, is_virtual, organizer 
  }: Partial<IJudicialEvent> = req.body;

  // Check existence
  const checkEvent = await pool.query("SELECT id FROM judicial_events WHERE id = $1", [id]);
  if (checkEvent.rowCount === 0) {
    return next(new ErrorHandler("Judicial event record not found", 404));
  }

  // Atomic Update with automatic updated_at and is_past calculation
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
    RETURNING *, (end_time < NOW()) as is_past`;

  const result = await pool.query(query, [
    title, description, location, 
    start_time, end_time, is_virtual, organizer, id
  ]);

  res.status(200).json({ 
    status: "success", 
    message: "Event updated successfully",
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