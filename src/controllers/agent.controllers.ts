// controllers/AgentController.ts

import { Types } from "mongoose";
import { Agent } from "../models/Agent";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";
import { Request, Response, NextFunction } from "express";
import { Property } from "../models/Property";

interface AuthRequest extends Request {
  user?: any;
}

export class AgentController {
  /**
   * POST /api/agents/apply
   * Authenticated user applies to become an agent
   */
  public apply = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?._id;
      if (!userId) throw new AppError("Unauthorized access", 403);

      const user = await User.findById(userId);
      if (!user) throw new AppError("User not found", 404);

      if (user.agentVerificationStatus === "verified") {
        throw new AppError("You are already a verified agent", 400);
      }

      const existingAgent = await Agent.findOne({ userId });
      if (existingAgent) {
        throw new AppError("Agent application already submitted", 400);
      }

      // ✅ Create new agent application
      const agent = await Agent.create({
        userId,
        bio: req.body.bio,
        licenseNumber: req.body.licenseNumber,
        licenseState: req.body.licenseState,
        licenseExpiration: req.body.licenseExpiration,
        yearsExperience: req.body.yearsExperience,
        specialties: req.body.specialties,
        languages: req.body.languages,
        office: req.body.office,
        socialMedia: req.body.socialMedia,
        isActive: false,
      });

      // ✅ Update user’s agent verification status
      user.agentVerificationStatus = "pending";
      user.agentId = agent._id as Types.ObjectId;
      await user.save();

      res.status(201).json({
        success: true,
        message: "Agent application submitted successfully",
        data: agent,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/agents/pending
   * Admin only — list pending agent applications
   */
  public getPendingAgents = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (req.user?.role !== "admin") {
        throw new AppError("Unauthorized access", 403);
      }

      const { page = 1, limit = 20, search = "" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // ✅ Base filter for pending agents
      const baseFilter = { isActive: false };

      // ✅ Optional search on populated user fields
      const searchMatch = search
        ? {
            $or: [
              { firstName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      const [agents, total] = await Promise.all([
        Agent.find(baseFilter)
          .populate({
            path: "userId",
            select:
              "firstName lastName email phone agentVerificationStatus createdAt",
            match: searchMatch,
          })
          .populate("office", "name location")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Agent.countDocuments(baseFilter),
      ]);

      // ✅ Filter null-populated users (search filter)
      const filteredAgents = agents.filter((a) => a.userId !== null);

      res.status(200).json({
        success: true,
        message: "Pending agent applications fetched successfully",
        data: {
          agents: filteredAgents,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching pending agents:", error);
      next(error);
    }
  };

  /**
   * PATCH /api/admin/agents/:id/verify
   * Admin approves or rejects agent
   */
  public verifyAgent = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (req.user?.role !== "admin")
        throw new AppError("Unauthorized access", 403);

      const { id } = req.params;
      const { action } = req.body; // "approve" or "reject"

      const agent = await Agent.findById(id).populate("userId");
      if (!agent) throw new AppError("Agent not found", 404);

      const status = action === "approve" ? "verified" : "rejected";
      agent.isActive = action === "approve";
      await agent.save();

      if (agent.userId) {
        await User.findByIdAndUpdate(agent.userId._id, {
          agentVerificationStatus: status,
        });
      }

      res.json({
        success: true,
        message: `Agent ${status}`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/agents/profiles
   * public — list all verified agent profiles with pagination and search
   */
  public getActiveAgents = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { page = 1, limit = 20, search = "" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Only fetch verified & active agents
      const baseFilter = { isActive: true };

      // Optional search on populated user fields
      const searchMatch = search
        ? {
            $or: [
              { firstName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      // Query verified agents with pagination
      const agents = await Agent.find(baseFilter)
        .populate({
          path: "userId",
          select:
            "firstName lastName email phone agentVerificationStatus createdAt",
          match: { ...searchMatch, agentVerificationStatus: "verified" },
        })
        .populate("office", "name location")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      //  Remove null users (filtered out by search or unverified)
      const filteredAgents = agents.filter((a) => a.userId !== null);

      res.status(200).json({
        success: true,
        message: "Verified agent profiles fetched successfully",
        data: {
          agents: filteredAgents,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: filteredAgents.length,
            totalPages: Math.ceil(filteredAgents.length / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching verified agents:", error);
      next(error);
    }
  };

  /**
   * GET /api/agents/:id/profile
   * Public endpoint — fetch agent profile + verified active listings
   */
  public getAgentProfileById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      // Fetch agent with user + office info
      const agent = await Agent.findById(id)
        .populate({ path: "userId", select: "firstName lastName email phone" })
        .populate("office", "name location")
        .lean();

      if (!agent) throw new AppError("Agent not found", 404);
      if (!agent.isActive) throw new AppError("Agent is not verified", 400);

      // Fetch agent's active listings only
      const listings = await Property.find({
        listingAgent: id,
        status: "active", // only show active/available properties
      })
        .select(
          "mlsNumber title price propertyType status bedrooms bathrooms squareFootage address images createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(10) // optional: limit recent listings
        .lean();

      // Combine agent + listings data in one response
      res.status(200).json({
        success: true,
        message: "Agent profile fetched successfully",
        data: {
          agent,
          listings,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/agents/:id/listings
   * Public endpoint — fetch all active listings for a verified agent
   */
  public getAgentListings = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // ✅ Check if agent exists and is verified
      const agent = await Agent.findById(id).select("isActive");
      if (!agent) {
        throw new AppError("Agent not found", 404);
      }
      if (!agent.isActive) {
        throw new AppError("Agent is not verified", 400);
      }

      // ✅ Fetch only active listings for this agent
      const [listings, total] = await Promise.all([
        Property.find({ listingAgent: id, status: "active" })
          .select(
            "mlsNumber title price propertyType status bedrooms bathrooms squareFootage address images createdAt"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Property.countDocuments({ listingAgent: id, status: "active" }),
      ]);

      res.status(200).json({
        success: true,
        message: "Agent listings fetched successfully",
        data: {
          listings,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching agent listings:", error);
      next(error);
    }
  };

  /**
   * POST /api/agents/apply-for-manager
   * Authenticated agent applies to become a manager
   */
  public applyForManager = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user.id; // from JWT
      const { officeId, message } = req.body;

      const user = await User.findById(userId).populate("agentId");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Ensure only agents can apply
      if (user.role !== "agent") {
        throw new AppError("Only agents can apply for manager", 400);
      }

      // Ensure agent is verified
      if (user.agentVerificationStatus !== "verified") {
        throw new AppError("Only verified agents can apply for manager", 400);
      }

      // Ensure no duplicate active application
      if (user.managerApplication?.status === "pending") {
        throw new AppError("You already have a pending application", 400);
      }

      // Update application
      user.managerApplication = {
        status: "pending",
        officeId: officeId || null,
        message,
        appliedAt: new Date(),
      };

      await user.save();

      return res.status(200).json({
        success: true,
        message: "Manager application submitted successfully",
        data: user.managerApplication,
      });
    } catch (error) {
      console.error("Error in applyForManager:", error);
      next(error);
    }
  };
}
