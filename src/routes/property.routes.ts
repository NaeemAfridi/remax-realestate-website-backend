import { Router } from "express";
import { PropertyController } from "../controllers/property.controllers";
import { authenticateToken } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimiter";
import { handleValidationErrors } from "../utils/handleValidationErrors";
import { body, param, query } from "express-validator";

export class PropertyRoutes {
  public router: Router;
  private propertyController: PropertyController;

  constructor() {
    this.router = Router();
    this.propertyController = new PropertyController();
    this.configureRoutes();
  }

  private configureRoutes(): void {
    // Apply global middlewares
    this.router.use(rateLimiter);

    // ========== public routes (no authentication) ==========
    this.router.get(
      "/public",
      [
        query("page").optional().isInt({ min: 1 }).toInt(),
        query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
        query("city").optional().isString(),
        query("state").optional().isString(),
        query("propertyType").optional().isString(),
      ],
      handleValidationErrors,
      this.propertyController.browsePublicProperties
    );

    /**
     * @route   GET /api/properties/:id
     * @desc    Get a single property (public)
     */
    this.router.get(
      "/:id",
      [param("id").isMongoId().withMessage("Invalid property ID")],
      handleValidationErrors,
      this.propertyController.getProperty
    );

    // ===== Protected routes (require authentication) =====
    this.router.use(authenticateToken);

    // ==========================================================
    //  PROPERTY ROUTES
    // ==========================================================

    /**
     * @route   GET /api/properties
     * @desc    Get all properties (filtered by role or query)
     */
    this.router.get(
      "/",
      [
        query("page").optional().isInt({ min: 1 }).toInt(),
        query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
        query("city").optional().isString(),
        query("state").optional().isString(),
        query("propertyType").optional().isString(),
      ],
      handleValidationErrors,
      this.propertyController.getProperties
    );

    // ==========================================================
    //  AGENT / MANAGER / ADMIN ROUTES
    // ==========================================================

    /**
     * @route   POST /api/properties
     * @desc    Create property (Admin, Manager, Agent)
     */
    this.router.post(
      "/",
      this.validatePropertyFields(),
      handleValidationErrors,
      this.propertyController.createProperty
    );

    /**
     * @route   PUT /api/properties/:id
     * @desc    Update property (Admin, Manager, or assigned Agent)
     */
    this.router.put(
      "/:id",
      [param("id").isMongoId().withMessage("Invalid property ID")],
      this.validatePropertyFields(true),
      handleValidationErrors,
      this.propertyController.updateProperty
    );

    /**
     * @route   DELETE /api/properties/:id
     * @desc    Soft delete property (Admin, Manager, Agent)
     */
    this.router.delete(
      "/:id",
      [param("id").isMongoId().withMessage("Invalid property ID")],
      handleValidationErrors,
      this.propertyController.deleteProperty
    );

    // ==========================================================
    //  SELLER SUBMISSION ROUTE
    // ==========================================================

    /**
     * @route   POST /api/properties/submit
     * @desc    Seller submits a property (status: pending)
     */
    this.router.post(
      "/submit",
      this.validatePropertyFields(),
      handleValidationErrors,
      this.propertyController.submitProperty
    );

    // ==========================================================
    //  MANAGER / ADMIN ASSIGNMENT ROUTE
    // ==========================================================

    /**
     * @route   PUT /api/properties/:id/assign
     * @desc    Assign property to agent/office (Admin, Manager)
     */
    this.router.put(
      "/:id/assign",
      [
        param("id").isMongoId().withMessage("Invalid property ID"),
        body("agentId").isMongoId().withMessage("Valid agent ID is required"),
        body("officeId")
          .optional()
          .isMongoId()
          .withMessage("Office ID must be valid if provided"),
      ],
      handleValidationErrors,
      this.propertyController.assignProperty
    );

    // End of configureRoutes
  }

  // ==========================================================
  //  VALIDATION HELPERS
  // ==========================================================

  private validatePropertyFields(isUpdate = false) {
    const validators = [
      body("title").if(body("title").exists()).isString().notEmpty(),
      body("description")
        .if(body("description").exists())
        .isString()
        .notEmpty(),
      body("price").if(body("price").exists()).isNumeric(),
      body("propertyType")
        .if(body("propertyType").exists())
        .isIn(["house", "condo", "townhouse", "land", "commercial"]),
      body("bedrooms").if(body("bedrooms").exists()).isNumeric(),
      body("bathrooms").if(body("bathrooms").exists()).isNumeric(),
      body("address")
        .if(body("address").exists())
        .isObject()
        .withMessage("Address must be an object"),
      body("address.city")
        .if(body("address.city").exists())
        .isString()
        .notEmpty(),
      body("address.state")
        .if(body("address.state").exists())
        .isString()
        .notEmpty(),
      body("address.zipCode")
        .if(body("address.zipCode").exists())
        .isString()
        .notEmpty(),
    ];

    if (!isUpdate) {
      // Required fields only for create/submit
      validators.push(
        body("title").exists().withMessage("Title is required"),
        body("price").exists().withMessage("Price is required"),
        body("propertyType").exists().withMessage("Property type is required"),
        body("address.city").exists().withMessage("City is required"),
        body("address.state").exists().withMessage("State is required"),
        body("address.zipCode").exists().withMessage("Zip code is required")
      );
    }

    return validators;
  }
}
