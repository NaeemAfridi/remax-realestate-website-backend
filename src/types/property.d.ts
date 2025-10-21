import mongoose, { Schema, Document, Types } from "mongoose";

// ---------- Subdocument Types ----------
export interface IPropertyImage {
  url: string;
  alt: string;
  isPrimary?: boolean;
  order?: number;
}

export interface IOpenHouse {
  startDateTime: Date;
  endDateTime: Date;
  description?: string;
}

// ---------- Main Property Type ----------
export interface IProperty extends Document {
  mlsNumber: string;
  title: string;
  description: string;
  price: number;
  propertyType: "house" | "condo" | "townhouse" | "land" | "commercial";
  status: "active" | "pending" | "sold" | "off-market";
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize?: number;
  yearBuilt?: number;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates?: [number, number]; // [lng, lat]
  };
  images: IPropertyImage[];
  virtualTour?: string;
  amenities?: string[];
  features?: string[];
  listingAgent: Types.ObjectId;
  listingOffice: Types.ObjectId;
  seller: Types.ObjectId;
  openHouses?: IOpenHouse[];
}
