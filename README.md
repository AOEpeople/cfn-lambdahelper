# CloudFormation Helper using AWS Lambda custom resources

Author: [Fabrizio Branca](https://github.com/fbrnc)

Please note that the included CloudFormation cannot be used directly. This template is intended to be used 
with [StackFormation](https://github.com/AOEpeople/StackFormation) - a CLI tool that helps you manage and deploy 
CloudFormation stacks and also does some preprocessing (e.g. introduces `Fn::FileContent`)

Includes:
- ElastiCacheTagger
- Route53Updater
- StackDeleter

## Usage
### Load your AWS keys into env vars
Fish with the dotenv function:
dotenv .env

### Prepare "Development Environment"
cd scripts/lambda
sudo npm install aws-sdk lambda-local
wget https://gist.githubusercontent.com/fbrnc/a042b8b8949596991e36/raw/1da1aee52d62b2482ed386d9be05c39b7b9b6856/cfn-response.js -O node_modules/cfn-response.js

### Test function
node_modules/lambda-local/bin/lambda-local -l ElastiCacheTagger.js -e ElastiCacheTagger.event.json
