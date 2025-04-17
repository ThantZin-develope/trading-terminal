import {
  AreaData,
  BarData,
  CandlestickData,
  LineData,
  SeriesType,
} from "lightweight-charts";
import { TradingHostImpl } from "../components/TradingTerminal";

export interface SymbolInfo {
  symbolId: string | any;
  ticker: string;
  name: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  // minmov: 1,
  // pricescale: 100,
  // has_intraday: false,
  // visible_plots_set: 'ohlcv',
  // has_weekly_and_monthly: false,
  // supported_resolutions: ['1', '5', '30', '60', '1D', '1W'],
  // volume_precision: 2,
  // data_status: 'streaming',
}

export enum Side {
  BUY = "buy",
  SELL = "sell",
}

export enum OrderStatus {
  ACTIVE = "active",
  FILLED = "filled",
  CLOSED = "closed",
}

export interface Order {
  orderId?: string;
  symbol: string;
  quantity: number;
  side: Side;
  orderType: OrderType;
  currentQuote: { bid: number; ask: number };
  executedPrice?: number;
  limitPrice?: number;
  stopPrice?: number;
  sl?: number;
  tp?: number;
  opentime: number;
  closetime?: number;
  status?: OrderStatus;
}

export interface Position{
  positionId : string,
  symbol: string,
  quantity: number,
  side: Side,
  price: number,
  profit?: number,
  sl?: number;
  tp?: number;
}

export enum OrderType {
  LIMIT = "limit",
  MARKET = "market",
  STOP = "stop",
}

export interface Account {
  accountId: string;
  name: string;
  balance: number;
  equity: number;
  currency?: string;
}

export type SeriesData = BarData | CandlestickData | LineData | AreaData;

export interface DataFeedAPI {
  // Get bars data of a symbol from backend server
  getBars: (
    symbolId: string,
    resolution: Resolution,
    type: SeriesType
  ) => Promise<SeriesData[]>;
  // Subscribe bars data from backend server for real time data display. Should call whenever symbol change.
  subscribeBars: (
    symbolId: string,
    type: SeriesType,
    onRealtimeCallback: (data: SeriesData) => void,
    subscriptionId: string
  ) => Promise<void>;
  // Unscribe bars data from backend server. Should call whenever symbol change.
  unSubscribeBars: (subscriptionId: string) => Promise<void>;
  // Get symbol info
  getSymbolInfo: (symbolId: string) => Promise<SymbolInfo>;
  subScribeQutoe: (
    symbolId: string,
    onQuoteCallback: (data: {
      bidAsk: { bid: number; ask: number };
      olhc: { open: number; low: number; high: number; close: number };
    }) => void,
    subscriptionId: string
  ) => Promise<void>;
  unSubscribeQuote: (subscriptionId: string) => Promise<void>;

  getSymbolsList: () => Promise<SymbolInfo[]>;
}

export interface BrokerAPI {
  // tradingHost: TradingHostImpl;

  // Post order creation request to backend server
  placeOrder: (accountId: string, order: Order) => Promise<void>;

  // Query orders list of an account from backend server
  getOrders: (accountId: string) => Promise<Order[]>;

  // Post order cancel request to backend server
  cancelOrder: (accountId: string, orderId: string) => Promise<void>;
  // Update existing order request to backend server
  orderUpdate: (accountId: string, updatedOrder: Order) => Promise<void>;

  // // Account update listener from backend server. Should call accountUpdae
  // accountUpdate: (account: Account) => Promise<void>

  // Get account info from backend server
  getAccountsInfo: () => Promise<Account[]>;

  // Return current activated account
  getCurrentAccount: () => Promise<Account>;

  getPositions: (accountId : string) => Promise<Position[]>
  
}

// I kkep focusing on functionalities
// I am trying to provide another componenet today, independent
// Indepedent means, library consumer can styled posisiton withouot
// export interface Configuration {
//   theme?: Theme;
//   chartType: SeriesType;
// }
export interface SystemManagerProps {
  theme?: Theme;
  brokerAPI: BrokerAPI;
  dataFeedAPI: DataFeedAPI;
  tradingHost: TradingHostImpl;
}

export interface Resolution {
  range: string;
  interval: string;
}

export interface Theme {
  textColor: string;
  buttonTheme: {
    backgroundColor: string;
    textColor: string;
  };
  background: string;
}
