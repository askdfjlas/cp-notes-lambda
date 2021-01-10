const dynamodb = require('../Dynamodb/dynamodb');

const USER_TABLE = 'users';
const USER_PK = 'username';

module.exports.handler = async function(event, context) {
  const username = event.userName;
  const email = event.request.userAttributes.email;

  const newUserObject = {
    [ USER_PK ]: username,
    contribution: 0,
    email: email
  };

  try {
    await dynamodb.insertValue(USER_TABLE, USER_PK, newUserObject, false);
  }
  catch(err) {
    /* The user already exists, meaning this is a forgotten password request */
    if(err.name !== 'ConditionalCheckFailedException') {
      throw err;
    }
  }

  context.done(null, event);
}
