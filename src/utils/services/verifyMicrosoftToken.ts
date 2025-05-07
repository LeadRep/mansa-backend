import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
});

const getKey = (header: JwtHeader, callback: SigningKeyCallback): void => {
  client.getSigningKey(header.kid as string, (err, key) => {
    if (err) {
      callback(err, undefined);
    } else {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    }
  });
};

export interface MicrosoftIdTokenPayload {
  name?: string;
  preferred_username?: string;
  email?: string;
  oid?: string;
  sub?: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  [key: string]: any;
}

export const verifyMicrosoftToken = (token: string): Promise<MicrosoftIdTokenPayload> => {
  const clientId = process.env.MICROSOFT_CLIENT_ID; // replace with your actual Azure client ID
  const tenantId = process.env.MICROSOFT_TENANT_ID; // or use your tenant ID if not multitenant

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: clientId,
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err || !decoded) {
          return reject(err);
        }
        resolve(decoded as MicrosoftIdTokenPayload);
      }
    );
  });
};
