const problemModule = require('./problem');
const contestModule = require('./contest');
const noteModule = require('./note');
const likeModule = require('./like');
const userModule = require('./user');
const commentModule = require('./comment');
const userPoolModule = require('./Cognito/userPool');

/* Wildcard is fine for the beta endpoint, should be 'https://cp-notes.com' for
the production endpoint */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
};

function proxyResponse(response) {
  return {
    statusCode: 200,
    body: JSON.stringify(response),
    headers: CORS_HEADERS
  };
}

function proxyClientError(err) {
  if(err.clientError) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        name: err.name,
        message: err.message
      }),
      headers: CORS_HEADERS
    };
  }

  throw err;
}

async function errorMiddleware(handler) {
  try {
    const data = await handler();
    return proxyResponse(data);
  }
  catch(err) {
    return proxyClientError(err);
  }
}

module.exports.getProblems = async function(event) {
  const platform = event.queryStringParameters.platform;
  const contestId = event.queryStringParameters.contestId;
  const problemId = event.queryStringParameters.problemId;

  if(problemId) {
    const problemInfo = await problemModule.getProblemInfo(platform, problemId);
    return proxyResponse(problemInfo);
  }

  const problems = await problemModule.getProblems(platform, contestId);
  return proxyResponse(problems);
}

module.exports.getContests = async function(event) {
  const platform = event.queryStringParameters.platform;
  const contests = await contestModule.getContests(platform);

  return proxyResponse(contests);
}

module.exports.getUsers = async function(event) {
  const username = event.queryStringParameters.username;
  const basicInfoOnly = event.queryStringParameters.basicInfoOnly === 'true';
  const searchTerm = event.queryStringParameters.searchTerm;
  const page = event.queryStringParameters.page || 1;
  const tokenString = event.headers['Authorization'];

  try {
    if(username) {
      const profile = await userModule.getProfile(username, basicInfoOnly, tokenString);
      return proxyResponse(profile);
    }
    else if(searchTerm) {
      const usernames = await userPoolModule.searchUsers(searchTerm);
      return proxyResponse(usernames);
    }
    else {
      const users = await userModule.getUsers(page);
      return proxyResponse(users);
    }
  }
  catch(err) {
    return proxyClientError(err);
  }
}

module.exports.updateUserProfile = async function(event) {
  return await errorMiddleware(async () => {
    const body = JSON.parse(event.body);
    const username = '' + body.username;
    const avatarData = '' + body.avatarData;
    const tokenString = event.headers['Authorization'];

    await userModule.updateProfile(username, avatarData, tokenString);
    return proxyResponse('Success!');
  });
}

async function addOrEditNote(event, overwrite) {
  const body = JSON.parse(event.body);
  const username = '' + body.username;
  const platform = '' + body.platform;
  const problemId = '' + body.problemId;
  const title = body.title ? '' + body.title : '';
  const solved = body.solved ? Number(body.solved) : 0;
  const content = body.content ? '' + body.content : '[]';
  const published = body.published === undefined ? false : !!body.published;
  const tokenString = event.headers['Authorization'];

  await noteModule.addOrEditNote(username, platform, problemId, title, solved,
                                 content, published, tokenString, overwrite);

  return proxyResponse('Success');
}

module.exports.addNote = async function(event) {
  return await addOrEditNote(event, false);
}

module.exports.editNote = async function(event) {
  return await addOrEditNote(event, true);
}

module.exports.getNotes = async function(event) {
  const username = event.queryStringParameters.username;
  const platform = event.queryStringParameters.platform;
  const contestId = event.queryStringParameters.contestId;
  const problemId = event.queryStringParameters.problemId;
  const recent = event.queryStringParameters.recent;
  const forcePublished = event.queryStringParameters.forcePublished;
  const page = event.queryStringParameters.page;
  const tokenString = event.headers['Authorization'];

  try {
    if(page) {
      const data = await noteModule.getNotesFilteredList(
        platform, contestId, problemId, recent, page
      );
      return proxyResponse(data);
    }
    else {
      if(problemId) {
        const noteInfo = await noteModule.getNoteInfo(
          username, platform, problemId, tokenString, forcePublished
        );
        return proxyResponse(noteInfo);
      }
      else {
        const notes = await noteModule.getUserNotes(username);
        return proxyResponse(notes);
      }
    }
  }
  catch(err) {
    return proxyClientError(err);
  }
}

module.exports.deleteNote = async function(event) {
  const body = JSON.parse(event.body);
  const username = '' + body.username;
  const platform = '' + body.platform;
  const problemId = '' + body.problemId;
  const tokenString = event.headers['Authorization'];

  try {
    await noteModule.deleteNote(username, platform, problemId, tokenString);
    return proxyResponse('Success');
  }
  catch(err) {
    return proxyClientError(err);
  }
}

module.exports.editNoteLike = async function(event) {
  const body = JSON.parse(event.body);
  const username = '' + body.username;
  const noteAuthor = '' + body.noteAuthor;
  const platform = '' + body.platform;
  const problemId = '' + body.problemId;
  const likedStatus = parseInt(body.likedStatus);
  const tokenString = event.headers['Authorization'];

  await likeModule.setUserNoteLikedStatus(
    username, noteAuthor, platform, problemId, likedStatus, tokenString
  );
  return proxyResponse('Success!');
}

module.exports.addComment = async function(event) {
  return await errorMiddleware(async () => {
    const body = JSON.parse(event.body);
    const username = '' + body.username;
    const noteAuthor = '' + body.noteAuthor;
    const platform = '' + body.platform;
    const problemId = '' + body.problemId;
    const rootReplyId = body.rootReplyId ? '' + body.rootReplyId : null;
    const replyId = body.replyId ? '' + body.replyId : null;
    const content = '' + body.content;
    const tokenString = event.headers['Authorization'];

    if(rootReplyId) {
      return await commentModule.replyNoteComment(
        username, rootReplyId, replyId, content, tokenString
      );
    }
    else {
      return await commentModule.addNoteComment(
        username, noteAuthor, platform, problemId, content, tokenString
      );
    }
  });
}

module.exports.getComments = async function(event) {
  return await errorMiddleware(async () => {
    const noteAuthor = event.queryStringParameters.noteAuthor;
    const platform = event.queryStringParameters.platform;
    const problemId = event.queryStringParameters.problemId;

    return await commentModule.getNoteComments(noteAuthor, platform, problemId);
  });
}

module.exports.editComment = async function(event) {
  return await errorMiddleware(async () => {
    const body = JSON.parse(event.body);
    const commentId = '' + body.commentId;
    const content = '' + body.content;
    const tokenString = event.headers['Authorization'];

    await commentModule.editComment(commentId, content, tokenString);
    return 'Success!';
  });
}

module.exports.deleteComment = async function(event) {
  return await errorMiddleware(async () => {
    const body = JSON.parse(event.body);
    const commentId = '' + body.commentId;
    const tokenString = event.headers['Authorization'];

    await commentModule.deleteComment(commentId, tokenString);
    return 'Success!';
  });
}

module.exports.verifyCfUsername = async function(event) {
  return await errorMiddleware(async () => {
    const body = JSON.parse(event.body);
    const username = '' + body.username;
    const authId = '' + body.authId;
    const authCfUsername = '' + body.authCfUsername;
    const tokenString = event.headers['Authorization'];

    if(body.authId) {
      await userModule.endCfVerification(
        username, authId, authCfUsername, tokenString
      );
    }
    else {
      return await userModule.beginCfVerification(
        username, authCfUsername, tokenString
      );
    }
  });
}
