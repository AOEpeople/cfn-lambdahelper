var response = require('cfn-response');
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
        r.send(event, context, r.FAILED, {"message": "Update is not supported"});
    }
    if (event.RequestType == 'Create') {
        res.Password = randomPassword(20);
    }
    response.send(event, context, response.SUCCESS, res);
};