import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";
import { ISavedSearch, IUserDocument } from "../types/user";

// SavedSearch subdocument schema
const SavedSearchSchema = new Schema<ISavedSearch>(
  {
    name: { type: String, required: true },
    filters: { type: Schema.Types.Mixed, required: true },
    emailAlerts: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "weekly",
    },
  },
  { timestamps: true }
);

const UserSchema = new Schema<IUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    role: {
      type: String,
      enum: ["buyer", "seller", "agent", "manager", "admin"],
      default: "buyer",
    },

    // Onboarding Status
    onboardingCompleted: {
      buyer: { type: Boolean, default: false },
      seller: { type: Boolean, default: false },
      agent: { type: Boolean, default: false },
    },

    // Agent/Manager Specific
    managerApplication: {
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
      },
      officeId: { type: Schema.Types.ObjectId, ref: "Office" },
      message: { type: String },
      appliedAt: { type: Date },
      approvedAt: { type: Date },
      notes: { type: String },
    },
    officeId: { type: Schema.Types.ObjectId, ref: "Office" },

    // User Preferences
    preferences: {
      propertyTypes: [String],
      priceRange: {
        type: [Number],
        default: [0, 1000000],
      },
      locations: [String],
      notifications: { type: Boolean, default: true },
    },
    savedSearches: [SavedSearchSchema],
    favoriteProperties: [{ type: Schema.Types.ObjectId, ref: "Property" }],
    agentId: { type: Schema.Types.ObjectId, ref: "Agent" },
    agentVerificationStatus: {
      type: String,
      enum: ["none", "pending", "verified", "rejected"],
      default: "none",
    },
    lastLogin: Date,

    // Profile Status
    isProfileComplete: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        return ret;
      },
    },
  }
);

// Hash password before saving
UserSchema.pre<IUserDocument>("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(this.password, salt);
    this.password = hashed;
    next();
  } catch (error) {
    next(error as any);
  }
});

// Compare password instance method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>(
  "User",
  UserSchema
);
