import { RequestActor } from 'src/utils/types';

export type JWTPayload = RequestActor;

export type JWTToken = {
  accessToken: string;
  refreshToken: string;
  expiredIn: number;
};

export interface CustomerSignInResponseDTO {
  user: {
    id: string;
    name: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
  expiredIn: number;
}

export interface EmployeeSignInResponseDTO {
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
  expiredIn: number;
}

export type AccessTokenVerifyPayload = JWTPayload & {
  iat: number;
  exp: number;
  expiredIn?: number;
};

export type RefreshTokenVerifyPayload = JWTPayload & {
  iat: number;
  exp: number;
  type: string;
};

export type SignUpResult =
  | { success: true; otp: string }
  | { success: false; error: string };

export type VerifyOtpResult =
  | { success: true; message: string }
  | { success: false; error: string; statusCode: number };
