import { auth, searchconsole_v1 } from '@googleapis/searchconsole';

function formatPrivateKey(key: string): string {
  return key
    .replace(
      /-----BEGIN PRIVATE KEY-----(?!\n)(.)/,
      '-----BEGIN PRIVATE KEY-----\n$1',
    )
    .replace(
      /(?!\n)(.)-----END PRIVATE KEY-----/,
      '$1\n-----END PRIVATE KEY-----\n',
    );
}

export function getGscClient() {
  return new searchconsole_v1.Searchconsole({
    auth: new auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/webmasters',
        'https://www.googleapis.com/auth/webmasters.readonly',
      ],
      credentials: process.env.GSC_KEY && {
        private_key: formatPrivateKey(process.env.GSC_KEY),
        client_email: process.env.GSC_EMAIL,
      },
    }),
  });
}

export type Searchconsole = searchconsole_v1.Searchconsole;
