const jsonwebtoken = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const fetch = require('node-fetch');
const cognitoConstants = require('./cognitoConstants');

async function getJwks() {
  const data = await fetch(cognitoConstants.JWK_URL);
  const dataJson = await data.json();

  var kidMap = {};
  for(const key of dataJson.keys) {
    kidMap[key.kid] = jwkToPem(key);
  }

  return kidMap;
}

async function verify(tokenString) {
  const tokenSections = tokenString.split('.');
  if(tokenSections.length < 2) {
    throw Error('Invalid token');
  }

  const headerString = Buffer.from(tokenSections[0], 'base64').toString('utf8');
  const headerJson = JSON.parse(headerString);
  if(headerJson.alg != 'RS256') {
    throw Error('Incorrect algorithm in header');
  }

  const kidMap = await getJwks();
  const kid = headerJson.kid;
  if(!kidMap.hasOwnProperty(kid)) {
    throw Error('kid not found');
  }

  const publicKey = kidMap[kid];
  const payload = jsonwebtoken.verify(tokenString, publicKey);
  if(payload.iss !== cognitoConstants.COGNITO_ISSUER) {
    throw Error('Invalid issuer');
  }
  if(payload.token_use !== 'access') {
    throw Error('Not an access token');
  }
  if(payload.client_id !== cognitoConstants.APP_CLIENT_ID) {
    throw Error('Invalid client ID');
  }

  return payload.username;
}

async function verifyUser(username, tokenString) {
  const authenticatedUser = await verify(tokenString);
  if(username !== authenticatedUser) {
    throw Error('Not logged in as the requested user!');
  }
}

module.exports.verify = verify;
module.exports.verifyUser = verifyUser;
