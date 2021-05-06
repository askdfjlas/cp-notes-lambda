## CDK Lambda Stack for cp-notes

This repository contains the CDK (Cloud Development Kit) stack which runs the backend for [cp-notes](cp-notes.com)! Most of the 'interesting' code is in the `src/` folder. The frontend code can be found [here](https://github.com/askdfjlas/askdfjlas.github.io).

## General Architecture

All computations are performed through AWS Lambda functions. The backend exposes an API via API Gateway, and uses DynamoDB as a data store. Several other services are used, some of which include Cognito for user auth, and CloudWatch events for the periodic scraping of several competitive programming platforms (in order to populate problem databases).

## Contributing

Probably won't accept any contributions, feel free to open up issues though!
