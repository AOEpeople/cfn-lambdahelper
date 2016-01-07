# CloudFormation Helper using AWS Lambda custom resources

Author: [Fabrizio Branca](https://github.com/fbrnc)

Please note that the included CloudFormation cannot be used directly. This template is intended to be used 
with [StackFormation](https://github.com/AOEpeople/StackFormation) - a CLI tool that helps you manage and deploy 
CloudFormation stacks and also does some preprocessing (e.g. introduces `Fn::FileContent`)

Includes:
- ElastiCacheTagger
- Route53Updater
- StackDeleter
- Route53Lookup