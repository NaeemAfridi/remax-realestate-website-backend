import mongoose, { Schema } from "mongoose";
import { IAgent } from "../types/agent";

// ---------- Agent Schema ----------
const AgentSchema = new Schema<IAgent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Link to User
    profileImage: { type: String },
    bio: { type: String, required: true },
    specialties: [{ type: String }],
    languages: [{ type: String }],
    office: { type: Schema.Types.ObjectId, ref: "Office", required: true },
    licenseNumber: { type: String, required: true },
    licenseState: { type: String },
    licenseExpiration: { type: Date },
    yearsExperience: { type: Number, default: 0 },
    socialMedia: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String,
    },
    isActive: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
AgentSchema.index({ office: 1, isActive: 1 });
AgentSchema.index({ specialties: 1 });

// ---------- Model ----------
export const Agent = mongoose.model<IAgent>("Agent", AgentSchema);
