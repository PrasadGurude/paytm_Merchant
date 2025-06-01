"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("../middleware");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }
        // Find user with email
        const user = yield prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        // Verify password
        const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        // Generate token
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            name: user.name,
            email: user.email,
        }, process.env.USER_JWT_SECRET);
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
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Internal server error" });
    }
}));
// ...existing code...
router.post("/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, name } = req.body;
    try {
        // Check if user exists
        const existingUser = yield prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        // Hash password
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        // Create new user
        prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                }
            });
            yield tx.userAccount.create({
                data: {
                    userId: user.id,
                    balance: 0,
                }
            });
            const token = jsonwebtoken_1.default.sign({
                id: user.id,
                name: user.name,
                email: user.email,
            }, process.env.USER_JWT_SECRET);
            return res.status(201).json({
                message: "User created successfully",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                }
            });
        }));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}));
router.post("/onramp", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, amount } = req.body;
    try {
        const account = yield prisma.userAccount.update({
            where: { userId },
            data: {
                balance: {
                    increment: amount
                }
            }
        });
        res.status(200).json({ message: "Balance updated", account });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}));
router.post("/transfer", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { merchantId, amount } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const paymentDone = yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const checkIsLocked = yield prisma.userAccount.findUnique({
            where: {
                userId,
                locked: 1
            }
        });
        const lockUser = yield prisma.userAccount.update({
            where: {
                userId
            },
            data: {
                locked: 1
            }
        });
        const userAccount = yield tx.userAccount.findFirst({
            where: {
                userId
            }
        });
        if (((userAccount === null || userAccount === void 0 ? void 0 : userAccount.balance) || 0) < amount) {
            return res.json({
                message: "Balence is insufficient"
            });
        }
        console.log("user balance check passed");
        yield new Promise((r) => setTimeout(r, 10000));
        if (checkIsLocked) {
            return res.json({
                message: "transaction failed due to concurrent issue"
            });
        }
        const userAccountChanges = yield tx.userAccount.update({
            where: {
                userId
            },
            data: {
                balance: {
                    decrement: amount
                }
            }
        });
        const merchantAccountChanges = yield tx.merchantAccount.update({
            where: {
                merchantId
            },
            data: {
                balance: {
                    increment: amount
                }
            }
        });
        yield tx.userAccount.update({
            where: {
                userId
            },
            data: {
                locked: 0
            }
        });
        return { userAccountChanges, merchantAccountChanges };
    }), {
        maxWait: 50000,
        timeout: 100000
    });
    if (paymentDone) {
        return res.json({
            message: "Payment done"
        });
    }
    else {
        yield prisma.userAccount.update({
            where: {
                userId
            },
            data: {
                locked: 0
            }
        });
        return res.status(411).json({
            message: `Payment failed ${paymentDone}`
        });
    }
}));
exports.default = router;
