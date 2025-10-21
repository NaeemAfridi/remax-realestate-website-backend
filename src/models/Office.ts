// packages/backend/src/models/Office.ts
import mongoose, { Schema, Document } from "mongoose";
import { IOffice } from "../types/office";

const OfficeAddressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true, index: true },
  state: { type: String, required: true, index: true },
  zipCode: { type: String, required: true, index: true },
  coordinates: {
    type: [Number], // [longitude, latitude]
    index: "2dsphere",
    validate: {
      validator: function (v: number[]) {
        return v && v.length === 2;
      },
      message: "Coordinates must be an array of [longitude, latitude]",
    },
  },
});

const OfficeHoursSchema = new Schema({
  day: {
    type: String,
    enum: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ],
    required: true,
  },
  open: { type: String, required: true }, // Format: "09:00"
  close: { type: String, required: true }, // Format: "17:00"
  isClosed: { type: Boolean, default: false },
});

const SocialMediaSchema = new Schema({
  facebook: { type: String },
  twitter: { type: String },
  linkedin: { type: String },
  instagram: { type: String },
  youtube: { type: String },
  website: { type: String },
});

const OfficeSchema = new Schema<IOffice>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: "text",
    },
    franchiseId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    address: {
      type: OfficeAddressSchema,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    fax: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    website: {
      type: String,
    },
    manager: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    assistantManager: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
    },
    agents: [
      {
        type: Schema.Types.ObjectId,
        ref: "Agent",
      },
    ],
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    specialties: [
      {
        type: String,
        enum: [
          "residential",
          "commercial",
          "luxury",
          "investment",
          "new-construction",
          "relocation",
          "first-time-buyers",
          "senior-living",
          "foreclosures",
          "short-sales",
          "land",
          "vacation-homes",
          "rental-properties",
        ],
        index: true,
      },
    ],
    services: [
      {
        type: String,
        enum: [
          "property-management",
          "home-staging",
          "interior-design",
          "mortgage-services",
          "title-services",
          "home-insurance",
          "moving-services",
          "home-inspection",
          "appraisal-services",
          "property-maintenance",
          "investment-analysis",
          "market-analysis",
          "virtual-tours",
          "professional-photography",
          "marketing-services",
        ],
      },
    ],
    languages: [
      {
        type: String,
        lowercase: true,
      },
    ],
    awards: [
      {
        name: { type: String, required: true },
        year: { type: Number, required: true },
        organization: { type: String, required: true },
        description: String,
      },
    ],
    certifications: [
      {
        name: { type: String, required: true },
        issuedBy: { type: String, required: true },
        issueDate: { type: Date, required: true },
        expiryDate: Date,
        credentialId: String,
      },
    ],
    officeHours: {
      type: [OfficeHoursSchema],
      default: [
        { day: "monday", open: "09:00", close: "17:00" },
        { day: "tuesday", open: "09:00", close: "17:00" },
        { day: "wednesday", open: "09:00", close: "17:00" },
        { day: "thursday", open: "09:00", close: "17:00" },
        { day: "friday", open: "09:00", close: "17:00" },
        { day: "saturday", isClosed: true, open: "00:00", close: "00:00" },
        { day: "sunday", isClosed: true, open: "00:00", close: "00:00" },
      ],
    },
    socialMedia: SocialMediaSchema,
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, required: true },
        type: {
          type: String,
          enum: [
            "exterior",
            "interior",
            "lobby",
            "conference-room",
            "team-photo",
          ],
          required: true,
        },
        isPrimary: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
      },
    ],
    marketAreas: [
      {
        name: { type: String, required: true },
        zipCodes: [String],
        cities: [String],
        counties: [String],
      },
    ],
    statistics: {
      totalAgents: { type: Number, default: 0 },
      activeListings: { type: Number, default: 0 },
      soldThisYear: { type: Number, default: 0 },
      totalVolume: { type: Number, default: 0 }, // Dollar amount
      averageSalePrice: { type: Number, default: 0 },
      averageDaysOnMarket: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now },
    },
    contact: {
      primaryContact: {
        name: { type: String, required: true },
        title: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, required: true, lowercase: true },
        extension: String,
      },
      emergencyContact: {
        name: String,
        phone: String,
        email: { type: String, lowercase: true },
      },
    },
    settings: {
      displayOnWebsite: { type: Boolean, default: true },
      allowOnlineAppointments: { type: Boolean, default: true },
      autoAssignLeads: { type: Boolean, default: false },
      requireAppointments: { type: Boolean, default: false },
      timezone: {
        type: String,
        default: "America/New_York",
      },
    },
    metadata: {
      mlsRegion: String,
      mlsId: String,
      boardAffiliations: [String],
      licenseNumbers: [
        {
          type: { type: String, required: true }, // 'broker', 'real-estate'
          number: { type: String, required: true },
          state: { type: String, required: true },
          expiryDate: Date,
        },
      ],
    },
    isActive: { type: Boolean, default: true, index: true },
    isPremium: { type: Boolean, default: false },
    establishedDate: { type: Date, required: true },
    lastActivityDate: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // Remove sensitive information
        delete (ret as any).__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual for full address
OfficeSchema.virtual("fullAddress").get(function () {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Virtual for agent count
OfficeSchema.virtual("agentCount").get(function () {
  return this.agents ? this.agents.length : 0;
});

// Virtual for current office hours
OfficeSchema.virtual("currentStatus").get(function () {
  const now = new Date();
  const currentDay = now
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  const todayHours = this.officeHours?.find((h: any) => h.day === currentDay);

  if (!todayHours || todayHours.isClosed) {
    return { isOpen: false, status: "closed", message: "Closed today" };
  }

  const isOpen =
    currentTime >= todayHours.open && currentTime <= todayHours.close;

  return {
    isOpen,
    status: isOpen ? "open" : "closed",
    message: isOpen
      ? `Open until ${todayHours.close}`
      : `Opens at ${todayHours.open}`,
  };
});

// Indexes for optimal query performance
OfficeSchema.index({ "address.coordinates": "2dsphere" });
OfficeSchema.index({ name: "text", specialties: "text" });
OfficeSchema.index({ isActive: 1, "address.city": 1, "address.state": 1 });
OfficeSchema.index({ manager: 1, isActive: 1 });
OfficeSchema.index({ specialties: 1, isActive: 1 });
OfficeSchema.index({ isPremium: 1, isActive: 1 });
OfficeSchema.index({ franchiseId: 1 }, { unique: true });

// Pre-save middleware to update statistics
OfficeSchema.pre("save", function (next) {
  if (this.isModified("agents")) {
    this.statistics.totalAgents = this.agents.length;
  }
  next();
});

// Static methods
OfficeSchema.statics.findByLocation = function (
  coordinates: [number, number],
  maxDistance: number = 10000 // meters
) {
  return this.find({
    "address.coordinates": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: coordinates,
        },
        $maxDistance: maxDistance,
      },
    },
    isActive: true,
  }).populate("manager", "firstName lastName email phone");
};

OfficeSchema.statics.findBySpecialty = function (specialty: string) {
  return this.find({
    specialties: specialty,
    isActive: true,
  }).populate("manager agents", "firstName lastName email phone specialties");
};

// Instance methods
OfficeSchema.methods.addAgent = function (agentId: string) {
  if (!this.agents.includes(agentId)) {
    this.agents.push(agentId);
    this.statistics.totalAgents = this.agents.length;
  }
  return this.save();
};

OfficeSchema.methods.removeAgent = function (agentId: string) {
  this.agents = this.agents.filter((id: any) => id.toString() !== agentId);
  this.statistics.totalAgents = this.agents.length;
  return this.save();
};

OfficeSchema.methods.updateStatistics = function (stats: Partial<any>) {
  this.statistics = { ...this.statistics, ...stats, lastUpdated: new Date() };
  return this.save();
};

OfficeSchema.methods.isOpenNow = function (): boolean {
  const now = new Date();
  const currentDay = now
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5);

  const todayHours = this.officeHours?.find((h: any) => h.day === currentDay);

  if (!todayHours || todayHours.isClosed) {
    return false;
  }

  return currentTime >= todayHours.open && currentTime <= todayHours.close;
};

export const Office = mongoose.model<IOffice & Document>(
  "Office",
  OfficeSchema
);
