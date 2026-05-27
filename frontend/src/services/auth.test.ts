import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './api';
import { login, register, getMe } from './auth';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
});

describe('auth service', () => {
  it('login posts to /auth/login and returns token', async () => {
    mock.onPost('/auth/login').reply(200, {
      access_token: 'jwt-token',
      token_type: 'bearer',
    });

    const result = await login('alice', 'Sup3rSecret');

    expect(result.access_token).toBe('jwt-token');
    expect(result.token_type).toBe('bearer');
    expect(mock.history.post[0].url).toBe('/auth/login');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      username: 'alice',
      password: 'Sup3rSecret',
    });
  });

  it('register posts to /auth/register and maps fullName → full_name', async () => {
    mock.onPost('/auth/register').reply(201, {
      id: 'u1',
      username: 'alice',
      email: 'a@b.c',
      role: 'analyst',
    });

    await register({
      username: 'alice',
      email: 'a@b.c',
      password: 'Sup3rSecret',
      fullName: 'Alice Tester',
    });

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.full_name).toBe('Alice Tester');
    expect(body).not.toHaveProperty('fullName');
  });

  it('getMe issues GET /auth/me', async () => {
    mock.onGet('/auth/me').reply(200, {
      id: 'u1',
      username: 'alice',
      email: 'a@b.c',
      role: 'analyst',
    });

    const user = await getMe();
    expect(user.username).toBe('alice');
    expect(mock.history.get[0].url).toBe('/auth/me');
  });

  it('login propagates 401 as rejected promise', async () => {
    mock.onPost('/auth/login').reply(401, { detail: 'bad creds' });
    // Suppress jsdom navigation error from the 401 interceptor.
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
    } as Location);
    await expect(login('alice', 'wrong')).rejects.toBeDefined();
  });
});
