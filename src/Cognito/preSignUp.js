const userPool = require('./userPool');
const codeforces = require('../codeforces');

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

module.exports.handler = async function(event, context) {
  const username = event.userName;
  const email = event.request.userAttributes.email;

  if(username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    context.done(
      Error(`Username must be between ${USERNAME_MIN_LENGTH} and ` +
        `${USERNAME_MAX_LENGTH} characters.`)
    );
    return;
  }

  if(!codeforces.isUsernameValid(username)) {
    context.done(
      Error('Username can only contain alphanumeric characters, dashes,' +
        ' and underscores.')
    );
    return;
  }

  const userWithSameEmail = await userPool.queryEmail(email);
  if(userWithSameEmail) {
    context.done(
        Error('That email has already been used!')
    );
    return;
  }

  context.done(null, event);
}
