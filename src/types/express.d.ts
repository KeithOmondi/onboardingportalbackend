import { IUser } from "../interfaces/user.interface";

declare global {
  namespace Express {
    interface Request {
      // Use the full IUser interface here
      user?: IUser; 
    }
  }
}