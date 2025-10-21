// packages/backend/src/controllers/user.ontrollers.ts
import { NextFunction, Request, Response } from "express";
import { User } from "../models/User";
import { Property } from "../models/Property";
import crypto from "crypto";
import { AppError } from "../utils/AppError";
import mongoose from "mongoose";
import { Agent } from "../models/Agent";

interface AuthRequest extends Request {
  user?: any;
}

// user controller class
export class UserController {
  // ============= get all users admin only ==============
  // @route GET /api/users

  public getAllUsers = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const pageNum = Math.max(parseInt(page as string, 10), 1);
      const limitNum = Math.min(
        Math.max(parseInt(limit as string, 10), 1),
        100
      ); // max 100 per page
      const skip = (pageNum - 1) * limitNum;

      //   Build query object
      const query: any = {};
      if (role) query.role = role;
      if (isActive !== undefined) query.isActive = isActive === "true";

      if (search) {
        query.$or = [
          { firstName: new RegExp(search as string, "i") },
          { lastName: new RegExp(search as string, "i") },
          { email: new RegExp(search as string, "i") },
        ];
      }

      const sortOptions: any = {
        [sortBy as string]: sortOrder === "asc" ? 1 : -1,
      };

      // fetch users, Execute query with pagination and sorting
      const [users, total] = await Promise.all([
        User.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .select("-password")
          .lean(),
        User.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        message: "users fetched successfully",
        data: {
          users,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            hasNext: pageNum * limitNum < total,
            hasPrev: pageNum > 1,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  //   ================== get user by id this is for  ==================
  //   @route GET /api/users/:id
  // Admin can fetch any user.
  // Regular users can only fetch themselves (if :id === req.user._id).
  // Includes extra stats (saved searches count, favorite properties count).
  public getUserById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      // check if the user is admin or the user himself
      if (req.user.role !== "admin" && req.user._id.toString() !== id) {
        throw new AppError("Unauthorized access", 403);
      }

      const user = await this.fetchUserData(id, true);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "User fetched successfully ",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  //   ============================= get current user profile =============================
  //   @route GET /api/users/profile
  // Shortcut for “give me my profile”.
  // Doesn’t require :id param.
  // No stats, just basic profile.
  public getCurrentUserProfile = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        throw new AppError("User ID missing in token", 400);
      }
      const user = await this.fetchUserData(userId, false);
      if (!user) {
        throw new AppError("User not found", 404);
      }
      res.status(200).json({
        success: true,
        message: "Profile fetched successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================= update user ==================
  // admin can update user and also user can update self data
  //  :id param is required
  //   PUT /api/users/:id
  public updateUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      // Permission check: admin or the user himself
      if (req.user?.role !== "admin" && req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      // Build update object
      const updateData: Partial<Record<string, unknown>> = {};
      const allowedFields = ["firstName", "lastName", "phone", "preferences"];

      if (req.user?.role === "admin") {
        allowedFields.push("role", "isActive", "agentId");
      }

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new AppError("No valid fields provided for update", 400);
      }

      const user = await User.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
        .select("-password -passwordResetToken")
        .populate("agentId", "firstName lastName email phone office");

      if (!user) {
        throw new AppError("User not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // =================================== Delete user ===============
  // admin can update user and also user can update self data
  //  :id param is required
  //  DELETE /api/users/:id

  public deleteUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      // Only admins or the user themselves can delete
      if (req.user?.role !== "admin" && req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      const hardDelete = req.query.hard === "true";

      // Only admins can hard delete
      if (hardDelete && req.user?.role !== "admin") {
        throw new AppError("Only admins can hard delete users", 403);
      }

      let user;

      if (hardDelete) {
        // Hard delete
        user = await User.findByIdAndDelete(id).select(
          "-password -passwordResetToken"
        );
      } else {
        //  Soft delete
        user = await User.findByIdAndUpdate(
          id,
          { isActive: false },
          { new: true }
        ).select("-password -passwordResetToken");
      }

      if (!user) {
        throw new AppError("User not found", 404);
      }

      res.status(200).json({
        success: true,
        message: hardDelete
          ? "User permanently deleted successfully"
          : "User deactivated successfully",
        data: { id: user._id, isActive: user.isActive ?? false },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================= change password ==============
  // user can change thier password
  //  PUT /api/users/:id/password
  public changePassword = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      // Users can only change their own password
      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      // find user by id
      const user = await User.findById(id);
      if (!user) {
        throw new AppError("user not found", 400);
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new AppError("Current password is incorrect", 401);
      }

      // update password
      user.password = newPassword;
      await user.save();

      // return reponse
      res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== get favorites properties =========
  //  GET /api/users/:id/favorites
  public getFavoriteProperties = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, status = "active" } = req.query;

      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const user = await User.findById(id).select("favoriteProperties");
      if (!user) {
        throw new AppError("user not found", 404);
      }

      const query: any = {
        _id: { $in: user.favoriteProperties },
      };

      if (status) {
        query.status = status;
      }

      const [properties, total] = await Promise.all([
        Property.find(query)
          .populate("listingAgent", "firstName lastName email phone")
          .populate("listingOffice", "name phone")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Property.countDocuments(query),
      ]);

      // return response
      res.status(200).json({
        success: true,
        message: "Favorites properties fetched successfully",
        data: {
          properties,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== add favorite property =========
  // POST /api/users/:id/favorites
  public addFavoriteProperty = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { propertyId } = req.body;

      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      const property = await Property.findById(propertyId);
      if (!property) {
        throw new AppError("Property not found", 404);
      }

      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $addToSet: { favoriteProperties: propertyId } },
        { new: true }
      )
        .select("-password")
        .populate(
          "favoriteProperties",
          "title price address images propertyType bedrooms bathrooms squareFootage status"
        );

      res.status(200).json({
        success: true,
        message: "Property added to favorites",
        data: { favoriteProperties: updatedUser?.favoriteProperties },
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== delete favorite property =========
  // DELETE /api/users/:id/favorites/:propertyId
  public removeFavoriteProperty = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id, propertyId } = req.params;

      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $pull: { favoriteProperties: propertyId } },
        { new: true }
      )
        .select("-password")
        .populate(
          "favoriteProperties",
          "title price address images propertyType bedrooms bathrooms squareFootage status"
        );

      if (!updatedUser) {
        throw new AppError("User not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Property removed from favorites",
        data: { favoriteProperties: updatedUser.favoriteProperties },
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== get saved searches =========
  // GET /api/users/:id/saved-searches
  public getSavedSearches = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      // Users can only view their own saved searches
      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      const user = await User.findById(id).select("savedSearches").lean();
      if (!user) {
        throw new AppError("User not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Saved searches fetched successfully",
        data: {
          savedSearches: user.savedSearches,
          total: user.savedSearches.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== add saved searches =========
  // POST /api/users/:id/saved-searches
  public addSavedSearch = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const {
        name,
        filters,
        emailAlerts = false,
        frequency = "weekly",
      } = req.body;

      // Users can only manage their own saved searches
      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      if (!name || !filters || typeof filters !== "object") {
        throw new AppError("Valid name and filters are required", 400);
      }

      const user = await User.findById(id);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Check if saved search limit reached (max 10 per user)
      if (user.savedSearches.length >= 10) {
        throw new AppError("Maximum saved searches limit reached (10)", 400);
      }

      const savedSearch = {
        _id: new mongoose.Types.ObjectId(),
        name,
        filters,
        emailAlerts,
        frequency,
        createdAt: new Date(),
      };

      user.savedSearches.push(savedSearch as any);
      await user.save();

      res.status(201).json({
        success: true,
        message: "Search saved successfully",
        data: savedSearch,
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== update saved searches =========
  // PUT /api/users/:id/saved-searches/:searchId
  public updateSavedSearch = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id, searchId } = req.params;
      const { name, filters, emailAlerts, frequency } = req.body;

      // Users can only manage their own saved searches
      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      const user = await User.findById(id);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const savedSearchIndex = user.savedSearches.findIndex(
        (search: any) => search._id.toString() === searchId
      );

      if (savedSearchIndex === -1) {
        throw new AppError("Saved search not found", 404);
      }

      // Partial update
      if (name) user.savedSearches[savedSearchIndex].name = name;
      if (filters) {
        user.savedSearches[savedSearchIndex].filters = {
          ...user.savedSearches[savedSearchIndex].filters,
          ...filters,
        };
      }
      if (emailAlerts !== undefined)
        user.savedSearches[savedSearchIndex].emailAlerts = emailAlerts;
      if (frequency) user.savedSearches[savedSearchIndex].frequency = frequency;

      await user.save();

      res.status(200).json({
        success: true,
        message: "Saved search updated successfully",
        data: {
          savedSearch: user.savedSearches[savedSearchIndex],
          total: user.savedSearches.length,
          savedSearches: user.savedSearches,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== delete saved searches =========
  // DELETE /api/users/:id/saved-searches/:searchId
  public deleteSavedSearch = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id, searchId } = req.params;

      // Users can only manage their own saved searches
      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      const user = await User.findById(id);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const exists = user.savedSearches.some(
        (search: any) => search._id.toString() === searchId
      );
      if (!exists) {
        throw new AppError("Saved search not found", 404);
      }

      user.savedSearches = user.savedSearches.filter(
        (search: any) => search._id.toString() !== searchId
      );
      await user.save();

      res.status(200).json({
        success: true,
        message: "Saved search deleted successfully",
        data: {
          savedSearches: user.savedSearches,
          total: user.savedSearches.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== execute saved search =========
  // GET /api/users/:id/saved-searches/:searchId/execute
  public executeSavedSearch = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id, searchId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Users can only execute their own saved searches
      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      const user = await User.findById(id);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const savedSearch = user.savedSearches.find(
        (search: any) => search._id.toString() === searchId
      );
      if (!savedSearch) {
        throw new AppError("Saved search not found", 404);
      }

      const filters = savedSearch.filters || {};
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query from saved filters
      const query: any = { status: "active" };

      if (filters.location) {
        query.$or = [
          { "address.city": new RegExp(filters.location, "i") },
          { "address.state": new RegExp(filters.location, "i") },
          { "address.zipCode": filters.location },
        ];
      }

      if (filters.priceRange) {
        query.price = {};
        if (filters.priceRange[0]) query.price.$gte = filters.priceRange[0];
        if (filters.priceRange[1]) query.price.$lte = filters.priceRange[1];
      }

      if (filters.propertyTypes?.length) {
        query.propertyType = { $in: filters.propertyTypes };
      }

      if (filters.bedrooms) {
        query.bedrooms = { $gte: filters.bedrooms };
      }

      if (filters.bathrooms) {
        query.bathrooms = { $gte: filters.bathrooms };
      }

      if (filters.squareFootage) {
        query.squareFootage = {};
        if (filters.squareFootage[0])
          query.squareFootage.$gte = filters.squareFootage[0];
        if (filters.squareFootage[1])
          query.squareFootage.$lte = filters.squareFootage[1];
      }

      // Sorting
      const sortOptions: any = {};
      sortOptions[filters.sortBy || "createdAt"] =
        filters.sortOrder === "asc" ? 1 : -1;

      const [properties, total] = await Promise.all([
        Property.find(query)
          .populate("listingAgent", "firstName lastName email phone")
          .populate("listingOffice", "name phone")
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Property.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        message: "Saved search executed successfully",
        data: {
          savedSearch: {
            _id: savedSearch._id,
            name: savedSearch.name,
            filters: savedSearch.filters,
          },
          properties,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ====================== update preferences =========
  // PUT /api/users/:id/preferences
  public updatePreferences = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      // Users can only update their own preferences
      if (req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      // Destructure request body
      const { propertyTypes, priceRange, locations, notifications } = req.body;

      // Build dynamic update object
      const updateData: Record<string, any> = {};
      if (propertyTypes)
        updateData["preferences.propertyTypes"] = propertyTypes;
      if (priceRange) updateData["preferences.priceRange"] = priceRange;
      if (locations) updateData["preferences.locations"] = locations;
      if (notifications !== undefined)
        updateData["preferences.notifications"] = notifications;

      // If no preferences provided
      if (Object.keys(updateData).length === 0) {
        throw new AppError("No valid preferences provided for update", 400);
      }

      // Update user
      const user = await User.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select("-password -passwordResetToken");

      if (!user) {
        throw new AppError("User not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Preferences updated successfully",
        data: {
          preferences: user.preferences,
        },
      });
    } catch (error) {
      console.error("Error updating preferences:", error);
      next(error);
    }
  };

  // ====================== get user activity =========
  // GET /api/users/:id/activity
  public getUserActivity = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const daysParam = req.query.days as string | undefined;
      const days = daysParam ? parseInt(daysParam, 10) : 30;

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid user ID", 400);
      }

      // Only admins or the user themselves can view activity
      if (req.user?.role !== "admin" && req.user?._id.toString() !== id) {
        throw new AppError("Insufficient permissions", 403);
      }

      // Fetch only required fields (lean improves perf)
      const user = await User.findById(id)
        .select("createdAt lastLogin savedSearches favoriteProperties")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // If you plan to filter activity by timeframe (e.g. last N days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Example: filter saved searches and favorites created within last N days
      const recentSavedSearches =
        user.savedSearches?.filter(
          (s: any) => s.createdAt && s.createdAt >= cutoffDate
        ) || [];

      const recentFavorites =
        user.favoriteProperties?.filter(
          (p: any) => p.addedAt && p.addedAt >= cutoffDate
        ) || [];

      const activity = {
        accountCreated: user.createdAt,
        lastLogin: user.lastLogin,
        totalSavedSearches: user.savedSearches?.length || 0,
        totalFavoriteProperties: user.favoriteProperties?.length || 0,
        recentSavedSearchesCount: recentSavedSearches.length,
        recentFavoritePropertiesCount: recentFavorites.length,
      };

      res.status(200).json({
        success: true,
        message: "User activity fetched successfully",
        data: activity,
      });
    } catch (error) {
      console.error("Error fetching user activity:", error);
      next(error);
    }
  };

  // ====================== forgot-password =========
  // POST /api/users/forgot-password
  public forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenHash = crypto
          .createHash("sha256")
          .update(resetToken)
          .digest("hex");

        // Store hashed token and expiry on user
        user.passwordResetToken = resetTokenHash;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
        await user.save({ validateBeforeSave: false });

        // Build reset URL
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        // Send email (stubbed here)
        // await sendPasswordResetEmail(user.email, resetUrl);

        if (process.env.NODE_ENV === "development") {
          console.log("Password reset link:", resetUrl);
        }
      }

      // Always return generic response (security best practice)
      res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent",
      });
    } catch (error) {
      console.error("Error in forgotPassword:", error);
      next(error);
    }
  };

  // ====================== reset-password =========
  // POST /api/users/reset-password
  public resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { token, newPassword } = req.body;

      // Hash the token for DB lookup
      const resetTokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // Find user with valid (unexpired) token
      const user = await User.findOne({
        passwordResetToken: resetTokenHash,
        passwordResetExpires: { $gt: Date.now() },
      });

      if (!user) {
        throw new AppError("Invalid or expired reset token", 400);
      }

      // Set new password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save(); // triggers pre-save hook to hash password

      // (Optional) Generate JWT so user doesn’t have to login again
      // const token = generateJwt(user._id);
      // res.cookie("jwt", token, { httpOnly: true, secure: true });

      res.status(200).json({
        success: true,
        message: "Password reset successfully",
        // token, // uncomment if you want auto-login
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      next(error);
    }
  };

  //   ================================================
  //    private helper method for fetching user data
  // =================================================
  private async fetchUserData(userId: string, withStats = false) {
    const user = await User.findById(userId)
      .select("-password -passwordResetToken")
      .populate(
        "agentId",
        "firstName lastName email phone office specialties profileImage"
      )
      .populate(
        "favoriteProperties",
        "title price address images propertyType bedrooms bathrooms"
      )
      .lean();

    if (!user) return null;

    if (withStats) {
      return {
        ...user,
        statistics: {
          savedSearchesCount: user.savedSearches?.length || 0,
          favoritePropertiesCount: user.favoriteProperties?.length || 0,
        },
      };
    }

    return user;
  }

  // user controller class ends
}
