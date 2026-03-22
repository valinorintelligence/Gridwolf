import { api } from './api';
import type { TokenResponse, User } from '../types';

export async function login(
  username: string,
  password: string
): Promise<TokenResponse> {
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);

  const { data } = await api.post<TokenResponse>('/auth/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

export async function register(userData: {
  username: string;
  email: string;
  password: string;
  fullName: string;
}): Promise<User> {
  const { data } = await api.post<User>('/auth/register', userData);
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}
