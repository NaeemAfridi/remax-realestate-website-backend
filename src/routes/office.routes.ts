// ===== OFFICE ROUTES =====
// packages/backend/src/routes/office.routes.ts

import { Router } from "express";
import { OfficeController } from "../controllers/office.controllers";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimiter";
import { handleValidationErrors } from "../utils/handleValidationErrors";
import { body, param, query } from "express-validator";

export class OfficeRoutes {
  public router: Router;
  private officeController: OfficeController;

  constructor() {
    this.router = Router();
    this.officeController = new OfficeController();
    this.configureRoutes();
  }

  private configureRoutes(): void {
    // Apply global rate limiting for security
    this.router.use(rateLimiter);

    // ===== PUBLIC ROUTES =====

    /**
     * @route GET /api/offices
     * @desc  Get all active offices (with filters, search, pagination)
     */
    this.router.get(
      "/",
      this.validateGetAllOffices(),
      handleValidationErrors,
      this.officeController.getAllOffices
    );

    /**
     * @route GET /api/offices/:id
     * @desc  Get single office details by ID (public)
     */
    this.router.get(
      "/:id",
      [param("id").isMongoId().withMessage("Invalid office ID")],
      handleValidationErrors,
      this.officeController.getOfficeById
    );

    // ===== PROTECTED ROUTES =====
    this.router.use(authenticateToken);

    /**
     * @route POST /api/offices/create
     * @desc  Create a new office (Admin or Manager only)
     */
    this.router.post(
      "/create",
      authorizeRoles("admin", "manager"),
      this.validateCreateOffice(),
      handleValidationErrors,
      this.officeController.createOffice
    );

    /**
     * @route PUT /api/offices/:id
     * @desc  Update an existing office (Admin or Manager)
     */
    this.router.put(
      "/:id",
      authorizeRoles("admin", "manager"),
      this.validateUpdateOffice(),
      handleValidationErrors,
      this.officeController.updateOffice
    );

    /**
     * @route DELETE /api/offices/:id
     * @desc  Soft delete an office (Admin or Manager)
     */
    this.router.delete(
      "/:id",
      authorizeRoles("admin", "manager"),
      [param("id").isMongoId().withMessage("Invalid office ID")],
      handleValidationErrors,
      this.officeController.deleteOffice
    );

    // configureRoutes end
  }

  // ===== VALIDATION SCHEMAS =====

  private validateGetAllOffices() {
    return [
      query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
      query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
      query("city").optional().isString(),
      query("state").optional().isString(),
      query("specialty").optional().isString(),
      query("search").optional().isString(),
      query("coordinates")
        .optional()
        .matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
        .withMessage("Coordinates must be 'lng,lat'"),
      query("radius").optional().isNumeric(),
      query("isPremium").optional().isBoolean().toBoolean(),
      query("hasActiveListings").optional().isBoolean().toBoolean(),
    ];
  }

  private validateCreateOffice() {
    return [
      body("name").isString().notEmpty().withMessage("Office name is required"),
      body("manager")
        .isMongoId()
        .withMessage("Valid manager (agent) ID required"),
      body("franchiseId")
        .isString()
        .notEmpty()
        .withMessage("Franchise ID is required"),
      body("address").isObject().withMessage("Address must be an object"),
      body("email").optional().isEmail().withMessage("Invalid email address"),
      body("phone").optional().isString(),
      body("website").optional().isURL().withMessage("Invalid website URL"),
    ];
  }

  private validateUpdateOffice() {
    return [
      param("id").isMongoId().withMessage("Invalid office ID"),
      body("name").optional().isString(),
      body("email").optional().isEmail().withMessage("Invalid email"),
      body("manager")
        .optional()
        .isMongoId()
        .withMessage("Manager must be a valid agent ID"),
      body("address").optional().isObject(),
      body("phone").optional().isString(),
      body("website").optional().isURL(),
    ];
  }

  //   officeRoutes class end
}
