import { cookieOptions } from './session-cookie';

describe('cookieOptions', () => {
  it('production : Secure, HttpOnly, SameSite=Lax', () => {
    expect(cookieOptions('production')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });
  });

  it('test : pas Secure (HTTP local)', () => {
    expect(cookieOptions('test')).toMatchObject({
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
    });
  });
});
