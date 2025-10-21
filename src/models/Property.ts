import mongoose, { Schema } from "mongoose";
import { IOpenHouse, IProperty, IPropertyImage } from "../types/property";

// ---------- Sub Schemas ----------
const PropertyImageSchema = new Schema<IPropertyImage>({
  url: { type: String, required: true },
  alt: { type: String, required: true },
  isPrimary: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
});

const OpenHouseSchema = new Schema<IOpenHouse>({
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  description: { type: String },
});

// ---------- Main Schema ----------
const PropertySchema = new Schema<IProperty>(
  {
    mlsNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, index: true },
    propertyType: {
      type: String,
      enum: ["house", "condo", "townhouse", "land", "commercial"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "pending", "sold", "off-market"],
      default: "active",
      index: true,
    },
    bedrooms: { type: Number, required: true, index: true },
    bathrooms: { type: Number, required: true, index: true },
    squareFootage: { type: Number, required: true, index: true },
    lotSize: { type: Number },
    yearBuilt: { type: Number, index: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true, index: true },
      state: { type: String, required: true, index: true },
      zipCode: { type: String, required: true, index: true },
      coordinates: {
        type: [Number],
        index: "2dsphere",
      },
    },
    images: [PropertyImageSchema],
    virtualTour: { type: String },
    amenities: [{ type: String, index: true }],
    features: [{ type: String, index: true }],
    listingAgent: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },
    listingOffice: {
      type: Schema.Types.ObjectId,
      ref: "Office",
      required: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    openHouses: [OpenHouseSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------- Indexes ----------
PropertySchema.index({ price: 1, status: 1 });
PropertySchema.index({ "address.city": 1, "address.state": 1 });
PropertySchema.index({ propertyType: 1, bedrooms: 1, bathrooms: 1 });
PropertySchema.index({ createdAt: -1 });

// ---------- Model ----------
export const Property = mongoose.model<IProperty>("Property", PropertySchema);
