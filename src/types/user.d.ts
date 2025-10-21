import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Backend type for SavedSearch subdocument
 */
export interface ISavedSearch {
  _id?: mongoose.Types.ObjectId; // created automatically by MongoDB
  name: string;
  filters: Record<string, any>; // can be refined to specific fields later
  emailAlerts: boolean;
  frequency: "daily" | "weekly" | "monthly";
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Backend type for User document
 */
export interface IUserDocument extends Document {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: "buyer" | "seller" | "agent" | "manager" | "admin";
  onboardingCompleted?: {
    buyer: boolean;
    seller: boolean;
    agent: boolean;
  };
  managerApplication?: {
    status: "none" | "pending" | "approved" | "rejected";
    officeId?: mongoose.Types.ObjectId;
    message?: string;
    appliedAt?: Date;
    approvedAt?: Date;
    notes?: string;
  };
  officeId?: mongoose.Types.ObjectId;
  agentVerificationStatus?: "none" | "pending" | "verified" | "rejected";
  isProfileComplete?: boolean;
  preferences?: {
    propertyTypes: string[];
    priceRange: [number, number];
    locations: string[];
    notifications: boolean;
  };
  savedSearches: ISavedSearch[];
  favoriteProperties: mongoose.Types.ObjectId[];
  agentId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  emailVerified?: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}
