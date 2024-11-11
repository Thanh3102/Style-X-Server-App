import * as bcrypt from 'bcrypt';
const salt = 10;

export const hashPlainText = async (plainText: string) => {
  const hash = await bcrypt.hash(plainText, salt);
  return hash;
};

export const comparePassword = async (
  password: string,
  hashPassword: string,
) => {
  const isCorrect = await bcrypt.compare(password, hashPassword);
  return isCorrect;
};

