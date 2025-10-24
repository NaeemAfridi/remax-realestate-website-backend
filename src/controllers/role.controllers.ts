// ===== ROLE CONTROLLER =====
// packages/backend/src/controllers/role.controllers.ts

import { NextFunction, Request, Response } from "express";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";

interface AuthRequest extends Request {
  user?: any;
}
const validRoles = ["buyer", "seller"] as const;
type ValidRole = (typeof validRoles)[number];

export class RoleController {
  /**
   * POST /api/users/:id/select-role
   * User selects their primary role after registration
   */
  public selectRole = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // --- Authorization ---
      if (req.user?._id.toString() !== id) {
        throw new AppError("Unauthorized access", 403);
      }

      // --- Role Validation ---
      const validRoles = ["buyer", "seller", "agent"];
      if (!validRoles.includes(role)) {
        throw new AppError(
          "Invalid role. Must be buyer, seller, or agent",
          400
        );
      }

      // --- User Fetch ---
      const user = await User.findById(id);
      if (!user) throw new AppError("User not found", 404);

      // --- Update Role ---
      user.role = role;

      // Agent users now apply separately — don’t create agent data here
      if (role === "agent") {
        user.agentVerificationStatus = "none"; // not applied yet
      }

      await user.save();

      res.json({
        success: true,
        message: `Role updated to ${role}`,
        data: {
          role: user.role,
          nextStage: `onboarding_${role}`, // frontend decides next route
        },
      });
    } catch (error) {
      console.error("Error selecting role:", error);
      next(error);
    }
  };

  /**
   * GET /api/users/:id/onboarding-status
   * Returns user's onboarding progress for all roles
   */
  public getOnboardingStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      if (req.user?._id.toString() !== id) {
        throw new AppError("Unauthorized access", 403);
      }

      const user = await User.findById(id).select(
        "role onboardingCompleted isProfileComplete agentVerificationStatus"
      );
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const status = {
        isComplete: user.isProfileComplete,
        role: user.role,
        completedOnboarding: user.onboardingCompleted,
        nextSteps: this.getNextSteps(user),
      };

      res.json({
        success: true,
        message: "Onboarding status retrieved",
        data: status,
      });
    } catch (error) {
      console.error("Error getting onboarding status:", error);
      next(error);
    }
  };

  /**
   * POST /api/users/:id/onboarding
   * Complete onboarding for buyer or seller only
   * Agent onboarding is handled separately in AgentController
   */
  public completeOnboarding = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { role, onboardingData } = req.body;

      if (req.user?._id.toString() !== id) {
        throw new AppError("Unauthorized access", 403);
      }

      const user = await User.findById(id);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Narrow & validate role
      if (!validRoles.includes(role)) {
        throw new AppError(
          "Invalid role. Only buyer and seller onboarding are handled here.",
          400
        );
      }

      // Role-specific onboarding logic
      if (role === "buyer") {
        await this.completeBuyerOnboarding(user, onboardingData);
      } else if (role === "seller") {
        await this.completeSellerOnboarding(user, onboardingData);
      }

      const typedRole = role as ValidRole;

      // Initialize safely
      user.onboardingCompleted = user.onboardingCompleted ?? {
        buyer: false,
        seller: false,
        agent: false,
      };

      // Use Record<ValidRole, boolean> to satisfy TS
      (user.onboardingCompleted as Record<ValidRole, boolean>)[typedRole] =
        true;

      // Mark overall profile complete if role’s onboarding done
      const currentRoleComplete =
        user.onboardingCompleted[
          user.role as keyof typeof user.onboardingCompleted
        ];
      if (currentRoleComplete) user.isProfileComplete = true;

      await user.save();

      res.json({
        success: true,
        message: `${role} onboarding completed successfully`,
        data: {
          isProfileComplete: user.isProfileComplete,
          onboardingCompleted: user.onboardingCompleted,
          nextStage: `dashboard_${user.role}`,
        },
      });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      next(error);
    }
  };

  // ====== Helper Methods ======

  private async completeBuyerOnboarding(user: any, data: any) {
    user.preferences = {
      propertyTypes: data.propertyTypes || [],
      priceRange: data.priceRange || [0, 1000000],
      locations: data.locations || [],
      notifications: data.notifications !== false,
    };

    if (data.propertyTypes?.length > 0 || data.locations?.length > 0) {
      user.savedSearches.push({
        name: "My Initial Search",
        filters: {
          propertyTypes: data.propertyTypes,
          priceRange: data.priceRange,
          locations: data.locations,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
        },
        emailAlerts: data.emailAlerts || false,
        frequency: "weekly",
      });
    }
  }

  private async completeSellerOnboarding(user: any, data: any) {
    if (data.hasProperty) {
      user.preferences = {
        ...user.preferences,
        sellerData: {
          hasProperty: true,
          propertyType: data.propertyType,
          estimatedValue: data.estimatedValue,
          planToSell: data.planToSell,
          propertyAddress: data.propertyAddress,
        },
      };
    }
  }

  private getNextSteps(user: any): string[] {
    const steps: string[] = [];

    if (!user.isProfileComplete) {
      const role = user.role;

      if (!user.onboardingCompleted?.[role]) {
        steps.push(`complete_${role}_onboarding`);
      }

      // For agents, only track verification (actual onboarding handled elsewhere)
      if (role === "agent" && user.agentVerificationStatus === "pending") {
        steps.push("await_agent_verification");
      }
    }

    return steps;
  }
}
