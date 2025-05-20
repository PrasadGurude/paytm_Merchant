
export interface User {
    id: string?;
    name: string?;
    email: string?;
}


declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}