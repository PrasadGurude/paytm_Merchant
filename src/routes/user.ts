import { PrismaClient, User } from "@prisma/client";
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userMiddleware } from "../middleware";

const router = Router();
const prisma = new PrismaClient();


router.post("/login", async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }


        // Find user with email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password!);
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
            process.env.USER_JWT_SECRET as string
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

router.post("/signup", async (req: Request, res: Response): Promise<any> => {
    const { email, password, name } = req.body;

    try {

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                }
            });
            await tx.userAccount.create({
                data: {
                    userId: user.id,
                    balance: 0,
                }
            });
            const token = jwt.sign(
                {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
                process.env.USER_JWT_SECRET as string
            );

            return res.status(201).json({
                message: "User created successfully",
                token,
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

router.post("/onramp", async (req, res) => {
    const { userId, amount } = req.body;

    try {
        const account = await prisma.userAccount.update({
            where: { userId },
            data: {
                balance: {
                    increment: amount
                }
            }
        });

        res.status(200).json({ message: "Balance updated", account });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/transfer", userMiddleware, async (req, res): Promise<any> => {
    const { merchantId, amount } = req.body;

    const userId = req.user?.id!


    const paymentDone = await prisma.$transaction(async tx => {

        await tx.$queryRaw`SELECT * FROM "UserAccount" WHERE "userId" = ${userId} FOR UPDATE`

        const userAccount = await tx.userAccount.findFirst({
            where: {
                userId
            }
        })
        if ((userAccount?.balance || 0) < amount) {
            return res.json({
                message: "Balence is insufficient"
            })
        }
        console.log("user balance check passed")
        await new Promise((r): any => setTimeout(r, 10000))

        const userAccountChanges = await tx.userAccount.update({
            where: {
                userId
            },
            data: {
                balance: {
                    decrement: amount
                }
            }
        })
        const merchantAccountChanges = await tx.merchantAccount.update({
            where: {
                merchantId
            },
            data: {
                balance: {
                    increment: amount
                }
            }
        })

        return { userAccountChanges, merchantAccountChanges }
    }, {
        maxWait: 50000,
        timeout: 100000
    })

    if (paymentDone) {
        return res.json({
            message: "Payment done"
        })
    } else {

        return res.status(411).json({
            message: `Payment failed ${paymentDone}`
        })
    }

})


export default router;