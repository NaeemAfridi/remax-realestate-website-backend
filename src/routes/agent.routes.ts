// ===== AGENT ROUTES =====
// packages/backend/src/routes/agent.routes.ts
import { Router } from "express";
import { AgentController } from "../controllers/agent.controllers";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { body } from "express-validator";
import { rateLimiter } from "../middleware/rateLimiter";
import { handleValidationErrors } from "../utils/handleValidationErrors";

export class AgentRoutes {
  public router: Router;
  private agentController: AgentController;

  // constructor
  constructor() {
    this.router = Router();
    this.agentController = new AgentController();
    this.configureRoutes();
  }
  private configureRoutes(): void {
    // Apply rate limiting to auth routes
    this.router.use(rateLimiter);

    // public agents routes could go here

    // List all active & verified agents with pagination and search
    this.router.get("/", this.agentController.getActiveAgents);

    // single agent profile by id
    this.router.get("/:id/profile", this.agentController.getAgentProfileById);

    // get all listings for a specific agent
    this.router.get("/:id/listings", this.agentController.getAgentListings);

    //========== private agent routes require authentication
    this.router.use(authenticateToken);

    // Agent application route
    this.router.post(
      "/apply",
      this.validateAgentApplication(),
      handleValidationErrors,
      this.agentController.apply
    );

    // pending agent approval route could be added here
    this.router.get(
      "/status",
      authorizeRoles("admin"),
      this.agentController.getPendingAgents
    );

    // Admin approves or rejects agent applications
    this.router.patch(
      "/:id/verify",
      authorizeRoles("admin"),
      this.agentController.verifyAgent
    );
    // configure routes ends
  }

  //   validation for agent application

  private validateAgentApplication() {
    return [
      body("bio")
        .isString()
        .isLength({ min: 20 })
        .withMessage("Bio must be at least 20 characters"),
      body("licenseNumber")
        .isString()
        .notEmpty()
        .withMessage("License number is required"),
      body("licenseState")
        .isString()
        .isLength({ min: 2, max: 2 })
        .withMessage("License state must be a 2-letter code"),
      body("licenseExpiration")
        .isISO8601()
        .toDate()
        .withMessage("License expiration must be a valid date"),
      body("yearsExperience")
        .isInt({ min: 0 })
        .withMessage("Years of experience must be a non-negative integer"),
      body("specialties").isArray().withMessage("Specialties must be an array"),
      body("languages").isArray().withMessage("Languages must be an array"),
      body("office").isString().notEmpty().withMessage("Office is required"),
      body("socialMedia")
        .optional()
        .isObject()
        .withMessage("Social media must be an object"),
    ];
  }
  //   Agent routes ends
}
