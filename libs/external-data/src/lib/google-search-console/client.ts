import { auth, searchconsole_v1 } from '@googleapis/searchconsole';

export function getGscClient() {
  return new searchconsole_v1.Searchconsole({
    auth: new auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/webmasters',
        'https://www.googleapis.com/auth/webmasters.readonly',
      ],
      credentials: process.env.GSC_KEY && {
        private_key: process.env.GSC_KEY,
        client_email: process.env.GSC_EMAIL,
      },
    }),
  });
}

export type Searchconsole = searchconsole_v1.Searchconsole;
