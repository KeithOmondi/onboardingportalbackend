import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IGetEventsQuery, IJudicialEvent } from "../interfaces/events.interface";

/**
 * @desc Get judicial events with automatic status calculation
 */
export const getEvents = catchAsync(async (req: Request<{}, {}, {}, IGetEventsQuery>, res: Response, next: NextFunction) => {
  const { status, search } = req.query;

  // 1. Force the database session to Nairobi time for accurate NOW() comparisons
  await pool.query("SET TIME ZONE 'Africa/Nairobi'");

  let query = `
    SELECT *, 
    CASE 
      WHEN start_time > NOW() THEN 'UPCOMING'
      WHEN end_time < NOW() THEN 'PAST'
      ELSE 'ONGOING'
    END as current_status
    FROM judicial_events 
    WHERE 1=1`;
  
  const values: any[] = [];

  // Filtering
  if (status && status !== 'ALL') {
    if (status === 'UPCOMING') {
      query += ` AND start_time > NOW()`;
    } else if (status === 'PAST') {
      query += ` AND end_time < NOW()`;
    } else if (status === 'ONGOING') {
      query += ` AND start_time <= NOW() AND end_time >= NOW()`;
    }
  }

  if (search) {
    values.push(`%${search}%`);
    query += ` AND (title ILIKE $${values.length} OR organizer ILIKE $${values.length})`;
  }

  // Sort: Ongoing first, then Upcoming (closest first), then Past (recent first)
  query += ` ORDER BY 
    CASE WHEN end_time >= NOW() AND start_time <= NOW() THEN 1 
         WHEN start_time > NOW() THEN 2 
         ELSE 3 END, 
    start_time ASC`;

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

  // Normalize to ISO Strings to ensure UTC storage in TIMESTAMPTZ columns
  const formattedStart = new Date(start_time).toISOString();
  const formattedEnd = new Date(end_time).toISOString();

  if (new Date(formattedStart).getTime() >= new Date(formattedEnd).getTime()) {
    return next(new ErrorHandler("Event end time must be after the start time", 400));
  }

  const query = `
    INSERT INTO judicial_events 
    (title, description, location, start_time, end_time, is_virtual, organizer)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`;
  
  const result = await pool.query(query, [
    title, description, location, 
    formattedStart, formattedEnd, is_virtual || false, organizer
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

  const checkEvent = await pool.query("SELECT id FROM judicial_events WHERE id = $1", [id]);
  if (checkEvent.rowCount === 0) {
    return next(new ErrorHandler("Judicial event record not found", 404));
  }

  // Normalize updated dates if they are provided
  const formattedStart = start_time ? new Date(start_time).toISOString() : null;
  const formattedEnd = end_time ? new Date(end_time).toISOString() : null;

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
    title, description, location, 
    formattedStart || undefined, 
    formattedEnd || undefined, 
    is_virtual, organizer, id
  ]);

  res.status(200).json({ 
    status: "success", 
    data: result.rows[0] 
  });
});

/**
 * @desc Delete a judicial event
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