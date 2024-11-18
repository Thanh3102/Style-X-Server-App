export const convertToNumber = (
  string: number | string | undefined,
): number | undefined => {
  if (string === undefined) {
    return undefined;
  }

  const num = typeof string === 'number' ? string : parseFloat(string);

  return isNaN(num) ? undefined : num;
};

export const isNumber = (str: string) => {
  return typeof Number(str) === 'number' ? true : false;
};

export const isInteger = (str: string | undefined) => {
  if (!str) return false;
  const num = parseInt(str, 10);
  return !isNaN(num) && Number.isInteger(num) && String(num) === str;
};
