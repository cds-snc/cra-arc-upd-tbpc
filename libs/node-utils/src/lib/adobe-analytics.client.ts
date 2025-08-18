import { type AnalyticsCoreAPI, init } from '@adobe/aio-lib-analytics';
import axios, { AxiosError } from 'axios';
import dayjs from 'dayjs';
import type { AuthParams } from './adobe-analytics.types';

export type { AnalyticsCoreAPI } from '@adobe/aio-lib-analytics';

export const defaultAuthParams = (): AuthParams => {
  const authParams = {
    clientId: process.env['AW_CLIENT_ID'],
    clientSecret: process.env['AW_CLIENT_SECRET'],
    companyId: process.env['AW_COMPANY_ID'],
  };

  if (
    !authParams.clientId ||
    !authParams.clientSecret ||
    !authParams.companyId
  ) {
    const missingParamsString = Object.entries(authParams)
      .filter(([, value]) => !value)
      .map(([key]) => {
        switch (key) {
          case 'clientId':
            return 'AW_CLIENT_ID';
          case 'clientSecret':
            return 'AW_CLIENT_SECRET';
          case 'companyId':
            return 'AW_COMPANY_ID';
          default:
            return '';
        }
      })
      .join(', ');

    throw new Error(
      `Environment variable(s) not set for Adobe Analytics credentials: ${missingParamsString}`,
    );
  }

  return authParams as AuthParams;
};

export async function getAuthToken(params: AuthParams) {
  try {
    const response = await axios.post(
      'https://ims-na1.adobelogin.com/ims/token/v3',
      `client_id=${params.clientId}&client_secret=${params.clientSecret}` +
        '&grant_type=client_credentials&scope=openid,AdobeID,additional_info.projectedProductContext',
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    return response.data.access_token as string;
  } catch (e) {
    console.error('Error getting Adobe Analytics OAuth Token:');

    if (e instanceof AxiosError) {
      console.log(e.response?.data);
      console.log(e.response?.status);
      console.log(e.response?.headers);
    } else {
      console.log((<Error>e).stack);
    }

    throw e;
  }
}

export async function getAAClient(
  authParams?: AuthParams,
): Promise<AnalyticsCoreAPI> {
  if (!authParams) {
    return getDefaultAAClient();
  }

  if (!authParams.expiryDateTime) {
    authParams.expiryDateTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  }

  const token = await getAuthToken(authParams);

  const formattedExpiryDateTime = dayjs(
    authParams.expiryDateTime * 1000,
  ).format('YYYY-MM-DD HH:mm:ss');

  console.log(
    `New AA client token successfully created.\r\nValid until: ${formattedExpiryDateTime}`,
  );

  return await init(authParams.companyId, authParams.clientId, token);
}

export function getDefaultAAClient() {
  return getAAClient(defaultAuthParams());
}
