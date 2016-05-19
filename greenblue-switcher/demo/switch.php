<?php

$type = $argv[1];

if ($type != 'Blue' && $type != 'Green') {
    throw new \InvalidArgumentException('Invalid type');
}

require_once __DIR__ . '/../../../../vendor/autoload.php';

$asgRepository = new \AwsInspector\Model\AutoScaling\Repository();
$asg = $asgRepository->findByAutoScalingGroupName('/^test-green-blue-Asg'.$type.'.*/')->getFirst(); /* @var $asg \AwsInspector\Model\AutoScaling\AutoScalingGroup */

$elbRepository = new \AwsInspector\Model\Elb\Repository();
$elb = $elbRepository->findElbByName('test-elb');

var_dump($asg->getLoadBalancerNames());
var_dump($asg->getAutoScalingGroupName());

// $res = $asg->attachLoadBalancers([$elb]);
//var_dump($res);