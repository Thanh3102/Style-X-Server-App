export type PaginationData = {
  total: number;
  count: number;
  page: number;
  limit: number;
};

export enum DateFilterOptionValue {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  DAY_LAST_7 = 'day_last_7',
  DAY_LAST_30 = 'day_last_30',
  LAST_WEEK = 'last_week',
  THIS_WEEK = 'this_week',
  LAST_MONTH = 'last_month',
  THIS_MONTH = 'this_month',
  LAST_YEAR = 'last_year',
  THIS_YEAR = 'this_year',
  OPTION = 'date_option',
}

export type { AuthenticatedRequest, RequestActor } from './request.types';
