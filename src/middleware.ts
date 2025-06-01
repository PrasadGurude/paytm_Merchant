import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from './types/express';

export const userMiddleware = (req:Request, res:Response, next:NextFunction):any => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    jwt.verify(token, process.env.USER_JWT_SECRET as string, (err, decoded) => {
        if (err) {
        return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = decoded as User;
        next();
    });
}
export const merchantMiddleware = (req:Request, res:Response, next:NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    jwt.verify(token, process.env.MERCHANT_JWT_SECRET as string, (err, decoded) => {
        if (err) {
        return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = decoded as User;
        next();
    });
}