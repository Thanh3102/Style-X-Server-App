export enum FilterParam {
  CREATED_ON = 'createdOn',
  CREATED_ON_MIN = 'createdOnMin',
  CREATED_ON_MAX = 'createdOnMax',
  PAGE = 'page',
  LIMIT = 'limit',
  QUERY = 'query',
  TAG_TYPE = 'tagType',
  ASSIGN_IDS = 'assignIds'
}

export type QueryParams = Partial<Record<FilterParam, string>>;

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
