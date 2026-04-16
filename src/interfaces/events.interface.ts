export type EventStatus = 'UPCOMING' | 'PAST' | 'ONGOING' | 'ALL';

export interface IJudicialEvent {
  id: number;
  title: string;
  description: string;
  location: string;
  // ISO 8601 strings (e.g., 2026-04-16T10:00:00+03:00)
  start_time: string; 
  end_time: string;
  is_virtual: boolean;
  organizer: string;
  created_at?: string;
  updated_at?: string;
  // Virtual field added by the query
  current_status?: Exclude<EventStatus, 'ALL'>;
}

export interface IGetEventsQuery {
  status?: EventStatus;
  search?: string;
}