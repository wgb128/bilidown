/*
 * bilidown主文件
 */

// 对外导出的js对象，包含所有对外API
var bilidown = {};
module.exports = bilidown;

var http = require('http');
var fs = require('fs');
var path = require('path');
var events = require('events');
var request = require('request');

// 视频描述文件的url地址模板
var descriptorUrlTemplate = 'http://www.bilibili.com/m/html5?aid=#{av_number}&page=#{page_number}';

/**
 * 下载B站的视频
 * @param  {string}   pageUrl  视频页面的URL地址
 * @param  {number}   pageNumber  视频页面里第几页
 * @param  {string}   saveDir  用户输入的视频保存目录
 */

bilidown.downloadPageVideo = function(pageUrl, pageNumber, saveDir){
  // 创建一个事件代理，用于通知用户下载过程中所发生的事件
  // 所有下载过程中的事件都要交一份给这个代理，从而使用户可以自定义一些hook行为
  var eventProxy = new events.EventEmitter();

  var avNumber = pageUrl.match(/av(\d+)\//)[1];
  // 拼接出描述文件的url地址
  var descriptorUrl = descriptorUrlTemplate.replace(/#{av_number}/, avNumber)
    .replace(/#{page_number}/, pageNumber);

  // 视频存储的实际绝对地址
  var savePath = resolePath(saveDir);

  http.get(descriptorUrl, function(res){ // 获取描述文件
    getTextFromResponse(res, function(err, text){ // 获取描述文件内的文本
      handleVideoDescriptor(text, function(err, videoUrl){ //截取视频url
        downloadVideo(videoUrl, avNumber, pageNumber, savePath, eventProxy); // 下载视频
      });
    });
  });

  return eventProxy;
}

/**
 * 解析用户输入的路径（相对或绝对地址），返回实际的绝对地址
 * 如果输入的是相对地址，则相对于当前的【执行】目录
 * @param  {string} inputPath 用户的输入路径
 * @return {string} 解析后的实际路径
 */
function resolePath(inputPath){
  var realPath = '';

  // 相对路径
  if(!path.isAbsolute(inputPath)){
    realPath = path.join(process.cwd(),inputPath);
  }else{
    realPath = inputPath;
  }

  console.log('视频保存到目录：'+realPath);

  return realPath;
}

/**
 * 直接下载视频
 * @param  {string}   videoUrl 视频url
 * @param  {number}   avNumber av号的数字部分
 * @param  {number}   pageNumber 视频里地第几页
 * @param  {string}   savePath 保存路径（绝对地址）
 * @param  {object}   eventProxy 事件代理
 */
function downloadVideo(videoUrl, avNumber, pageNumber, savePath, eventProxy){
  // 视频文件名
  var fileName = 'av' + avNumber + ((pageNumber!==1)?('_' + pageNumber):'') + '.mp4';

  var total = 0;
  var currentSum = 0;
  // 要显示在屏幕上的进度语句
  var sentence = '';

  request
    .get(videoUrl)
    .on('response', function(res){
      total = res.headers['content-length'];
    })
    .on('data', function(chunk){
      currentSum += chunk.length;
      eventProxy.emit('downloading',{
        'current':currentSum,
        'total':total
      });
    })
    .on('error', function(err) {
      eventProxy.emit('error', err);
    })
    .on('end', function(){
      eventProxy.emit('end');
    })
    .pipe(fs.createWriteStream(path.join(savePath, fileName)));
}

/**
 * 处理视频描述文件，获取视频实际的url
 * @param  {[type]}   descriptor 视频描述文件文本
 * @param  {Function} callback   err, videoUrl
 */
function handleVideoDescriptor(descriptorText, callback){
  var descriptor = JSON.parse(descriptorText);
  return callback(null, descriptor.src);
}

/**
 * 从http响应中取出文本
 * @param  {object}   response http响应
 * @param  {Function} callback err,string
 */
function getTextFromResponse(response, callback){
  var html = '';
  response.on('data', function(chunk){
    html += chunk;
  });
  response.on('end', function(){
    callback(null, html);
  });
}
