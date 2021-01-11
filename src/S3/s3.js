const aws = require('aws-sdk');
const s3 = new aws.S3({ region: 'us-east-1', apiVersion: '2006-03-01' });

async function writeFile(bucketName, fileName, data) {
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: data
  };

  await s3.putObject(params).promise();
}

module.exports.writeFile = writeFile;
