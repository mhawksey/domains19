// Some of this code is...

// Copyright 2015, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License")
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// ... but heavly modified by @mhawksey 

'use strict';
// Replace with the key you created at https://cloud.google.com/console
window.apiKey = 'AIzaSyAbV4f0xTcB0Yrn6yr8EpehrUpHbM2-qjw';

var CV_URL = 'https://vision.googleapis.com/v1/images:annotate?key=' + window.apiKey;

$(function () {
  // preloading images used for animated gif
  preLoadFrames();

  // event handlers
  $('#consent').on('click', function () {
    $('#warn').slideUp();
    $('#get-face').slideDown();
  });

  $('#dload').on('click', function () {
    downLoadGif();
  });

  // file input event handler
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', (e) => doSomethingWithFiles(e.target.files));
  const target = document.getElementById('target');

  target.addEventListener('drop', (e) => {
    e.stopPropagation();
    e.preventDefault();

    doSomethingWithFiles(e.dataTransfer.files);
  });

  target.addEventListener('dragover', (e) => {
    e.stopPropagation();
    e.preventDefault();

    e.dataTransfer.dropEffect = 'copy';
  });

  // video player/webcam event handler
  const player = document.getElementById('player');
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  const captureButton = document.getElementById('capture');

  const constraints = {
    video: true,
  };

  captureButton.addEventListener('click', () => {
    renderCapture(canvas, player, player.videoWidth, player.videoHeight);

    // Stop all video streams.
    player.srcObject.getVideoTracks().forEach(track => track.stop());
    player.remove();
  });

  // webcam capture
  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      // Attach the video stream to the video element and autoplay.
      player.srcObject = stream;
    })
    .catch((err) => {
      $('#player,#capture,#cam_error').toggle();
    });

  // rendering the image from the webcam and contraining proportions
  function renderCapture(canvas, source, w, h) {
    // https://sdqali.in/blog/2013/10/03/fitting-an-image-in-to-a-canvas-object/
    var imageAspectRatio = w / h;
    var canvasAspectRatio = canvas.width / canvas.height;
    var renderableHeight, renderableWidth, xStart, yStart;

    // If image's aspect ratio is less than canvas's we fit on height
    // and place the image centrally along width
    if (imageAspectRatio < canvasAspectRatio) {
      renderableHeight = canvas.height;
      renderableWidth = w * (renderableHeight / h);
      xStart = (canvas.width - renderableWidth) / 2;
      yStart = 0;
    }

    // If image's aspect ratio is greater than canvas's we fit on width
    // and place the image centrally along height
    else if (imageAspectRatio > canvasAspectRatio) {
      renderableWidth = canvas.width
      renderableHeight = h * (renderableWidth / w);
      xStart = 0;
      yStart = (canvas.height - renderableHeight) / 2;
    }

    // Happy path - keep aspect ratio
    else {
      renderableHeight = canvas.height;
      renderableWidth = canvas.width;
      xStart = 0;
      yStart = 0;
    }
    context.drawImage(source, xStart, yStart, renderableWidth, renderableHeight);
    sendFileToCloudVision(canvas.toDataURL("image/jpeg").replace('data:image/jpeg;base64,', ''));
  };

  // doing something with the image files that are dropped or uploaded
  function doSomethingWithFiles(fileList) {
    // Stop all video streams.
    player.srcObject.getVideoTracks().forEach(track => track.stop());
    player.remove();
    const canvas = document.getElementById('canvas');
    let file = null;
    for (let i = 0; i < fileList.length; i++) {
      if (fileList[i].type.match(/^image\//)) {
        file = fileList[i];
        break;
      }
    }

    if (file !== null) {
      var img = new Image();
      img.onload = function () {
        renderCapture(canvas, img, img.width, img.height);
        player.remove();
      }
      img.src = URL.createObjectURL(file);
    }
  }
});


/**
 * 'submit' event handler - reads the image bytes and sends it to the Cloud
 * Vision API.
 */
function uploadFiles(event) {
  event.preventDefault(); // Prevent the default form post

  // Grab the file and asynchronously convert to base64.
  var file = $('#fileform [name=fileField]')[0].files[0];
  var reader = new FileReader();
  reader.onloadend = processFile;
  reader.readAsDataURL(file);
}

/**
 * Event handler for a file's data url - extract the image data and pass it off.
 */
function processFile(event) {
  var content = event.target.result;
  sendFileToCloudVision(content.replace('data:image/jpeg;base64,', ''));
}

/**
 * Sends the given file contents to the Cloud Vision API and outputs the
 * results.
 */
function sendFileToCloudVision(content) {
  $('.progress').show();
  var type = 'FACE_DETECTION'; //$('#fileform [name=type]').val();

  // Strip out the file prefix when you convert to json.
  var request = {
    requests: [{
      image: {
        content: content
      },
      features: [{
        type: type,
        maxResults: 200
      }]
    }]
  };

  $('#results').text('Loading...');
  $.post({
    url: CV_URL,
    data: JSON.stringify(request),
    contentType: 'application/json'
  }).fail(function (jqXHR, textStatus, errorThrown) {
    $('#results').text('ERRORS: ' + textStatus + ' ' + errorThrown);
  }).done(displayJSON);
}

/**
 * Displays the results.
 */
function displayJSON(data) {
  $('#get-face,.call2action,.txt_out').toggle();
  const canvas = document.getElementById('canvas');
  // copy captured image to svg for animated gif 
  document.getElementById('source_img').setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', canvas.toDataURL());
  const context = canvas.getContext('2d');
  // Now draw boxes around all the faces
  const faces = data.responses[0].faceAnnotations;
  const numFaces = faces.length;
  console.log(`Found ${numFaces} face${numFaces === 1 ? '' : 's'}.`);
  context.strokeStyle = 'rgba(0,255,0,0.8)';
  context.lineWidth = '5';

  // only doing something with the first face captured
  const face = faces[0]; 

  // cropping the captured face 
  const destFace = document.getElementById('face');
  const destCtx = destFace.getContext('2d');
  const fd = face.fdBoundingPoly.vertices;
  const w = fd[2].x - fd[0].x;
  const h = fd[2].y - fd[0].y;
  const imageData = context.getImageData(fd[0].x, fd[0].y, w, h);
  const z = destFace.width / w;

  var newCanvas = document.createElement('canvas');
  newCanvas.width = imageData.width;
  newCanvas.height = imageData.height;

  newCanvas.getContext("2d").putImageData(imageData, 0, 0);
  destCtx.scale(z, z);
  destCtx.drawImage(newCanvas, 0, 0);

  // copy cropped face to svg for rendering in animated gif
  document.getElementById('cropped_face').setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', destFace.toDataURL());

  // draw a box around the detected face on the capture image
  context.beginPath();
  let origX = 0;
  let origY = 0;
  face.fdBoundingPoly.vertices.forEach((bounds, i) => {
    if (i === 0) {
      origX = bounds.x;
      origY = bounds.y;
    }
    context.lineTo(bounds.x, bounds.y);
  });
  context.lineTo(origX, origY);
  context.stroke();

  // adding dots for the other face points
  context.fillStyle  = 'rgba(0,255,0,0.8)';
  face.landmarks.forEach(function (landmark) {
      context.beginPath();
      context.arc(landmark.position.x, landmark.position.y, 1, 0, 2 * Math.PI);
      context.fill();
      
  });
  context.stroke();
  // add image with box and landmarks to the svg for animation
  document.getElementById('render_img').setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', canvas.toDataURL());

  // add some text to our svg for animation
  for (var f in face){
    if (typeof face[f] === 'string' || face[f] instanceof String || typeof face[f] == 'number'){
      $('#console').append($('<tspan x="10" dy="1em"  style="display:none">"'+f+'": "'+face[f]+'"</tspan>'));
      $('#results').text($('#results').text()+'\n'+f+'": "'+face[f]);
    }
  }
  // update svg with our new elements
  $("#photo").html($("#photo").html());
  // start compiling the animated gif
  downLoadGif();
}

// globals for our animation
var counter = 0;
var frames = 14;
var totalFrames = frames * 2;
var frames_path = 'img/frm/s';
var gif;

// download animated gif
function downLoadGif() {
  $('.progress > div').removeClass().addClass('determinate');

  // init the gif maker
  gif = new GIF({
    workers: 2,
    workerScript: 'js/gif.worker.js',
    width: 484,
    height: 253,
    quality: 10
  });

  // show render progress to the user
  gif.on("progress", function (p) {
    console.log('Progress: ' + p);
    $('.determinate').css('width', p * 100 + '%');
  });

  // when animated gif is made show it in the browser with option of download
  gif.on('finished', function (blob) {
    var url = URL.createObjectURL(blob);
    $('#photo').css('background-image', 'none');
    $('#photo').empty();
    $('#photo').append(($('<img>', {
      id: 'domains19-mcfly',
      src: url,
      width: '100%'
    })));
    $('#dload').attr("href", url);
    $('.progress').hide();
    $('#dload').show();
  });

  // bit that actually sends frames for animation
  for (var i = 1; i < totalFrames; i++) {
    addFrame(i, function (t) {
      console.log(t);
      if (t == totalFrames - 1) {
        gif.render();
      }
    });
  }
}

// Add a frame for time t
// from https://bl.ocks.org/veltman/1071413ad6b5b542a1a3
function addFrame(t, cb) {
  // Update SVG
  drawFrame(t);

  // Create a blob URL from SVG
  // including "charset=utf-8" in the blob type breaks in Safari
  var img = new Image(),
    serialized = new XMLSerializer().serializeToString(document.getElementById('anima')),
    svg = new Blob([serialized], {
      type: "image/svg+xml"
    }),
    url = URL.createObjectURL(svg);

  // Onload, callback to move on to next frame
  img.onload = function () {
    gif.addFrame(img, {
      delay: svgCache[t].delay,
      copy: true
    });
    console.log('Image loaded... ');
    cb(t);
  };
  img.src = url;
}

function drawFrame(t) {
  console.log('Drawing frame: ' + t);
  // update svg with current frame (images need to be base64 encoded rather than relative/absolute links)
  document.getElementById('frm').setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', svgCache[t].data);
  // simulating console lines
  $( '#console tspan:nth-child('+parseInt(t/2)+')').show();

  // gitch to alternate between captured image and image with bounding box and landmarks
  var rand = Math.random();
  if (rand>0.6){
    $('#render_img').hide();
  } else {
    $('#render_img').show();
  }
}

// https://stackoverflow.com/a/30537102/1027723
var svgCache = {};
// bit that preloads the frames for our animation
function preLoadFrames() {
  console.log("Counter: " + counter);
  if (counter > 0) {
    $('.progress > div').removeClass().addClass('determinate');
    $('.determinate').css('width', counter / frames * 100 + '%');
  }
  // just increment the counter if there are still images pending...
  if (counter++ >= frames) {
    // this function will be called when everything is loaded
    // e.g. you can set a flag to say "I've got all the images now"
    console.log('Frames loaded...');
    $('#consent').removeAttr("disabled");

    $('.progress').hide();
    $('.progress > div').removeClass().addClass('indeterminate');
  }
}



// This will load the images in parallel:
// In most browsers you can have between 4 to 6 parallel requests
// IE7/8 can only do 2 requests in parallel per time
for (var i = 1; i <= frames; i++) {
  // base64 encoding images for svg as url links don't render
  console.log("Preloading frame: " + i);
  // convert image url to base64 for svg to animated gif
  convertImgToBase64URL(frames_path + ('0' + i).slice(-2) + '.jpg', function (base64Img, idx) {
    // as part of image cache also setting frame timings
    var setDelay = 80;
    if (idx === 1) {
      setDelay = 200;
    } else if (idx === 14) {
      setDelay = 1000;
    }
    svgCache[idx] = {
      data: base64Img,
      delay: setDelay
    };
    svgCache[totalFrames - idx] = {
      data: base64Img,
      delay: setDelay
    };
    preLoadFrames();
  }, 'image/png', i);
}

/**
 * Convert an image 
 * to a base64 url
 * @param  {String}   url         
 * @param  {Function} callback    
 * @param  {String}   [outputFormat=image/png]
 * @param  {Integer}  idx         
 */
function convertImgToBase64URL(url, callback, outputFormat, idx) {
  var img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = function () {
    var canvas = document.createElement('CANVAS'),
      ctx = canvas.getContext('2d'),
      dataURL;
    canvas.height = img.height;
    canvas.width = img.width;
    ctx.drawImage(img, 0, 0);
    dataURL = canvas.toDataURL(outputFormat);
    callback(dataURL, idx);
    canvas = null;
  };
  img.src = url;
}