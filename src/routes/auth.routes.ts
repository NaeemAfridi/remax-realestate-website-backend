// ===== AUTH ROUTES =====
// packages/backend/src/routes/AuthRoutes.ts
import { Router } from "express";
import { AuthController } from "../controllers/auth.controllers";
import { authenticateToken } from "../middleware/auth";
import { body } from "express-validator";
import { rateLimiter } from "../middleware/rateLimiter";
import { handleValidationErrors } from "../utils/handleValidationErrors";

export class AuthRoutes {
  public router: Router;
  private authController: AuthController;

  //constructor
  constructor() {
    this.router = Router();
    this.authController = new AuthController();
    this.configureRoutes();
  }

  private configureRoutes(): void {
    // Apply rate limiting to auth routes
    this.router.use(rateLimiter);

    //  Registration route
    this.router.post(
      "/register",
      this.validateRegsiter(),
      handleValidationErrors,
      this.authController.register
    );

    // verify email route
    this.router.get("/verify-email", this.authController.verifyEmail);

    // if verifactionn token expired, resend verification email for user ease to not register again
    this.router.post(
      "/resend-verification",
      this.validateResendVerification(),
      handleValidationErrors,
      this.authController.resendVerification
    );

    // login route
    this.router.post(
      "/login",
      this.validateLogin(),
      handleValidationErrors,
      this.authController.login
    );

    // verify token route or verify user (me)
    this.router.get("/me", authenticateToken, this.authController.me);

    // refresh token route
    this.router.post("/refresh-token", this.authController.refreshToken);

    // logout route
    this.router.post("/logout", this.authController.logout);

    // configure routes ends
  }

  //   Validation for user registration
  private validateRegsiter() {
    return [
      body("email")
        .isEmail()
        .withMessage("Valid email is required")
        .normalizeEmail(),
      body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage("Password must contain uppercase, lowercase, and number"),
      body("firstName")
        .trim()
        .notEmpty()
        .withMessage("First name is required")
        .isLength({ min: 2, max: 50 }),
      body("lastName")
        .trim()
        .notEmpty()
        .withMessage("Last name is required")
        .isLength({ min: 2, max: 50 }),
      body("phone")
        .optional()
        .isMobilePhone("any")
        .withMessage("Enter a valid phone number"),
      body("role").optional().isIn(["buyer", "seller", "agent", "admin"]),
    ];
  }

  //   Validation for user login
  private validateLogin() {
    return [
      body("email")
        .isEmail()
        .withMessage("Valid email is required")
        .normalizeEmail(),
      body("password").notEmpty().withMessage("Password is required"),
    ];
  }

  //   validate resends verification email
  private validateResendVerification() {
    return [
      body("email")
        .isEmail()
        .withMessage("Valid email is required")
        .normalizeEmail(),
    ];
  }

  // authRoutes class ends
}
