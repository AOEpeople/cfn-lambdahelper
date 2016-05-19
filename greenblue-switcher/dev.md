## Local Development
### Load your AWS keys into env vars
Fish with the dotenv function:
dotenv .env

### Prepare "Development Environment"
sudo npm install -g lambda-local
sudo npm install aws-sdk async

### Test function
lambda-local -l function.js -e event-sample.json -t 300
