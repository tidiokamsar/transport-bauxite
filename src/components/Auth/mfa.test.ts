import { describe, expect, it } from 'vitest';
import { codeValide, nettoyerCode, urlQrCode, verificationRequise } from './mfa';

describe('double authentification (D-045)', () => {
  it('verification requise seulement de aal1 vers aal2', () => {
    expect(verificationRequise({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(true);
    expect(verificationRequise({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(false);
    expect(verificationRequise({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(false);
    expect(verificationRequise(null)).toBe(false);
  });
  it('code a 6 chiffres, espaces tolerees', () => {
    expect(codeValide('123 456')).toBe(true);
    expect(nettoyerCode(' 12 34 56 ')).toBe('123456');
    expect(codeValide('12345')).toBe(false);
    expect(codeValide('12a456')).toBe(false);
  });
  it('QR code encode en URL de donnees', () => {
    expect(urlQrCode('<svg a="b"/>')).toBe('data:image/svg+xml;utf-8,%3Csvg%20a%3D%22b%22%2F%3E');
  });
});
