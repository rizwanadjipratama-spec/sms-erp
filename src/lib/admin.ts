export const ROLE_EMAILS = {
  owner: 'ownsmsbgr@gmail.com',
  admin: 'smsbgr01@gmail.com',
  boss: 'bosssms02@gmail.com',
  marketing: 'marketingsmsbgr@gmail.com',
  finance: 'financesmsbgr@gmail.com',
  warehouse: 'gudangsmsbgr@gmail.com',
  technician: 'teknisismsbgr@gmail.com',
  tax: 'taxsmsbgr@gmail.com',
};

// For backward compatibility if needed, but we'll refactor auth.ts to use ROLE_EMAILS
export const ADMIN_EMAILS = [ROLE_EMAILS.owner, ROLE_EMAILS.admin];
export const MARKETING_EMAILS = [ROLE_EMAILS.marketing];