var response = require('cfn-response');
exports.handler = function (event, context) {

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    if (event.RequestType == 'Delete') {
        response.send(event, context, response.SUCCESS);
        return;
    }

    var AWS = require('aws-sdk');
    var cloudformation = new AWS.CloudFormation();

    var res = {};

    function convert(tags) {
        tagObject = {};
        tags.forEach(function(tag) {
            tagObject[tag.Key] = tag.Value;
        });
        return tagObject;
    }

    function matchesTags(tags) {
        var match = true;
        Object.keys(event.ResourceProperties.TagFilter).forEach(function(key) {
            if (tags[key] != event.ResourceProperties.TagFilter[key]) {
                match = false;
            }
        });
        return match;
    }

    cloudformation.describeStacks({}, function(err, data) {
        if (err) {
            errorExit('describeStacks call failed ' + err);
        } else {
            var matchingStacks = [];
            data.Stacks.forEach(function(stack){
                if (stack.StackName != event.ResourceProperties.ExceptStackName) {
                    if (matchesTags(convert(stack.Tags))) {
                        matchingStacks.push(stack.StackName);
                    }
                }
            });

            console.log(matchingStacks);

            res.DeletedStacks = matchingStacks;
            res.DeletedStackList = matchingStacks.join();

            matchingStacks.forEach(function(stack){
                cloudformation.deleteStack({StackName: stack}, function(err, data) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else     console.log(data);           // successful response
                });
            });

            response.send(event, context, response.SUCCESS, res);
        }
    });

};

var errorExit = function (message, event, context) {
    var res = {Error: message};
    console.log(res.Error);
    response.send(event, context, response.FAILED, res);
};