export interface Availability {
  slot: AvailabilitySlot;
  openingHours: AvailabilitySlot;
  hub?: {
    isDefault: boolean;
    neighbourhood: string;
  };
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface Availabilities {
  name: string;
  date: string;
  slots: AvailabilitySlotDetails[];
}

export interface AvailabilitySlotDetails {
  count: number;
  start: string;
  end: string;
  openingHourSlot: boolean;
  deliveryPickupSlot: boolean;
  price: number;
  closed: boolean;
  holiday: boolean;
  available?: boolean;
  extensionPeriod?: number;
  extensionPrice?: number;
}
