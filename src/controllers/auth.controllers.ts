// ===== AUTH CONTROLLER =====
// packages/backend/src/controllers/AuthController.ts
import { NextFunction, Request, Response } from "express";
import { User } from "../models/User";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError";

interface AuthRequest extends Request {
  user?: any;
}

// authController class
export class AuthController {
  // =============================== User Registration
  // POST /api/auth/register
  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        role = "buyer",
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new AppError("User with this email already exists", 400);
      }

      // Create new user
      const user = new User({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        phone,
        role,
        isProfileComplete: false, // Set profile as incomplete
        onboardingCompleted: {
          buyer: false,
          seller: false,
          agent: false,
        },
        agentVerificationStatus: "none",
        preferences: {
          propertyTypes: [],
          priceRange: [0, 1000000],
          locations: [],
          notifications: true,
        },
      });

      await user.save();

      // Generate email verification token
      const emailToken = this.generateEmailToken(user);

      // Create verification URL
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${emailToken}`;

      // Simulate sending email (replace with nodemailer / sendgrid etc.)
      console.log(
        `Send verification email to ${user.email} with link: ${verificationUrl}`
      );

      res.status(201).json({
        success: true,
        message:
          "User registered successfully. Please verify your email before logging in.",
        data: {
          user: {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
          // ⚠️ In production, do NOT send token in response
          verificationToken:
            process.env.NODE_ENV !== "production" ? emailToken : undefined,
        },
      });
    } catch (error) {
      next(error); // pass error to global handler
    }
  };

  // ============================== User Login
  // POST /api/auth/login
  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() })
        .select("+password")
        .populate("agentId", "firstName lastName office");

      if (!user) {
        throw new AppError("Invalid email or password", 401);
      }

      //   check if user is active
      if (!user.isActive) {
        throw new AppError("User account is deactivated", 403);
      }

      // Check if password matches
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new AppError("Invalid email or password", 401);
      }

      // Check if email is verified
      if (!user.emailVerified) {
        throw new AppError("Please verify your email before logging in", 403);
      }

      //   Update last login
      await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

      // Generate JWT tokens
      const accessToken = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store refresh token in secure httpOnly cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // true in prod (HTTPS)
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Build safe user response (only essentials)
      const safeUser = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        agent: user.agentId || null,
      };

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: safeUser,
          token: accessToken,
        },
      });
    } catch (error) {
      next(error); // pass error to global handler
    }
  };

  // ============================== Refresh Token
  // POST /api/auth/refresh-token
  public refreshToken = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        throw new AppError("No refresh token provided", 401);
      }

      // Verify refresh token
      let decoded: any;
      try {
        decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!
        );
      } catch (err) {
        throw new AppError("Invalid or expired refresh token", 401);
      }
      if (decoded.type !== "refresh") {
        throw new AppError("Invalid token type", 401);
      }
      // Find user
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }
      if (!user.isActive) {
        throw new AppError("User account is deactivated", 403);
      }

      // Generate new tokens
      const newAccessToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Set new refresh token in cookie
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          token: newAccessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  //   ============================= logout
  // POST /api/auth/logout
  public logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  //   ============================= verify-token or me
  public me = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("Not authenticated", 401);
      }

      // Only return essential identity fields
      const { _id, email, firstName, lastName, role } = req.user;

      res.status(200).json({
        success: true,
        message: "User is authenticated",
        data: {
          user: {
            id: _id,
            email,
            firstName,
            lastName,
            role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================== Email Verification
  // POST /api/auth/verify-email?token=XYZ
  public verifyEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        throw new AppError("Verification token is required", 400);
      }

      // Verify token with email secret
      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.JWT_EMAIL_SECRET!);
      } catch (err) {
        throw new AppError("Invalid or expired verification token", 400);
      }

      // Ensure it's an email verification token
      if (decoded.type !== "email-verify") {
        throw new AppError("Invalid token type", 400);
      }

      // Find user by ID
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (user.emailVerified) {
        return res.status(200).json({
          success: true,
          message: "Email is already verified. You can log in.",
        });
      }

      // Mark email as verified
      user.emailVerified = true;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Email verified successfully. You can now log in.",
      });
    } catch (error) {
      next(error);
    }
  };

  //   ============================ resend verification email
  // POST /api/auth/resend-verification
  public resendVerification = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { email } = req.body;

      // 1. Find user
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new AppError("User with this email does not exist", 404);
      }

      // 2. Already verified
      if (user.emailVerified) {
        return res.status(200).json({
          success: true,
          message: "Email is already verified. You can log in.",
        });
      }

      // 3. Generate new verification token
      const emailToken = this.generateEmailToken(user);

      // 4. Create a verification link
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailToken}`;

      // 5. Send email (example with console log now)
      console.log(
        `Send verification email to ${user.email}: ${verificationUrl}`
      );

      // TODO: integrate with Nodemailer, SendGrid, or SES
      // await sendVerificationEmail(user.email, verificationUrl);

      res.status(200).json({
        success: true,
        message: "Verification email resent. Please check your inbox.",
      });
    } catch (error) {
      next(error);
    }
  };

  // =======================
  // Helper methods
  //   ========================
  private generateToken(user: any): string {
    return jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );
  }

  private generateRefreshToken(user: any): string {
    return jwt.sign(
      {
        userId: user._id,
        email: user.email,
        type: "refresh",
      },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      { expiresIn: "30d" }
    );
  }

  private generateEmailToken(user: any): string {
    return jwt.sign(
      { userId: user._id, type: "email-verify" },
      process.env.JWT_EMAIL_SECRET!,
      { expiresIn: "1h" }
    );
  }

  //======== auth controller class end
}
