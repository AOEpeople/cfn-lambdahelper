var response = require('cfn-response');
var AWS = require('aws-sdk');

if (!AWS.config.region) {
    AWS.config.update({region: 'us-west-2'});
}

var autoscaling = new AWS.AutoScaling();

exports.handler = function (event, context) {
    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));

    var minSize = event.ResourceProperties.MinSize || errorExit('No MinSize defined');
    var maxSize = event.ResourceProperties.MaxSize || errorExit('No MaxSize defined');
    var desiredCapacity = event.ResourceProperties.DesiredCapacity || errorExit('No DesiredCapacity defined');
    var asgName = event.ResourceProperties.AutoScalingGroupName || errorExit('No AutoScalingGroupName defined');

    var params = {
        AutoScalingGroupName: asgName,
        DesiredCapacity: desiredCapacity,
        MaxSize: maxSize,
        MinSize: minSize
    };
    console.log(params);

    autoscaling.updateAutoScalingGroup(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            errorExit(err, event, context)
        } else {
            console.log(data);
            response.send(event, context, response.SUCCESS, { "message": "Successfully updated " + asgName});
        }
    });
};

var errorExit = function (message, event, context) {
    responseData = {Error: message};
    console.log(responseData.Error);
    response.send(event, context, response.FAILED, responseData);
};