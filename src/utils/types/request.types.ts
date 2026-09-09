import { Request } from 'express';

export interface RequestActor {
  id: number | string;
  username?: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: RequestActor;
}
