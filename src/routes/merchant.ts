import { PrismaClient, User } from "@prisma/client";
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/login", async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    
    try {
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }

        const prisma = new PrismaClient();
        
        // Find user with email
        const user = await prisma.merchant.findUnique({
            where: { email }
        });

        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // Verify password
        const isPasswordValid =  bcrypt.compare(password, user.password!);
        if (!isPasswordValid) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // Generate token
        const token = jwt.sign(
            { 
                id: user.id, 
                name: user.name, 
                email: user.email,
            }, 
            process.env.MERCHANT_JWT_SECRET as string
        );

        res.status(200).json({ 
            success: true,
            message: "Login successful", 
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            token 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ...existing code...

router.post("/signup", async (req: Request, res: Response):Promise<any> => {
    const { email, password, name } = req.body;
    
    try {
        const prisma = new PrismaClient();
        
        // Check if user exists
        const existingUser = await prisma.merchant.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
       prisma.$transaction(async (tx) => {
         const user = await tx.merchant.create({
            data: {
                email,
                password: hashedPassword,
                name,
            }
        });

        await tx.merchantAccount.create({
            data: {
                merchantId: user.id,
                balance: 0
            }
        });

        const token = jwt.sign(
            { 
                id: user.id, 
                name: user.name, 
                email: user.email,
            }, 
            process.env.MERCHANT_JWT_SECRET as string
        );

        return res.status(201).json({ 
            message: "User created successfully",
            token ,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        });
       })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
});


export default router;
