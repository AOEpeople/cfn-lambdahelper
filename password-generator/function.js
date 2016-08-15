// Sends a response to the pre-signed S3 URL
var sendResponse = function(event, context, responseStatus, responseData) {
    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
        PhysicalResourceId: context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    });

    console.log('RESPONSE BODY:\n', responseBody);

    var parsedUrl = url.parse(event.ResponseURL);
    var options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'PUT',
        headers: {
            'Content-Type': '',
            'Content-Length': responseBody.length
        }
    };

    var req = https.request(options, function(res) {
        console.log('STATUS:', res.statusCode);
        console.log('HEADERS:', JSON.stringify(res.headers));
        context.succeed('Successfully sent stack response!');
    });

    req.on('error', function(err) {
        console.log('sendResponse Error:\n', err);
        context.fail(err);
    });

    req.write(responseBody);
    req.end();
};


exports.handler = function (event, context) {

    function randomPassword(length) {
        // var chars = "abcdefghijklmnopqrstuvwxyz!@#$%^&*()-+<>ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
        var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
        var pass = "";
        for (var x = 0; x < length; x++) {
            var i = Math.floor(Math.random() * chars.length);
            pass += chars.charAt(i);
        }
        return pass;
    }

    var res = {};

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    if (event.RequestType == 'Update') {
        sendResponse(event, context, 'FAILED', {"message": "Update is not supported"});
    }
    if (event.RequestType == 'Create') {
        res.Password = randomPassword(20);
    }
    sendResponse(event, context, 'SUCCESS', res);
};