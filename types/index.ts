export type LineStatus = 'Operational' | 'Disconnected' | 'No Occupant' | 'Temporary Closed';
export type MeterStatus = 'In-service' | 'Blurred';
export type AccountType = 'Residential' | 'Commercial';
export type ReadingRemark =
  | 'No issue'
  | 'Blurred meter'
  | 'No occupant'
  | 'High consumption'
  | 'No reading';

export type StatusColor = 'green' | 'orange' | 'red' | 'gray';

export interface Barangay {
  id: number;
  name: string;
  totalAccounts: number;
  doneCount: number;
  issueCount: number;
  pendingCount: number;
}

export interface Account {
  id: number;
  barangayId: number;
  barangayName: string;
  subscriberName: string;
  type: AccountType;
  lineStatus: LineStatus;
  meterStatus: MeterStatus;
  yearLastPayment: string | null;
  monthLastPayment: string | null;
  remainingBalance: number | null;
  previousReading: number | null;
  currentMonthStatus: StatusColor; // derived
}

export interface Reading {
  id: number;
  accountId: number;
  month: string; // YYYY-MM
  previousReading: number | null;
  presentReading: number | null;
  consumption: number | null;
  remark: ReadingRemark | null;
  notes: string | null;
  recordedBy: string | null;
  dateRecorded: string | null; // ISO timestamp
}

export interface ImportLog {
  id: number;
  filename: string;
  importedAt: string;
  accountsLoaded: number;
}
