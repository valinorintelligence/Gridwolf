import { api } from './api';
import type { TokenResponse, User } from '../types';

export async function login(
  username: string,
  password: string
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', {
    username,
    password,
  });
  return data;
}

export async function register(userData: {
  username: string;
  email: string;
  password: string;
  fullName: string;
}): Promise<User> {
  const { data } = await api.post<User>('/auth/register', {
    username: userData.username,
    email: userData.email,
    password: userData.password,
    full_name: userData.fullName,
  });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}
