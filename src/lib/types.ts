export type CodeStatus = "valid" | "scanned" | "flagged";

export type ScanResult = "genuine" | "already_used" | "invalid";

export type ManufacturerRole = "owner" | "admin";

export interface ManufacturerDoc {
  name: string;
  email: string;
  role: ManufacturerRole;
  /** uid of the owner account this member belongs to (own uid for owners). */
  ownerId: string;
  active: boolean;
  createdAt: number;
  createdBy?: string;
  updatedAt?: number;
}

export interface ProductStats {
  totalCodes: number;
  genuineScans: number;
  repeatScans: number;
  invalidAttempts: number;
}

export interface ProductDoc {
  /** uid of the owning manufacturer account (ownerId, not the member uid). */
  manufacturerId: string;
  createdBy?: string;
  name: string;
  prefix: string; // e.g. "ML" for Milo
  createdAt: number;
  stats: ProductStats;
  weeklyScans: Record<string, number>; // key: "2026-W46" (ISO week), value: scan count
  /** Set when the owner asks for deletion. The product then sits in a 48 hour grace period. */
  deletionScheduledAt?: number;
  /** Timestamp of the permanent delete. Cleared again if the owner restores the product. */
  purgeAt?: number;
  /** uid of the member who scheduled the deletion. */
  deletedBy?: string;
}

export interface BatchDoc {
  productId: string;
  /** uid of the owning manufacturer account (the product's manufacturerId). */
  manufacturerId: string;
  /** Searchable display name, e.g. "Milo 2026-11-16 03:12". */
  name: string;
  /** Lower-cased copy of `name`, used for prefix range queries in search. */
  nameLower: string;
  productName: string;
  quantity: number;
  createdAt: number;
  createdBy?: string;
}

export interface CodeDoc {
  batchId: string;
  productId: string;
  productName: string;
  prefix: string;
  status: CodeStatus;
  scanCount: number;
  firstScannedAt?: number;
  createdAt: number;
  url: string;
}

export interface ScanLogDoc {
  code: string;
  productId?: string;
  batchId?: string;
  scannedAt: number;
  result: ScanResult;
  ipAddress: string;
  userAgent?: string;
  location?: string; // optional, not populated in this version
}
