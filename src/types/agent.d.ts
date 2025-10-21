import mongoose, { Schema, Document, Types } from "mongoose";

// ---------- Agent Type ----------
export interface IAgent extends Document {
  userId: Types.ObjectId; // Link to User
  profileImage?: string;
  bio: string;
  specialties?: string[];
  languages?: string[];
  office: Types.ObjectId;
  licenseNumber: string;
  licenseState?: string;
  licenseExpiration?: Date;
  yearsExperience?: number;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  isActive?: boolean;

  // Virtual field
  fullName?: string;
}
