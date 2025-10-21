// ===== USER ROUTES =====
// packages/backend/src/routes/UserRoutes.ts
import { Router } from "express";
import { UserController } from "../controllers/user.controllers";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "../utils/handleValidationErrors";

export class UserRoutes {
  public router: Router;
  private userController: UserController;

  constructor() {
    this.router = Router();
    this.userController = new UserController();
    this.configureRoutes();
  }

  private configureRoutes(): void {
    // ================= Public Routes =================
    this.router.post(
      "/forgot-password",
      this.validateForgotPassword(),
      handleValidationErrors,
      this.userController.forgotPassword
    );

    this.router.post(
      "/reset-password",
      this.validateResetPassword(),
      handleValidationErrors,
      this.userController.resetPassword
    );

    // ================= Authenticated Routes =================
    this.router.use(authenticateToken);

    // Get all users - Admin only
    this.router.get(
      "/",
      authorizeRoles("admin"),
      this.validateGetUsers(),
      handleValidationErrors,
      this.userController.getAllUsers
    );

    // Get own profile
    this.router.get("/profile", this.userController.getCurrentUserProfile);

    // Get user by ID
    this.router.get(
      "/:id",
      this.validateUserId(),
      handleValidationErrors,
      this.userController.getUserById
    );

    // Update user
    this.router.put(
      "/:id",
      this.validateUserId(),
      this.validateUpdateUser(),
      handleValidationErrors,
      this.userController.updateUser
    );

    // Delete user
    this.router.delete(
      "/:id",
      this.validateUserId(),
      handleValidationErrors,
      this.userController.deleteUser
    );

    // Change password
    this.router.put(
      "/:id/password",
      this.validateUserId(),
      this.validateChangePassword(),
      handleValidationErrors,
      this.userController.changePassword
    );

    // Favorite properties
    this.router.get(
      "/:id/favorites",
      this.validateUserId(),
      handleValidationErrors,
      this.userController.getFavoriteProperties
    );

    this.router.post(
      "/:id/favorites",
      this.validateUserId(),
      this.validateAddFavorite(),
      handleValidationErrors,
      this.userController.addFavoriteProperty
    );

    this.router.delete(
      "/:id/favorites/:propertyId",
      this.validateUserId(),
      param("propertyId").isMongoId().withMessage("Invalid property ID"),
      handleValidationErrors,
      this.userController.removeFavoriteProperty
    );

    // Saved searches
    this.router.get(
      "/:id/saved-searches",
      this.validateUserId(),
      handleValidationErrors,
      this.userController.getSavedSearches
    );

    this.router.post(
      "/:id/saved-searches",
      this.validateUserId(),
      this.validateSavedSearch(),
      handleValidationErrors,
      this.userController.addSavedSearch
    );

    this.router.put(
      "/:id/saved-searches/:searchId",
      this.validateUserId(),
      param("searchId").isMongoId().withMessage("Invalid search ID"),
      handleValidationErrors,
      this.userController.updateSavedSearch
    );

    this.router.delete(
      "/:id/saved-searches/:searchId",
      this.validateUserId(),
      param("searchId").isMongoId().withMessage("Invalid search ID"),
      handleValidationErrors,
      this.userController.deleteSavedSearch
    );

    this.router.post(
      "/:id/saved-searches/:searchId/execute",
      this.validateUserId(),
      param("searchId").isMongoId().withMessage("Invalid search ID"),
      handleValidationErrors,
      this.userController.executeSavedSearch
    );

    // Preferences
    this.router.put(
      "/:id/preferences",
      this.validateUserId(),
      this.validatePreferences(),
      handleValidationErrors,
      this.userController.updatePreferences
    );

    // Activity
    this.router.get(
      "/:id/activity",
      this.validateUserId(),
      handleValidationErrors,
      this.userController.getUserActivity
    );
    // configure routes ends
  }

  // ================== Validators ==================
  private validateGetUsers() {
    return [
      query("page").optional().isInt({ min: 1 }),
      query("limit").optional().isInt({ min: 1, max: 100 }),
      query("role").optional().isIn(["buyer", "seller", "agent", "admin"]),
      query("isActive").optional().isBoolean(),
      query("sortBy")
        .optional()
        .isIn(["createdAt", "firstName", "lastName", "email"]),
      query("sortOrder").optional().isIn(["asc", "desc"]),
    ];
  }

  private validateUserId() {
    return [param("id").isMongoId().withMessage("Invalid user ID")];
  }

  private validateUpdateUser() {
    return [
      body("email").optional().isEmail().normalizeEmail(),
      body("firstName").optional().trim().isLength({ min: 2, max: 50 }),
      body("lastName").optional().trim().isLength({ min: 2, max: 50 }),
      body("phone")
        .optional()
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage("Phone must be in format (XXX) XXX-XXXX"),
      body("role").optional().isIn(["buyer", "seller", "agent", "admin"]),
      body("agentId").optional().isMongoId(),
    ];
  }

  private validateChangePassword() {
    return [
      body("currentPassword").notEmpty(),
      body("newPassword")
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    ];
  }

  private validateAddFavorite() {
    return [body("propertyId").isMongoId()];
  }

  private validateSavedSearch() {
    return [
      body("name").trim().isLength({ min: 3, max: 100 }),
      body("filters").isObject(),
      body("emailAlerts").optional().isBoolean(),
      body("frequency").optional().isIn(["daily", "weekly", "monthly"]),
    ];
  }

  private validatePreferences() {
    return [
      body("propertyTypes").optional().isArray(),
      body("priceRange")
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage("Price range must be [min, max]"),
      body("locations").optional().isArray(),
      body("notifications").optional().isBoolean(),
    ];
  }

  private validateForgotPassword() {
    return [body("email").isEmail().normalizeEmail()];
  }

  private validateResetPassword() {
    return [
      body("token").notEmpty(),
      body("newPassword")
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    ];
  }
  // router class ends
}
