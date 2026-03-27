import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/types';

/* ================= TYPES ================= */

export interface TwoFactorUser extends Profile {
  two_factor_secret?: string | null;
  two_factor_enabled: boolean;
}

/* ================= GENERATE ================= */

export const generate2FASecret = (
  email: string,
  issuer = 'SMS Laboratory'
): { secret: string; otpauthUrl: string } => {
  const secret = authenticator.generateSecret();

  const otpauthUrl = authenticator.keyuri(
    email,
    issuer,
    secret
  );

  return { secret, otpauthUrl };
};

/* ================= QR ================= */

export const generate2FAQrCode = async (
  otpauthUrl: string
): Promise<string> => {
  return QRCode.toDataURL(otpauthUrl);
};

/* ================= VERIFY ================= */

export const verify2FACode = (
  secret: string,
  code: string
): boolean => {
  try {
    return authenticator.verify({
      token: code,
      secret,
    });
  } catch {
    return false;
  }
};

/* ================= ENABLE ================= */

export const enable2FA = async (
  profile: TwoFactorUser
): Promise<void> => {
  if (!profile.email || !profile.two_factor_secret) {
    throw new Error('Invalid profile data for 2FA enable');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      two_factor_secret: profile.two_factor_secret,
      two_factor_enabled: true,
    })
    .eq('email', profile.email);

  if (error) throw error;
};

/* ================= DISABLE ================= */

export const disable2FA = async (
  email: string
): Promise<void> => {
  if (!email) throw new Error('Email required');

  const { error } = await supabase
    .from('profiles')
    .update({
      two_factor_secret: null,
      two_factor_enabled: false,
    })
    .eq('email', email);

  if (error) throw error;
};