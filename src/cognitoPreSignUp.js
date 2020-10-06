const aws = require('aws-sdk');
const cognitoIdp = new aws.CognitoIdentityServiceProvider();

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

module.exports.handler = async function(event, context) {
  const username = event.userName;
  const email = event.request.userAttributes.email;

  if(username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    context.done(
      Error(`Username must be between ${USERNAME_MIN_LENGTH} and ` +
        `${USERNAME_MAX_LENGTH} characters`)
    );
    return;
  }

  const params = {
    UserPoolId: event.userPoolId,
    Filter: `email = "${email}"`
  };

  const userMatches = await cognitoIdp.listUsers(params).promise();
  if(userMatches.Users.length > 0) {
    context.done(
        Error('That email has already been used!')
    );
    return;
  }

  context.done(null, event);
}
