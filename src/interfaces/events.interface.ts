export type EventStatus = 'UPCOMING' | 'PAST' | 'ONGOING' | 'ALL';

export interface IJudicialEvent {
  id: number;
  title: string;
  description: string;
  location: string;
  start_time: Date | string;
  end_time: Date | string;
  is_virtual: boolean;
  organizer: string;
  created_at?: Date | string;
}

export interface IGetEventsQuery {
  status?: EventStatus;
  search?: string;
}