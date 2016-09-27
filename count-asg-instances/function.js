var response = require('cfn-response');
var AWS = require('aws-sdk');

if (!AWS.config.region) {
    AWS.config.update({region: 'us-east-1'});
}

var autoscaling = new AWS.AutoScaling();

exports.handler = function (event, context) {

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));

    var tags = event.ResourceProperties.AutoScalingGroupTags || errorExit('No AutoScalingGroupTags found', event, context);
    var min = event.ResourceProperties.Min || 0;
    var max = event.ResourceProperties.Max || 100;
    var factor = event.ResourceProperties.Factor || 1;

    var responseData = {};

    var findAutoScalingGroupByTags = function(tags, callback) {
        var result = 0;
        autoscaling.describeAutoScalingGroups({}, function(err, data) {
            if (err) {
                callback(err, data);
            } else {
                data.AutoScalingGroups.forEach(function (item) {
                    if (match(tags, convertToAssocTags(item.Tags))) {
                        var count = 0;
                        item.Instances.forEach(function(instance) {
                            if (instance.LifecycleState == 'InService') {
                                count++;
                            }
                        });
                        result = Math.max(count, result);
                    }
                });
                callback(null, result);
            }
        })
    };

    var match = function(a, b) {
        var match = true;
        Object.keys(a).forEach(function(key) {
            if (a[key] != b[key]) {
                match = false;
            }
        });
        return match;
    };

    var convertToAssocTags = function (tags) {
        var assocTags = {};
        tags.forEach(function(tag) {
            assocTags[tag.Key] = tag.Value;
        });
        return assocTags;
    };

    if (event.RequestType == 'Create') {
        findAutoScalingGroupByTags(convertToAssocTags(tags), function(err, result) {
            if (err) {
                responseData.Error = 'No AutoScalingGroup found';
                responseData.OriginalError = err;
                result = min;
            }
            result *= factor;
            result = Math.round(result);
            result = Math.max(min, result);
            result = Math.min(max, result);
            responseData.Count = result;
            response.send(event, context, response.SUCCESS, responseData);
        });
    } else {
        response.send(event, context, response.SUCCESS, responseData);
    }
};

var errorExit = function (message, event, context) {
    responseData = {Error: message};
    console.log(responseData.Error);
    response.send(event, context, response.FAILED, responseData);
};
