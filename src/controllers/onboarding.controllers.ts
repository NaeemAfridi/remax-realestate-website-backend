// ================ these controllers are optional as we have already
// handled onbaording in role.controllers.ts for buer and seller and for
// agents in agent.controllers in aplly controller ================
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { User } from "../models/User";
import { Agent } from "../models/Agent";
import { AppError } from "../utils/AppError";
import { IUserDocument } from "../types/user";

interface AuthRequest extends Request {
  user?: IUserDocument;
}

/** Utility: mark profile complete if all onboarding steps done */
const checkProfileCompletion = (user: IUserDocument) => {
  const { onboardingCompleted } = user;
  if (
    onboardingCompleted?.buyer &&
    onboardingCompleted?.seller &&
    onboardingCompleted?.agent
  ) {
    user.isProfileComplete = true;
  }
};

export class OnboardingController {
  /**
   * @desc Complete Buyer Onboarding
   * @route POST /api/onboarding/buyer
   * @access Authenticated Buyer
   */
  public completeBuyerOnboarding = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?._id;
      if (!userId) throw new AppError("Unauthorized", 401);

      const { preferences, savedSearch } = req.body;

      const user = await User.findById(userId);
      if (!user) throw new AppError("User not found", 404);

      // Merge and update onboarding state
      user.onboardingCompleted = {
        buyer: true,
        seller: user.onboardingCompleted?.seller ?? false,
        agent: user.onboardingCompleted?.agent ?? false,
      };

      // Store buyer-specific preferences
      if (preferences) user.preferences = preferences;
      if (savedSearch) (user as any).savedSearch = savedSearch;

      checkProfileCompletion(user);
      await user.save();

      res.status(200).json({
        success: true,
        message: "Buyer onboarding completed successfully",
        data: { onboardingCompleted: user.onboardingCompleted },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc Complete Seller Onboarding
   * @route POST /api/onboarding/seller
   * @access Authenticated Seller
   */
  public completeSellerOnboarding = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?._id;
      if (!userId) throw new AppError("Unauthorized", 401);

      const { sellerPreferences } = req.body;

      const user = await User.findById(userId);
      if (!user) throw new AppError("User not found", 404);

      // Merge and update onboarding state
      user.onboardingCompleted = {
        buyer: user.onboardingCompleted?.buyer ?? false,
        seller: true,
        agent: user.onboardingCompleted?.agent ?? false,
      };

      // Store optional seller preferences
      if (sellerPreferences)
        (user as any).sellerPreferences = sellerPreferences;

      checkProfileCompletion(user);
      await user.save();

      res.status(200).json({
        success: true,
        message: "Seller onboarding completed successfully",
        data: { onboardingCompleted: user.onboardingCompleted },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc Complete Agent Onboarding (creates pending agent profile)
   * @route POST /api/onboarding/agent
   * @access Authenticated User (becoming agent)
   */
  public completeAgentOnboarding = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?._id;
      if (!userId) throw new AppError("Unauthorized", 401);

      const user = await User.findById(userId);
      if (!user) throw new AppError("User not found", 404);

      // Prevent duplicate agent application
      const existingAgent = await Agent.findOne({ userId });
      if (existingAgent)
        throw new AppError("Agent profile already exists", 400);

      const {
        bio,
        licenseNumber,
        licenseState,
        licenseExpiration,
        yearsExperience,
        specialties,
        languages,
        socialMedia,
        office,
      } = req.body;

      // Create new agent document (pending verification)
      const agent = await Agent.create({
        userId,
        bio,
        licenseNumber,
        licenseState,
        licenseExpiration,
        yearsExperience,
        specialties,
        languages,
        office,
        socialMedia,
        isActive: false,
      });

      // Update user onboarding + verification
      user.agentId = agent._id as Types.ObjectId;
      user.agentVerificationStatus = "pending";
      user.onboardingCompleted = {
        buyer: user.onboardingCompleted?.buyer ?? false,
        seller: user.onboardingCompleted?.seller ?? false,
        agent: true,
      };

      checkProfileCompletion(user);
      await user.save();

      res.status(201).json({
        success: true,
        message: "Agent onboarding completed and application pending approval",
        data: {
          agentId: agent._id,
          verificationStatus: user.agentVerificationStatus,
          onboardingCompleted: user.onboardingCompleted,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
