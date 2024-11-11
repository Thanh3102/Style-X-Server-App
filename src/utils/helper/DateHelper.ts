import { DateFilterOptionValue } from '../types';

export const isStringDate = (string: string) => {
  const date = new Date(string);
  return !isNaN(date.getTime());
};

export const getToday = () => {
  return new Date();
};

export const getPreviousDay = (numberOfDay: number) => {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - numberOfDay);
  return startDate;
};

export const getLastWeekStartEnd = () => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() - 7 + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return {
    start: startOfWeek,
    end: endOfWeek,
  };
};

export const getThisWeekStartEnd = () => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return {
    start: startOfWeek,
    end: endOfWeek,
  };
};

export const getLastMonthStartEnd = () => {
  const today = new Date();

  const firstDayOfCurrentMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    1,
  );

  // Tính ngày đầu tiên của tháng trước
  const firstDayOfLastMonth = new Date(firstDayOfCurrentMonth);
  firstDayOfLastMonth.setMonth(firstDayOfCurrentMonth.getMonth() - 1);

  // Tính ngày cuối cùng của tháng trước
  const lastDayOfLastMonth = new Date(firstDayOfCurrentMonth);
  lastDayOfLastMonth.setDate(firstDayOfCurrentMonth.getDate() - 1);

  return {
    start: firstDayOfLastMonth,
    end: lastDayOfLastMonth,
  };
};

export const getThisMonthStartEnd = () => {
  // Lấy ngày hôm nay
  const today = new Date();

  // Tính ngày đầu tiên của tháng hiện tại
  const firstDayOfCurrentMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    1,
  );

  // Tính ngày cuối cùng của tháng hiện tại
  const lastDayOfCurrentMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  );

  return {
    start: firstDayOfCurrentMonth,
    end: lastDayOfCurrentMonth,
  };
};

export const getLastYearStartEnd = () => {
  const today = new Date();
  const lastYear = today.getFullYear() - 1;

  // Tính ngày đầu tiên của năm trước
  const startOfLastYear = new Date(lastYear, 0, 1);

  // Tính ngày cuối cùng của năm trước
  const endOfLastYear = new Date(lastYear, 11, 31);

  return {
    start: startOfLastYear,
    end: endOfLastYear,
  };
};

export const getThisYearStartEnd = () => {
  // Lấy năm hiện tại
  const today = new Date();
  const currentYear = today.getFullYear();

  // Tính ngày đầu tiên của năm hiện tại
  const startOfCurrentYear = new Date(currentYear, 0, 1);

  // Tính ngày cuối cùng của năm hiện tại
  const endOfCurrentYear = new Date(currentYear, 11, 31);

  return {
    start: startOfCurrentYear,
    end: endOfCurrentYear,
  };
};

export const convertParamsToCondition = (createdOn: string) => {
  switch (createdOn) {
    case DateFilterOptionValue.TODAY:
      return {
        createdAt: {
          gte: new Date(getToday().setHours(0, 0, 0)),
          lte: new Date(getToday().setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.YESTERDAY:
      return {
        createdAt: {
          gte: new Date(getPreviousDay(1).setHours(0, 0, 0)),
          lte: new Date(getPreviousDay(1).setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.DAY_LAST_7:
      return {
        createdAt: {
          gte: new Date(getPreviousDay(7).setHours(0, 0, 0)),
          lte: new Date(getToday().setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.DAY_LAST_30:
      return {
        createdAt: {
          gte: new Date(getPreviousDay(30).setHours(0, 0, 0)),
          lte: new Date(getToday().setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.THIS_WEEK:
      const thisWeek = getThisWeekStartEnd();
      return {
        createdAt: {
          gte: new Date(thisWeek.start.setHours(0, 0, 0)),
          lte: new Date(thisWeek.end.setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.LAST_WEEK:
      const lastWeek = getLastWeekStartEnd();
      return {
        createdAt: {
          gte: new Date(lastWeek.start.setHours(0, 0, 0)),
          lte: new Date(lastWeek.end.setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.THIS_MONTH:
      const thisMonth = getThisMonthStartEnd();
      return {
        createdAt: {
          gte: new Date(thisMonth.start.setHours(0, 0, 0)),
          lte: new Date(thisMonth.end.setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.LAST_MONTH:
      const lastMonth = getLastMonthStartEnd();
      return {
        createdAt: {
          gte: new Date(lastMonth.start.setHours(0, 0, 0)),
          lte: new Date(lastMonth.end.setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.THIS_YEAR:
      const thisYear = getThisYearStartEnd();
      return {
        createdAt: {
          gte: new Date(thisYear.start.setHours(0, 0, 0)),
          lte: new Date(thisYear.end.setHours(23, 59, 59)),
        },
      };

    case DateFilterOptionValue.LAST_YEAR:
      const lastYear = getLastYearStartEnd();
      return {
        createdAt: {
          gte: new Date(lastYear.start.setHours(0, 0, 0)),
          lte: new Date(lastYear.end.setHours(23, 59, 59)),
        },
      };
    
      default:
      return {
        createdAt: {
          gte: new Date(getToday().setHours(0, 0, 0)),
          lte: new Date(getToday().setHours(23, 59, 59)),
        },
      };
  }
};