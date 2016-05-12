var response = require('cfn-response');
exports.handler = function (event, context) {

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    if (event.RequestType == 'Delete') {
        response.send(event, context, response.SUCCESS);
        return;
    }

    var CacheClusterId = event.ResourceProperties.CacheClusterId;

    var AWS = require('aws-sdk');
    var elasticache = new AWS.ElastiCache();

    var res = {};

    var params = {
        CacheClusterId: CacheClusterId,
        ShowCacheNodeInfo: true
    };
    elasticache.describeCacheClusters(params, function (err, data) {
        if (err) {
            res.Error = 'describeCacheClusters call failed';
            console.log(res.Error + ':\\n', err);
            response.send(event, context, response.FAILED, res);
        } else {
            if (data.CacheClusters.length == 0) {
                res.Error = 'Cache cluster not found';
                console.log(res.Error + ':\\n', err);
                response.send(event, context, response.FAILED, res);
            }
            if (data.CacheClusters[0].CacheNodes.length == 0) {
                res.Error = 'Cache node not found';
                console.log(res.Error + ':\\n', err);
                response.send(event, context, response.FAILED, res);
            }
            res.EndpointAddress = data.CacheClusters[0].CacheNodes[0].Endpoint.Address;
            console.log(res);
            response.send(event, context, response.SUCCESS, res);
        }
    });
};