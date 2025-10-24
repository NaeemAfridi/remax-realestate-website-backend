import { Request, Response, NextFunction } from "express";
import { Office } from "../models/Office";
import { AppError } from "../utils/AppError";
import { Property } from "../models/Property";
import { User } from "../models/User";
import { Agent } from "../models/Agent";
import { IOffice } from "../types/office";
import mongoose, { Types } from "mongoose";

interface AuthRequest extends Request {
  user?: any;
}

export class OfficeController {
  /**
   * @desc Get all offices (public view)
   * @route GET /api/offices
   */
  public getAllOffices = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        page = 1,
        limit = 20,
        city,
        state,
        specialty,
        search,
        coordinates,
        radius = 50, // miles
        sortBy = "name",
        sortOrder = "asc",
        isPremium,
        hasActiveListings,
      } = req.query;

      //   Parse pagination safely
      const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
      const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);
      const skip = (pageNum - 1) * limitNum;

      //   Base query
      const query: any = {
        isActive: true,
        "settings.displayOnWebsite": true,
      };

      //   Filters
      if (city) {
        query["address.city"] = { $regex: new RegExp(city as string, "i") };
      }
      if (state) {
        query["address.state"] = { $regex: new RegExp(state as string, "i") };
      }
      if (specialty) {
        query.specialties = { $in: [specialty] };
      }
      if (isPremium !== undefined) {
        query.isPremium = isPremium === "true";
      }
      if (hasActiveListings === "true") {
        query["statistics.activeListings"] = { $gt: 0 };
      }
      if (search) {
        query.$or = [
          { name: new RegExp(search as string, "i") },
          { "address.city": new RegExp(search as string, "i") },
          { specialties: { $in: [new RegExp(search as string, "i")] } },
        ];
      }

      //   Geo filter
      if (coordinates) {
        const [lng, lat] = (coordinates as string)
          .split(",")
          .map((coord) => parseFloat(coord.trim()));
        if (!isNaN(lng) && !isNaN(lat)) {
          query["address.coordinates"] = {
            $geoWithin: {
              $centerSphere: [
                [lng, lat],
                (parseFloat(radius as string) || 50) / 3963.2, // miles → radians
              ],
            },
          };
        }
      }

      //   Sorting
      const sort: any = {};
      const validSortFields = [
        "name",
        "createdAt",
        "statistics.activeListings",
      ];
      if (validSortFields.includes(sortBy as string)) {
        sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;
      } else {
        sort.name = 1;
      }

      //   Fetch data in parallel
      const [offices, total] = await Promise.all([
        Office.find(query)
          .populate("manager", "firstName lastName email phone profileImage")
          .populate("agents", "firstName lastName specialties")
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Office.countDocuments(query),
      ]);

      //   Return formatted response
      res.status(200).json({
        success: true,
        message: "Offices fetched successfully",
        data: offices,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching offices:", error);
      next(error);
    }
  };

  /**
   * @desc Get single office by ID (public view)
   * @route GET /api/offices/:id
   */
  public getOfficeById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const yearStart = new Date(new Date().getFullYear(), 0, 1);

      const office = await Office.findById(id)
        .select(
          "name description address phone email website statistics images manager agents isActive settings"
        )
        .populate("manager", "firstName lastName email phone profileImage")
        .populate("agents", "firstName lastName specialties")
        .lean();

      if (!office || !office.isActive || !office.settings?.displayOnWebsite) {
        throw new AppError("Office not found", 404);
      }

      const [activeListings, soldThisYear, totalVolumeAgg] = await Promise.all([
        Property.countDocuments({ listingOffice: id, status: "active" }),
        Property.countDocuments({
          listingOffice: id,
          status: "sold",
          updatedAt: { $gte: yearStart },
        }),
        Property.aggregate([
          {
            $match: {
              listingOffice: office._id,
              status: "sold",
              updatedAt: { $gte: yearStart },
            },
          },
          { $group: { _id: null, total: { $sum: "$price" } } },
        ]),
      ]);

      const totalVolume = totalVolumeAgg[0]?.total ?? 0;

      const recentListings = await Property.find({
        listingOffice: id,
        status: "active",
      })
        .sort({ createdAt: -1 })
        .limit(6)
        .select(
          "title price address images propertyType bedrooms bathrooms squareFootage"
        )
        .lean();

      res.status(200).json({
        success: true,
        message: "Office details fetched successfully",
        data: {
          ...office,
          statistics: {
            activeListings,
            soldThisYear,
            totalVolume,
          },
          recentListings,
        },
      });
    } catch (error) {
      console.error("Error fetching office by ID:", error);
      next(error);
    }
  };

  /**
   * @desc CREATE a new office (Roles: Admin or Manager)
   * @route POST /api/offices/create
   */
  public createOffice = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userId = req.user?._id || req.user?.id;
      const { manager: managerId, franchiseId } = req.body;

      // ===== BASIC VALIDATION =====
      if (!userId) throw new AppError("Unauthorized", 401);
      if (!managerId) throw new AppError("Manager (agent id) is required", 400);
      if (!franchiseId) throw new AppError("Franchise ID is required", 400);

      // ===== ROLE CHECK =====
      const currentUser = await User.findById(userId).session(session);
      if (!currentUser) throw new AppError("User not found", 404);
      if (!["admin", "manager"].includes(currentUser.role)) {
        throw new AppError("Only admin or manager can create offices", 403);
      }

      // ===== UNIQUE FRANCHISE ID CHECK =====
      const existingOffice = await Office.findOne({ franchiseId }).session(
        session
      );
      if (existingOffice)
        throw new AppError("Franchise ID already in use", 400);

      // ===== MANAGER VALIDATION =====
      const managerAgent = await Agent.findById(managerId).session(session);
      if (!managerAgent) throw new AppError("Manager agent not found", 404);

      const managerUser = await User.findOne({
        agentId: managerAgent._id,
      }).session(session);

      if (!managerUser || managerUser.agentVerificationStatus !== "verified") {
        throw new AppError("Manager must be a verified agent", 400);
      }

      // ===== BUILD OFFICE DATA =====
      const allowedFields: (keyof IOffice)[] = [
        "name",
        "description",
        "address",
        "phone",
        "email",
        "website",
        "settings",
        "images",
        "specialties",
        "services",
        "languages",
        "officeHours",
        "socialMedia",
        "contact",
        "metadata",
        "marketAreas",
        "awards",
        "certifications",
        "isActive",
        "isPremium",
      ];

      const officeData: Partial<IOffice> = {};

      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          officeData[key] = req.body[key];
        }
      }

      // Core relationships & defaults
      officeData.manager = managerAgent._id as Types.ObjectId;
      officeData.agents = [managerAgent._id] as Types.ObjectId[];
      officeData.franchiseId = franchiseId;
      officeData.statistics = {
        totalAgents: 1,
        activeListings: 0,
        soldThisYear: 0,
        totalVolume: 0,
        averageSalePrice: 0,
        averageDaysOnMarket: 0,
        lastUpdated: new Date(),
      };

      // ===== CREATE OFFICE (transaction) =====
      const [createdOffice] = await Office.create([officeData], { session });

      // ===== LINK MANAGER =====
      managerAgent.office = createdOffice._id as Types.ObjectId;
      await managerAgent.save({ session });

      // ===== UPDATE USER ROLE =====
      if (managerUser.role !== "manager") managerUser.role = "manager";
      managerUser.officeId = createdOffice._id as Types.ObjectId;
      await managerUser.save({ session });

      await session.commitTransaction();

      // ===== FETCH POPULATED OFFICE (outside session) =====
      const populatedOffice = await Office.findById(createdOffice._id)
        .populate("manager", "firstName lastName email phone profileImage role")
        .populate("agents", "firstName lastName email role")
        .lean();

      res.status(201).json({
        success: true,
        message: "Office created successfully",
        data: populatedOffice,
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error creating office:", error);
      next(error);
    } finally {
      session.endSession();
    }
  };

  /**
   * @desc Update an existing office
   * @route PUT /api/offices/:id
   * @access Admin | Manager
   */
  public updateOffice = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const userId = req.user?._id || req.user?.id;
      const { id } = req.params;
      const { manager: newManagerId } = req.body;

      if (!userId) throw new AppError("Unauthorized", 401);
      if (!id) throw new AppError("Office ID is required", 400);

      // ===== ROLE CHECK =====
      const currentUser = await User.findById(userId).session(session);
      if (!currentUser) throw new AppError("User not found", 404);

      if (!["admin", "manager"].includes(currentUser.role)) {
        throw new AppError("Only admin or manager can update offices", 403);
      }

      // ===== FETCH OFFICE =====
      const office = await Office.findById(id).session(session);
      if (!office) throw new AppError("Office not found", 404);

      // Managers can only update their own office
      if (
        currentUser.role === "manager" &&
        office.manager?.toString() !== currentUser.agentId?.toString()
      ) {
        throw new AppError("You can only update your own office", 403);
      }

      // ===== FIELD WHITELIST =====
      const allowedFields: (keyof IOffice)[] = [
        "name",
        "description",
        "address",
        "phone",
        "email",
        "website",
        "settings",
        "images",
        "specialties",
        "services",
        "languages",
        "officeHours",
        "socialMedia",
        "contact",
        "metadata",
        "marketAreas",
        "awards",
        "certifications",
        "isActive",
        "isPremium",
      ];

      for (const key of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          (office as any)[key] = req.body[key];
        }
      }

      // ===== MANAGER UPDATE (optional) =====
      if (
        newManagerId &&
        newManagerId.toString() !== office.manager?.toString()
      ) {
        const newManagerAgent = await Agent.findById(newManagerId).session(
          session
        );
        if (!newManagerAgent)
          throw new AppError("New manager agent not found", 404);

        const newManagerUser = await User.findOne({
          agentId: newManagerAgent._id,
        }).session(session);
        if (
          !newManagerUser ||
          newManagerUser.agentVerificationStatus !== "verified"
        ) {
          throw new AppError("New manager must be a verified agent", 400);
        }

        // Reassign manager
        office.manager = newManagerAgent._id as Types.ObjectId;
        if (!office.agents.includes(newManagerAgent._id as Types.ObjectId)) {
          office.agents.push(newManagerAgent._id as Types.ObjectId);
        }

        // Update managerUser role and office reference
        if (newManagerUser.role !== "manager") newManagerUser.role = "manager";
        newManagerUser.officeId = office._id as Types.ObjectId;
        await newManagerUser.save({ session });
      }

      // ===== SAVE CHANGES =====
      await office.save({ session });

      await session.commitTransaction();
      session.endSession();

      // ===== POPULATE & RESPOND =====
      const updatedOffice = await Office.findById(id)
        .populate("manager", "firstName lastName email phone profileImage")
        .populate("agents", "firstName lastName email")
        .lean();

      res.status(200).json({
        success: true,
        message: "Office updated successfully",
        data: updatedOffice,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error updating office:", error);
      next(error);
    }
  };

  /**
   * @desc Soft delete an office (Roles: Admin or Manager)
   * @route DELETE /api/offices/:id
   */
  public deleteOffice = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userId = req.user?._id || req.user?.id;
      const { id } = req.params;

      // ===== BASIC VALIDATION =====
      if (!userId) throw new AppError("Unauthorized", 401);
      if (!id) throw new AppError("Office ID is required", 400);

      const currentUser = await User.findById(userId).session(session);
      if (!currentUser) throw new AppError("User not found", 404);
      if (!["admin", "manager"].includes(currentUser.role)) {
        throw new AppError("Only admin or manager can delete offices", 403);
      }

      // ===== FIND OFFICE =====
      const office = await Office.findById(id).session(session);
      if (!office) throw new AppError("Office not found", 404);
      if (!office.isActive)
        throw new AppError("Office is already inactive", 400);

      // ===== MANAGER PERMISSION CHECK =====
      if (
        currentUser.role === "manager" &&
        office.manager?.toString() !== currentUser.agentId?.toString()
      ) {
        throw new AppError("Managers can only delete their own offices", 403);
      }

      // ===== SOFT DELETE =====
      office.isActive = false;
      (office as any).deletedAt = new Date();

      await office.save({ session });

      // ===== OPTIONAL: Deactivate agents in this office =====
      await Promise.all([
        Agent.updateMany(
          { office: office._id },
          { $set: { isActive: false } },
          { session }
        ),
        User.updateMany(
          { officeId: office._id },
          { $unset: { officeId: "" } },
          { session }
        ),
      ]);

      await session.commitTransaction();

      res.status(200).json({
        success: true,
        message: "Office deleted successfully (soft delete)",
        data: { officeId: office._id, deletedAt: (office as any).deletedAt },
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error deleting office:", error);
      next(error);
    } finally {
      session.endSession();
    }
  };
}
