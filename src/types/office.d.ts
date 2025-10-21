import { Document, Types } from "mongoose";

export interface IOfficeAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IOfficeHours {
  day:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  open: string; // "09:00"
  close: string; // "17:00"
  isClosed?: boolean;
}

export interface ISocialMedia {
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  youtube?: string;
  website?: string;
}

export interface IAward {
  name: string;
  year: number;
  organization: string;
  description?: string;
}

export interface ICertification {
  name: string;
  issuedBy: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId?: string;
}

export interface IImage {
  url: string;
  alt: string;
  type: "exterior" | "interior" | "lobby" | "conference-room" | "team-photo";
  isPrimary?: boolean;
  order?: number;
}

export interface IMarketArea {
  name: string;
  zipCodes?: string[];
  cities?: string[];
  counties?: string[];
}

export interface IStatistics {
  totalAgents: number;
  activeListings: number;
  soldThisYear: number;
  totalVolume: number;
  averageSalePrice: number;
  averageDaysOnMarket: number;
  lastUpdated: Date;
}

export interface IContact {
  primaryContact: {
    name: string;
    title: string;
    phone: string;
    email: string;
    extension?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

export interface ISettings {
  displayOnWebsite: boolean;
  allowOnlineAppointments: boolean;
  autoAssignLeads: boolean;
  requireAppointments: boolean;
  timezone: string;
}

export interface IMetadata {
  mlsRegion?: string;
  mlsId?: string;
  boardAffiliations?: string[];
  licenseNumbers?: {
    type: string; // 'broker', 'real-estate', etc.
    number: string;
    state: string;
    expiryDate?: Date;
  }[];
}

export interface IOffice extends Document {
  name: string;
  franchiseId: string;
  address: IOfficeAddress;
  phone: string;
  fax?: string;
  email: string;
  website?: string;
  manager: Types.ObjectId;
  assistantManager?: Types.ObjectId;
  agents: Types.ObjectId[];
  description: string;
  specialties: string[];
  services: string[];
  languages: string[];
  awards: IAward[];
  certifications: ICertification[];
  officeHours: IOfficeHours[];
  socialMedia?: ISocialMedia;
  images?: IImage[];
  marketAreas?: IMarketArea[];
  statistics: IStatistics;
  contact: IContact;
  settings: ISettings;
  metadata?: IMetadata;
  isActive: boolean;
  isPremium?: boolean;
  establishedDate: Date;
  lastActivityDate?: Date;
  deletedAt?: Date;

  // Virtuals
  fullAddress?: string;
  agentCount?: number;
  currentStatus?: {
    isOpen: boolean;
    status: "open" | "closed";
    message: string;
  };

  // Instance methods
  addAgent(agentId: string): Promise<IOffice>;
  removeAgent(agentId: string): Promise<IOffice>;
  updateStatistics(stats: Partial<IStatistics>): Promise<IOffice>;
  isOpenNow(): boolean;
}
