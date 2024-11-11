export type EmployeeSignInDTO = {
  username: string;
  password: string;
  isRemember: boolean;
};

export type RefreshTokenDTO = {
  accessToken: string;
  refreshToken: string;
};
