const AMPLIFY_CONFIG = require('./amplify_config');
const TEST_ACCOUNT_INFO = require('./test_account_info');

const expect = require('chai').expect;
const { Amplify, Auth } = require('aws-amplify');
Amplify.configure(AMPLIFY_CONFIG);

async function getJwtToken() {
  const user = await Auth.currentAuthenticatedUser();
  const currentSession = user.getSignInUserSession();
  const accessToken = currentSession.getAccessToken();
  return accessToken.getJwtToken();
}

describe('User logging in', () => {
  it('Amplify sign in', async () => {
    await Auth.signIn(TEST_ACCOUNT_INFO.username, TEST_ACCOUNT_INFO.password);
    const user = await Auth.currentAuthenticatedUser();
    expect(user).to.not.equal(null);
  });

  it('Get jwt token', async () => {
    const jwtToken = await getJwtToken();
    expect(jwtToken).to.not.equal(null);
  });
});

module.exports = {
  getJwtToken: getJwtToken
};
