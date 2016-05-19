## Local Development
### Load your AWS keys into env vars
Fish with the dotenv function:
dotenv .env

### Prepare "Development Environment"
sudo npm install -g lambda-local
sudo npm install aws-sdk
mkdir node_modules
wget https://gist.githubusercontent.com/fbrnc/a042b8b8949596991e36/raw/1da1aee52d62b2482ed386d9be05c39b7b9b6856/cfn-response.js -O node_modules/cfn-response.js

### Test function
lambda-local -l function.js -e event-sample.json -t 300
