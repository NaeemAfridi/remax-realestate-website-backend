import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { Agent } from "../models/Agent";

// Buyer onboarding
export const completeBuyerOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user._id;
    const { preferences, savedSearch } = req.body;
    await User.findByIdAndUpdate(userId, {
      preferences,
      $set: { "onboardingCompleted.buyer": true },
    });
    // Optionally add savedSearch, alerts, etc.
    // If all onboarding completed, set isProfileComplete
    const user = await User.findById(userId);
    if (
      user.onboardingCompleted.buyer &&
      (user.primaryRole === "buyer" ||
        user.onboardingCompleted[user.primaryRole])
    ) {
      user.isProfileComplete = true;
      await user.save();
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

// Seller onboarding
export const completeSellerOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user._id;
    const { sellerPreferences } = req.body;
    await User.findByIdAndUpdate(userId, {
      $set: { "onboardingCompleted.seller": true },
    });
    // Optionally: create property, assign seller
    // Set isProfileComplete if needed
    const user = await User.findById(userId);
    if (
      user.onboardingCompleted.seller &&
      (user.primaryRole === "seller" ||
        user.onboardingCompleted[user.primaryRole])
    ) {
      user.isProfileComplete = true;
      await user.save();
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

// Agent onboarding (creates pending agent profile)
export const completeAgentOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user._id;
    const agentData = req.body;
    const agent = await Agent.create({
      ...agentData,
      userId,
      verificationStatus: "pending",
    });
    await User.findByIdAndUpdate(userId, {
      agentId: agent._id,
      agentVerificationStatus: "pending",
      $set: { "onboardingCompleted.agent": true },
    });
    res.json({ success: true, agentId: agent._id });
  } catch (e) {
    next(e);
  }
};

// Add additional role
export const addRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user._id;
    const { role } = req.body; // "buyer", "seller", "agent"
    const user = await User.findById(userId);
    if (!user.additionalRoles.includes(role)) {
      user.additionalRoles.push(role);
      await user.save();
    }
    res.json({ success: true, roles: user.additionalRoles });
  } catch (e) {
    next(e);
  }
};
