import { NextFunction, Request, Response } from "express";
import { Property } from "../models/Property";
import { validationResult } from "express-validator";
import { AppError } from "../utils/AppError"; // optional centralized error util

interface AuthRequest extends Request {
  user?: any; // Adjust based on your user type
}
// ---------- Utility Helpers ----------

// Sanitize property creation/update fields
const extractPropertyFields = (body: any) => ({
  mlsNumber: body.mlsNumber,
  title: body.title,
  description: body.description,
  price: body.price,
  propertyType: body.propertyType,
  status: body.status || "active",
  bedrooms: body.bedrooms,
  bathrooms: body.bathrooms,
  squareFootage: body.squareFootage,
  lotSize: body.lotSize,
  yearBuilt: body.yearBuilt,
  address: body.address,
  virtualTour: body.virtualTour,
  amenities: body.amenities || [],
  features: body.features || [],
  images: body.images || [],
  openHouses: body.openHouses || [],
  listingAgent: body.listingAgent,
  listingOffice: body.listingOffice,
  seller: body.seller,
});

// Role-based access helper
const canManageProperty = (user: any, property: any): boolean => {
  if (user.role === "admin") return true;
  if (
    user.role === "manager" &&
    user.office?.toString() === property.listingOffice?.toString()
  )
    return true;
  if (
    user.role === "agent" &&
    user._id?.toString() === property.listingAgent?.toString()
  )
    return true;
  return false;
};

// ---------- Controller Class ----------
export class PropertyController {
  /** Public: Browse active properties (no auth required) */
  public browsePublicProperties = async (
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
        propertyType,
        minPrice,
        maxPrice,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const query: any = { status: "active" };

      // Filters
      if (city) query["address.city"] = new RegExp(city as string, "i");
      if (state) query["address.state"] = state;
      if (propertyType) query.propertyType = propertyType;
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseInt(minPrice as string);
        if (maxPrice) query.price.$lte = parseInt(maxPrice as string);
      }

      const [properties, total] = await Promise.all([
        Property.find(query)
          .populate("listingAgent", "firstName lastName")
          .populate("listingOffice", "name")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Property.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: properties,
        pagination: {
          page: pageNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
        },
      });
    } catch (error) {
      console.error("Error browsing public properties:", error);
      next(error);
    }
  };

  // ==========================================================
  //  COMMON PROPERTY ENDPOINTS (All Roles)
  // ==========================================================

  /** Get all properties (role-based filters applied) */
  public getProperties = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        page = 1,
        limit = 20,
        city,
        state,
        propertyType,
        minPrice,
        maxPrice,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const user = req.user;
      const query: any = { status: { $ne: "off-market" } };

      //  Role-based filtering
      if (user?.role === "agent") query.listingAgent = user._id;
      else if (user?.role === "manager") query.listingOffice = user.office;
      else if (user?.role === "seller") query.seller = user._id;

      //  Public filters
      if (city) query["address.city"] = new RegExp(city as string, "i");
      if (state) query["address.state"] = state;
      if (propertyType) query.propertyType = propertyType;
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseInt(minPrice as string);
        if (maxPrice) query.price.$lte = parseInt(maxPrice as string);
      }

      const [properties, total] = await Promise.all([
        Property.find(query)
          .populate("listingAgent", "firstName lastName")
          .populate("listingOffice", "name")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Property.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: properties,
        pagination: {
          page: pageNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
        },
      });
    } catch (error) {
      console.error("Error fetching properties:", error);
      next(error);
    }
  };

  /** Get a single property (public endpoint) */
  public getProperty = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const property = await Property.findById(id)
        .populate("listingAgent", "firstName lastName email bio")
        .populate("listingOffice", "name phone email address")
        .lean();

      if (!property)
        return res
          .status(404)
          .json({ success: false, message: "Property not found" });

      res.json({ success: true, data: property });
    } catch (error) {
      console.error("Error fetching property:", error);
      next(error);
    }
  };

  // ==========================================================
  //  ADMIN / MANAGER / AGENT ROUTES
  // ==========================================================

  /** Create a new property (Admin, Manager, Agent only) */
  public createProperty = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;
      if (!user) throw new AppError("Unauthorized", 401);
      if (!["admin", "manager", "agent"].includes(user.role))
        throw new AppError("Access denied", 403);

      const data = extractPropertyFields(req.body);

      // 🔸 Auto-assign listingAgent/listingOffice
      if (user.role === "agent") data.listingAgent = user._id;
      if (user.role === "manager" || user.role === "agent")
        data.listingOffice = user.office || data.listingOffice;

      const property = new Property(data);
      await property.save();

      const populated = await Property.findById(property._id)
        .populate("listingAgent", "firstName lastName email")
        .populate("listingOffice", "name phone");

      res.status(201).json({
        success: true,
        message: "Property created successfully",
        data: populated,
      });
    } catch (error) {
      console.error("Error creating property:", error);
      next(error);
    }
  };

  /** Update property (Admin, Manager, Agent who owns listing) */
  public updateProperty = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const user = req.user;
      if (!user) throw new AppError("Unauthorized", 401);

      const property = await Property.findById(id);
      if (!property) throw new AppError("Property not found", 404);

      if (!canManageProperty(user, property))
        throw new AppError("Access denied", 403);

      const updates = extractPropertyFields(req.body);
      Object.assign(property, updates);
      await property.save();

      const populated = await Property.findById(property._id)
        .populate("listingAgent", "firstName lastName email")
        .populate("listingOffice", "name phone");

      res.json({
        success: true,
        message: "Property updated successfully",
        data: populated,
      });
    } catch (error) {
      console.error("Error updating property:", error);
      next(error);
    }
  };

  /** Soft delete property (Admin, Manager, Agent) */
  public deleteProperty = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const user = req.user;
      if (!user) throw new AppError("Unauthorized", 401);

      const property = await Property.findById(id);
      if (!property) throw new AppError("Property not found", 404);

      if (!canManageProperty(user, property))
        throw new AppError("Access denied", 403);

      property.status = "off-market"; // Soft delete
      await property.save();

      res.json({ success: true, message: "Property deactivated successfully" });
    } catch (error) {
      console.error("Error deleting property:", error);
      next(error);
    }
  };

  // ==========================================================
  //  SELLER SUBMISSION FLOW
  // ==========================================================

  /** Seller submits property listing request */
  public submitProperty = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;
      if (!user) throw new AppError("Unauthorized", 401);
      if (user.role !== "seller") throw new AppError("Access denied", 403);

      const data = extractPropertyFields(req.body);
      data.seller = user._id;
      data.status = "pending"; // Seller-submitted, pending review
      data.listingAgent = null;
      data.listingOffice = null;

      const property = new Property(data);
      await property.save();

      res.status(201).json({
        success: true,
        message: "Property submitted for review",
        data: property,
      });
    } catch (error) {
      console.error("Error submitting property:", error);
      next(error);
    }
  };

  // ==========================================================
  //  ADMIN / AGENT / MANAGER APPROVAL FLOW
  // ==========================================================

  /** Assign seller-submitted property to an agent/office */
  public assignProperty = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { agentId, officeId } = req.body;
      const user = req.user;

      if (!user) throw new AppError("Unauthorized", 401);
      if (!["admin", "manager"].includes(user.role))
        throw new AppError("Access denied", 403);

      const property = await Property.findById(id);
      if (!property) throw new AppError("Property not found", 404);

      property.listingAgent = agentId;
      property.listingOffice = officeId || user.office;
      property.status = "active";

      await property.save();

      const populated = await Property.findById(id)
        .populate("listingAgent", "firstName lastName email")
        .populate("listingOffice", "name phone");

      res.json({
        success: true,
        message: "Property assigned and activated successfully",
        data: populated,
      });
    } catch (error) {
      console.error("Error assigning property:", error);
      next(error);
    }
  };
}
