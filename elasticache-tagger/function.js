var response = require('cfn-response');
exports.handler = function (event, context) {

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    if (event.RequestType == 'Delete') {
        response.send(event, context, response.SUCCESS);
        return;
    }

    var CacheClusterId = event.ResourceProperties.CacheClusterId;
    var AccountId = event.ResourceProperties.AccountId;
    var Region = event.ResourceProperties.Region;
    var Tags = event.ResourceProperties.Tags;

    var AWS = require('aws-sdk');
    var elasticache = new AWS.ElastiCache({region: "eu-west-1"});

    var responseData = {};

    var params = {
        ResourceName: 'arn:aws:elasticache:' + Region + ':' + AccountId + ':cluster:' + CacheClusterId,
        Tags: Tags
    };
    elasticache.addTagsToResource(params, function (err, data) {
        if (err) {
            responseData.Error = 'addTagsToResource call failed';
            console.log(responseData.Error + ':\\n', err);
            response.send(event, context, response.FAILED, responseData);
        } else {
            console.log("ElastiCache instances successfully tagged");
            response.send(event, context, response.SUCCESS, responseData);
        }
    });
};