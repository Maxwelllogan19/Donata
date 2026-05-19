/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum RentalStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ACTIVE = 'active',
  RETURNED = 'returned',
  CANCELLED = 'cancelled'
}

export interface Equipment {
  id?: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  unitPrice: number;
  totalStock: number;
  imageUrl?: string;
}

export interface RentalItem {
  equipmentId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Rental {
  id?: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  startDate: string; // ISO String
  endDate: string;   // ISO String
  items: RentalItem[];
  discount: number;
  deliveryFee: number;
  subtotal: number;
  totalAmount: number;
  status: RentalStatus;
  createdAt: string;
  updatedAt: string;
}
