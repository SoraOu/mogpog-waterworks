export type LineStatus =
  | 'Operational'
  | 'Disconnected'
  | 'No Occupant'
  | 'Temporary Closed'
  | 'Pending Verification'
  | 'High Consumption';
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
  /**
   * The previous reading to use for the CURRENT month: the latest earlier
   * month's present reading, or the opening reading when there is none.
   * For any other month use getPreviousReading(accountId, month).
   */
  previousReading: number | null;
  /** The stored opening reading (accounts.previous_reading). Editable on the account screen. */
  openingReading: number | null;
  /** Free-text remarks for the account (REMARKS column of the official workbook). */
  remarks: string | null;
  currentMonthStatus: StatusColor; // derived
}

export interface Reading {
  id: number;
  accountId: number;
  month: string; // YYYY-MM
  previousReading: number | null; // derived from the earlier month when saved; kept in step by the db layer
  presentReading: number | null;
  consumption: number | null;
  /** Amount billed for this reading (PHP), saved with the reading. Null when there is nothing to bill. */
  amount: number | null;
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
