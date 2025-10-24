// ===== ROLE ROUTES =====
// packages/backend/src/routes/role.routes.ts

import { Router } from "express";
import { RoleController } from "../controllers/role.controllers";
import { authenticateToken } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimiter";
import { handleValidationErrors } from "../utils/handleValidationErrors";
import { body, param } from "express-validator";

export class RoleRoutes {
  public router: Router;
  private roleController: RoleController;

  constructor() {
    this.router = Router();
    this.roleController = new RoleController();
    this.configureRoutes();
  }

  private configureRoutes(): void {
    // Apply rate limiting globally (for security)
    this.router.use(rateLimiter);

    // ===== Protected routes (require authentication) =====
    this.router.use(authenticateToken);

    /**
     * @route   POST /api/users/:id/select-role
     * @desc    Select user’s primary role (buyer, seller, agent)
     */
    this.router.post(
      "/:id/select-role",
      this.validateSelectRole(),
      handleValidationErrors,
      this.roleController.selectRole
    );

    /**
     * @route   GET /api/users/:id/onboarding-status
     * @desc    Get onboarding progress for all roles
     */
    this.router.get(
      "/:id/onboarding-status",
      [param("id").isMongoId().withMessage("Invalid user ID")],
      handleValidationErrors,
      this.roleController.getOnboardingStatus
    );

    /**
     * @route   POST /api/users/:id/onboarding
     * @desc    Complete onboarding for buyer or seller (not agent)
     */
    this.router.post(
      "/:id/onboarding",
      this.validateOnboarding(),
      handleValidationErrors,
      this.roleController.completeOnboarding
    );

    // configureRoutes end
  }

  private validateSelectRole() {
    return [
      param("id").isMongoId().withMessage("Invalid user ID"),
      body("role")
        .isString()
        .isIn(["buyer", "seller", "agent"])
        .withMessage("Role must be buyer, seller, or agent"),
    ];
  }

  private validateOnboarding() {
    return [
      param("id").isMongoId().withMessage("Invalid user ID"),
      body("role")
        .isString()
        .isIn(["buyer", "seller"])
        .withMessage("Role must be buyer or seller"),
      body("onboardingData").isObject().withMessage("Onboarding data required"),
    ];
  }

  //   roleRoutes class end
}
