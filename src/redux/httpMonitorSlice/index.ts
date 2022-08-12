import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type {
  IAllHttpInfos,
  ITabMsgClusterItemInfo,
  ITabSuccessRateItemInfo,
  ITabTimeConsumeItemInfo,
} from '@/pages/HttpMonitor/type';
import type { InitialState } from './type';

const initialState: InitialState = {
  table: { records: [], current: 1, size: 0, total: 0 },
} as any;

export const httpMonitorSlice = createSlice({
  name: 'httpMonitor',
  initialState,
  reducers: {
    successRateStorage: (state, action: PayloadAction<Record<string, ITabSuccessRateItemInfo>>) => {
      state.successRate = action.payload;
    },
    msgClusterStorage: (state, action: PayloadAction<Record<string, ITabMsgClusterItemInfo>>) => {
      state.msgCluster = action.payload;
    },
    successTimeConsumeStorage: (state, action: PayloadAction<Record<string, ITabTimeConsumeItemInfo>>) => {
      state.successTimeConsume = action.payload;
    },
    failTimeConsumeStorage: (state, action: PayloadAction<Record<string, ITabTimeConsumeItemInfo>>) => {
      state.failTimeConsume = action.payload;
    },
    tableStorage: (state, action: PayloadAction<IAllHttpInfos>) => {
      state.table = action.payload;
    },
  },
});

export const {
  successRateStorage,
  msgClusterStorage,
  successTimeConsumeStorage,
  failTimeConsumeStorage,
  tableStorage,
} = httpMonitorSlice.actions;
export const selectCount = (state: RootState) => state.httpMonitor;
export default httpMonitorSlice.reducer;