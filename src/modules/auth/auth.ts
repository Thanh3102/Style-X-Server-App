export type EmployeeSignInDTO = {
  username: string;
  password: string;
  isRemember: boolean;
};

export type CustomerSignInDTO = {
  email: string;
  password: string;
};

export type RefreshTokenDTO = {
  accessToken: string;
  refreshToken: string;
};

export type CustomerSignUpDTO = {
  name: string;
  email: string;
  password: string;
  gender: string;
  dob: Date;
};

export type VerifySignInDTO = {
  otp: string;
  email: string;
}
