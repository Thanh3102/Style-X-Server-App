import { Injectable } from '@nestjs/common';
import {
  DateFilterOptionValue,
  QueryParams,
} from 'src/utils/types/query.types';
import { transformCreatedOnParams } from 'src/utils/helper/DateHelper';

export type ReportDateRange = {
  startDate: Date;
  endDate: Date;
};

type ReportDateRangeOptions = {
  defaultToToday?: boolean;
};

@Injectable()
export class ReportDateRangeService {
  resolve(
    params: QueryParams,
    options: ReportDateRangeOptions = {}
  ): ReportDateRange {
    const reportDate =
      params.reportDate ||
      (options.defaultToToday ? DateFilterOptionValue.TODAY : undefined);

    return transformCreatedOnParams(
      reportDate,
      params.reportDateMin,
      params.reportDateMax
    );
  }
}
