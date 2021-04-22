let cognitoIds = require('./ids_that_are_public_anyways');
cognitoIds = cognitoIds[process.env.stage];

module.exports = Object.freeze({
  POOL_REGION: 'us-east-1',
  USER_POOL_ID: cognitoIds.USER_POOL_ID,
  APP_CLIENT_ID: cognitoIds.APP_CLIENT_ID,
  JWK_URL: `https://cognito-idp.us-east-1.amazonaws.com/${cognitoIds.USER_POOL_ID}/.well-known/jwks.json`,
  COGNITO_ISSUER: `https://cognito-idp.us-east-1.amazonaws.com/${cognitoIds.USER_POOL_ID}`
});
